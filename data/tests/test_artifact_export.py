# -*- coding: utf-8 -*-
"""S6 serving 번들 내보내기 (spec 20, Jira S15P21A405-132).

    S5 카탈로그 + S3 좌표 + S4 말단 노드  →  serving/<v>/ 계약 v1 파일 묶음

여기서는 **조립 경로**를 검사한다: 동결 파일이 복사만 되는지, manifest 가 계약 키를 다
갖추는지, sha256 이 실제 파일과 들어맞는지, 내용 대조가 차이를 잡아내는지.

전수 조립(6,624,399행)은 커밋 훅에서 돌리기에 너무 무겁다. 2026-09-10 에 한 번 돌린 결과가
`output/artifact_export_2026-09-10.json` 에 있다: 계약 strict FAIL 0·WARN 0, 내용 대조 통과.
"""
import io
import json
import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "spark", "jobs"))
sys.path.insert(0, os.path.join(ROOT, "tests"))

import artifact_export as S6  # noqa: E402
import check_contract  # noqa: E402

SAMPLE_ROWS = 50
EXCLUDED_TOTAL = 780_107


def test_file_lists_match_contract():
    """번들 파일 목록이 계약 검사기의 필수 파일 목록과 같아야 한다."""
    assert set(S6.REQUIRED_FILES) == set(check_contract.REQ_FILES)
    assert set(S6.FROZEN_FILES) & set(S6.GENERATED_FILES) == set()
    assert "manifest.json" not in S6.FROZEN_FILES + S6.GENERATED_FILES


def test_sha256_matches_hashlib(tmp_path):
    import hashlib
    path = tmp_path / "x.bin"
    path.write_bytes(b"ody" * 1000)
    assert S6.sha256(str(path)) == hashlib.sha256(b"ody" * 1000).hexdigest()


def test_job_does_not_refit():
    """동결 파일을 다시 만들지 않는다(규칙 3). 복사만 한다."""
    source = io.open(os.path.join(ROOT, "spark", "jobs", "artifact_export.py"),
                     encoding="utf-8").read()
    body = source.split('"""', 2)[2]
    assert ".fit(" not in body
    assert "shutil.copy" in body


def test_build_manifest_has_every_contract_key():
    """manifest 가 계약의 필수 키와 strict 키를 모두 갖춘다."""
    prev = {"status": "PROMOTED (v2)", "k": 16, "n_features": 270, "seed": 42,
            "fit_sample": 1000000, "explained_variance": 0.7,
            "explained_variance_per_axis": [0.1] * 16, "extractor_version": "essentia",
            "cohort_fingerprints": [74], "correction": "M1", "pipeline": ["PCA-16"],
            "map_tree": {"max_depth": 6, "min_node": 300, "n_leaves": 4096,
                         "songs_per_leaf_median": 1799},
            "promoted_at": "2026-09-04 08:44:39", "promotion_gate": {"gate_id": "g"}}
    manifest = S6.build_manifest(prev, songs=6_624_399, excluded_total=EXCLUDED_TOTAL,
                                 rules_hash="deadbeef", catalog_path="work/catalog_v2.parquet",
                                 bundle_version="v2.1-pca16-2026-09-10",
                                 catalog_sha="abc", files={"coords_v2.parquet": "x"})
    for key in check_contract.MANIFEST_KEYS + check_contract.STRICT_KEYS:
        assert key in manifest, key
    assert manifest["songs_before_exclusion"] == 6_624_399 + EXCLUDED_TOTAL
    assert manifest["contract_version"] == "v1"
    assert manifest["promotion_gate"] == prev["promotion_gate"], "게이트는 다시 돌리지 않는다"
    assert manifest["explained_variance"] == prev["explained_variance"]


def test_single_parquet_requires_exactly_one(tmp_path):
    directory = tmp_path / "coords"
    directory.mkdir()
    (directory / "_SUCCESS").write_text("")
    with pytest.raises(ValueError):
        S6.single_parquet(str(directory))
    (directory / "part-0.parquet").write_bytes(b"")
    assert S6.single_parquet(str(directory)).endswith("part-0.parquet")
    (directory / "part-1.parquet").write_bytes(b"")
    with pytest.raises(ValueError):
        S6.single_parquet(str(directory))


# --- 실제 파일로 조립 -------------------------------------------------------

@pytest.fixture(scope="module")
def tiny_tables(bundle_dir, tmp_path_factory):
    """실제 번들에서 50행을 떼어 mbid 순으로 쓴 좌표·말단 노드 파일."""
    import pyarrow.compute as pc
    import pyarrow.parquet as pq

    stage = tmp_path_factory.mktemp("s6stage")
    out = []
    for src, columns, name in (
            (os.path.join(bundle_dir, "coords_v2.parquet"), ["mbid"] + S6.PC_COLUMNS, "coords.parquet"),
            (os.path.join(bundle_dir, "map_tree", "node_paths_v2.parquet"), ["mbid", "leaf_id"], "paths.parquet")):
        table = pq.ParquetFile(src).read_row_group(0, columns=columns).slice(0, SAMPLE_ROWS)
        table = table.take(pc.sort_indices(table, sort_keys=[("mbid", "ascending")]))
        path = str(stage / name)
        pq.write_table(table, path, compression="zstd")
        out.append(path)
    return out


@pytest.fixture(scope="module")
def tiny_bundle(bundle_dir, tiny_tables, tmp_path_factory):
    coords_file, paths_file = tiny_tables
    target = str(tmp_path_factory.mktemp("s6bundle") / "bundle")
    manifest = S6.assemble_bundle(target, coords_file, paths_file, bundle_dir,
                                  catalog_path=coords_file,   # 해시 대상이 있으면 된다
                                  excluded_total=EXCLUDED_TOTAL, rules_hash="deadbeef",
                                  bundle_version="v9.9-pca16-2026-09-10",
                                  status="CANDIDATE (테스트)")
    return target, manifest


def test_assembled_bundle_has_all_files(tiny_bundle):
    target, _manifest = tiny_bundle
    for rel in S6.REQUIRED_FILES:
        assert os.path.exists(os.path.join(target, *rel.split("/"))), rel


def test_frozen_files_are_copied_byte_for_byte(tiny_bundle, bundle_dir):
    """동결 파일은 재생산하지 않는다. 원본과 sha256 이 같아야 한다."""
    target, _manifest = tiny_bundle
    for rel in S6.FROZEN_FILES:
        assert S6.sha256(os.path.join(target, *rel.split("/"))) == \
               S6.sha256(os.path.join(bundle_dir, *rel.split("/"))), rel


def test_manifest_hashes_match_written_files(tiny_bundle):
    """manifest.files 의 sha256 이 실제 파일과 들어맞는다(strict 조건)."""
    target, manifest = tiny_bundle
    assert set(manifest["files"]) == set(S6.REQUIRED_FILES) - {"manifest.json"}
    for rel, digest in manifest["files"].items():
        assert S6.sha256(os.path.join(target, *rel.split("/"))) == digest, rel
    assert manifest["songs"] == SAMPLE_ROWS
    assert manifest["catalog_sha256"]
    stored = json.load(io.open(os.path.join(target, "manifest.json"), encoding="utf-8"))
    assert stored == manifest


def test_compare_bundle_passes_for_same_content(tiny_bundle, tmp_path):
    """같은 내용이면 통과한다. 좌표 오차 0, 말단 노드 일치 100%."""
    target, _manifest = tiny_bundle
    report = S6.compare_bundle(target, target)
    assert report["pass"] is True
    assert report["mbid_set_equal"] is True
    assert report["coords_max_abs_error"] == 0.0
    assert report["leaf_match_rate"] == 1.0
    assert report["rows_new"] == SAMPLE_ROWS


def test_compare_bundle_catches_coordinate_drift(tiny_bundle, tmp_path):
    """좌표가 임계 이상 흔들리면 대조가 잡아낸다."""
    import numpy as np
    import pyarrow as pa
    import pyarrow.parquet as pq

    target, _manifest = tiny_bundle
    drifted = str(tmp_path / "drifted")
    os.makedirs(os.path.join(drifted, "map_tree"))
    table = pq.read_table(os.path.join(target, "coords_v2.parquet"))
    pc1 = table.column("pc1").to_numpy(zero_copy_only=False).copy()
    pc1[0] += 1.0
    table = table.set_column(table.schema.get_field_index("pc1"), "pc1",
                             pa.array(pc1, type=pa.float32()))
    pq.write_table(table, os.path.join(drifted, "coords_v2.parquet"))
    import shutil
    shutil.copy(os.path.join(target, "map_tree", "node_paths_v2.parquet"),
                os.path.join(drifted, "map_tree", "node_paths_v2.parquet"))

    report = S6.compare_bundle(drifted, target)
    assert report["mbid_set_equal"] is True
    assert report["coords_max_abs_error"] >= 1.0
    assert report["coords_within_tolerance"] is False
    assert report["pass"] is False


def test_full_run_evidence_recorded():
    """전수 조립을 한 번 돌린 기록이 있어야 한다. 커밋 훅에서는 돌리지 않는다."""
    path = os.path.join(ROOT, "output", "artifact_export_2026-09-10.json")
    if not os.path.exists(path):
        pytest.skip("전수 조립 기록 없음")
    record = json.load(io.open(path, encoding="utf-8"))
    assert record["contract_strict_fail"] == 0
    assert record["songs"] == 6_624_399
    assert record["compare_to_v2.1-pca16"]["pass"] is True
    assert record["compare_to_v2.1-pca16"]["leaf_match_rate"] == 1.0
