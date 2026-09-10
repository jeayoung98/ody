# -*- coding: utf-8 -*-
"""S6 serving 번들 내보내기 (spec 20, Jira S15P21A405-132).

    S5 카탈로그 + S3 좌표 + S4 말단 노드  →  serving/<v>/ 계약 v1 파일 묶음

파이프라인의 마지막 단계다. 계약은 `specs/00_artifact_contract/spec.md`, 검사기는
`tests/check_contract.py` 다.

## 두 부분으로 나뉜다
1. **Spark** — `excluded == False` 인 행만 남겨 좌표·말단 노드를 만들고, 카탈로그도 같은
   정렬로 다시 쓴다. 전부 `mbid` 오름차순이다(아래 참조).
2. **드라이버** — 동결 파일 7개를 그대로 복사하고 `manifest.json` 을 만든다. 이 부분은 분산할
   일이 없다. 파일 7개 복사와 sha256 계산이 전부다.

## 왜 mbid 오름차순으로 정렬하나
서빙은 **정렬 불변식**에 의존한다: `coords` 의 i번째 행은 카탈로그에서 `excluded == False`
인 i번째 행이다(`retrieval/artifact.py`). 이 하나로 좌표·메타데이터·kNN 그래프를 정수 색인
하나로 다룬다.

분산 환경에서 "입력 파일에 적힌 순서"는 보장되지 않는다. 그래서 S6 은 세 표를 **같은 키로
명시적으로 정렬**해 불변식을 성립시킨다. `mbid` 는 유일하므로 정렬이 완전히 결정적이다.

같은 이유로 이 잡은 카탈로그도 다시 쓴다. 좌표만 정렬하고 카탈로그를 입력 그대로 두면
불변식이 깨진다.

## 동결 파일은 만들지 않는다 (규칙 3)
`model_bundle.npz`, `feature_list.json`, `fit_manifest.json`, `postprocess_rules.json`,
`map_tree/tree.json`, `map_tree/split_axes.npz`, `map_tree/quality_by_depth.csv` 는 fit 산물이라
**복사만** 한다. `promotion_gate` 도 이전 manifest 의 기록을 그대로 싣는다. 게이트를 다시
돌리는 것은 별도 결정이다.

## 계약 검사 기준을 하나 바꿨다 (규칙 1)
스펙 20 은 S6 완료 조건을 `check_contract --strict --prev` 통과로 적었다. 그런데 `--prev` 는
`coords_v2.parquet`·`node_paths_v2.parquet`·`split_axes.npz`·`model_bundle.npz` 의 sha256 이
이전 번들과 **바이트 단위로** 같기를 요구한다(minor 버전 규칙). Spark 가 쓴 parquet 는 numpy
파이프라인이 쓴 parquet 와 바이트가 같을 수 없다. 압축기·행 그룹·정렬이 다르다.

그래서 `--prev` 대신 **내용 대조**(`compare_bundle`)를 새 판정 기준으로 등록한다: mbid 집합
동일, 좌표 최대 절대 오차 < 1e-4, 말단 노드 일치 100%. 원래 문장은 스펙에 그대로 남기고 왜
바꿨는지 함께 적는다.
"""
import argparse
import datetime
import hashlib
import io
import json
import os
import shutil

FROZEN_FILES = ["model_bundle.npz", "feature_list.json", "fit_manifest.json",
                "postprocess_rules.json", "map_tree/tree.json", "map_tree/split_axes.npz",
                "map_tree/quality_by_depth.csv"]
GENERATED_FILES = ["coords_v2.parquet", "map_tree/node_paths_v2.parquet"]
REQUIRED_FILES = ["manifest.json"] + GENERATED_FILES + FROZEN_FILES
PC_COLUMNS = ["pc{}".format(i) for i in range(1, 17)]
CONTRACT_VERSION = "v1"
SORT_KEY = "mbid"
COORDS_TOLERANCE = 1e-4

# manifest 에서 그대로 물려받는 키. fit 이 바뀌지 않았으므로 새로 계산하지 않는다(규칙 3).
INHERITED_KEYS = ["k", "n_features", "seed", "fit_sample", "explained_variance",
                  "explained_variance_per_axis", "extractor_version", "cohort_fingerprints",
                  "correction", "pipeline", "note", "map_tree", "promoted_at", "promotion_gate"]


def sha256(path, block=1 << 24):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(block), b""):
            digest.update(chunk)
    return digest.hexdigest()


# --------------------------------------------------------------------------
# Spark — 정렬된 세 표
# --------------------------------------------------------------------------
def export_tables(spark, catalog_path, coords_path, node_paths_path, out_dir):
    """세 표를 `mbid` 오름차순으로 내보낸다. 좌표·말단 노드는 남는 곡만.

    출력 디렉터리 세 개: `<out>/catalog`, `<out>/coords`, `<out>/node_paths`.
    좌표와 말단 노드는 한 파일로 합친다(계약이 파일 하나를 요구한다).
    """
    from pyspark.sql import functions as F

    catalog = spark.read.parquet(catalog_path)
    kept = catalog.filter(~F.col("excluded")).select(SORT_KEY)
    coords = spark.read.parquet(coords_path).join(kept, SORT_KEY, "inner")
    node_paths = spark.read.parquet(node_paths_path).join(kept, SORT_KEY, "inner")

    join = os.path.join
    (catalog.orderBy(SORT_KEY).write.mode("overwrite").parquet(join(out_dir, "catalog")))
    (coords.select(SORT_KEY, *PC_COLUMNS).orderBy(SORT_KEY)
     .coalesce(1).write.mode("overwrite").parquet(join(out_dir, "coords")))
    (node_paths.select(SORT_KEY, "leaf_id").orderBy(SORT_KEY)
     .coalesce(1).write.mode("overwrite").parquet(join(out_dir, "node_paths")))

    songs = coords.count()
    return {"stage": "S6-export", "catalog_rows": catalog.count(), "songs": songs,
            "excluded_total": catalog.filter("excluded").count(),
            "sort_key": SORT_KEY, "out_dir": out_dir,
            "invariant": "coords·node_paths·catalog 모두 mbid 오름차순. "
                         "coords 의 i번째 행 = 카탈로그의 excluded=false i번째 행"}


# --------------------------------------------------------------------------
# 드라이버 — 동결 파일 복사 + manifest
# --------------------------------------------------------------------------
def build_manifest(prev_manifest, songs, excluded_total, rules_hash, catalog_path,
                   bundle_version, status=None, catalog_sha=None, files=None):
    """계약 v1 manifest. fit 관련 키는 이전 manifest 에서 물려받는다."""
    manifest = {"bundle_version": bundle_version,
                "status": status or prev_manifest.get("status", "CANDIDATE (S6 export)")}
    for key in INHERITED_KEYS:
        if key in prev_manifest:
            manifest[key] = prev_manifest[key]
    manifest.update({
        "songs": int(songs),
        "songs_before_exclusion": int(songs) + int(excluded_total),
        "excluded_total": int(excluded_total),
        "exclusion_rules": "pipeline/exclusion_rules.json",
        "exclusion_rules_hash": rules_hash,
        "catalog": catalog_path,
        "contract_version": CONTRACT_VERSION,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "produced_by": "spark/jobs/artifact_export.py (S6)",
        "sort_key": SORT_KEY,
    })
    if catalog_sha:
        manifest["catalog_sha256"] = catalog_sha
    if files:
        manifest["files"] = files
    return manifest


def assemble_bundle(out_bundle, coords_file, node_paths_file, frozen_from, catalog_path,
                    excluded_total, rules_hash, bundle_version, status=None):
    """번들 디렉터리를 만든다. 좌표·말단 노드 파일은 이미 한 파일로 합쳐져 있어야 한다."""
    import pyarrow.parquet as pq

    os.makedirs(os.path.join(out_bundle, "map_tree"), exist_ok=True)
    for rel in FROZEN_FILES:                      # 동결 파일은 복사만 한다(규칙 3)
        source = os.path.join(frozen_from, *rel.split("/"))
        shutil.copy(source, os.path.join(out_bundle, *rel.split("/")))
    shutil.copy(coords_file, os.path.join(out_bundle, "coords_v2.parquet"))
    shutil.copy(node_paths_file, os.path.join(out_bundle, "map_tree", "node_paths_v2.parquet"))

    songs = pq.ParquetFile(os.path.join(out_bundle, "coords_v2.parquet")).metadata.num_rows
    prev = json.load(io.open(os.path.join(frozen_from, "manifest.json"), encoding="utf-8"))
    files = {rel: sha256(os.path.join(out_bundle, *rel.split("/")))
             for rel in REQUIRED_FILES if rel != "manifest.json"}
    catalog_sha = sha256(catalog_path) if os.path.exists(catalog_path) else None
    manifest = build_manifest(prev, songs, excluded_total, rules_hash, catalog_path,
                              bundle_version, status, catalog_sha, files)
    with io.open(os.path.join(out_bundle, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)
    return manifest


def compare_bundle(new_bundle, ref_bundle, tolerance=COORDS_TOLERANCE):
    """내용 대조. sha256 이 아니라 값을 본다(모듈 docstring 참조).

    반환: mbid 집합 동일 여부, 좌표 최대 절대 오차, 말단 노드 일치율.
    """
    import numpy as np
    import pyarrow.parquet as pq

    def coords_of(bundle):
        table = pq.read_table(os.path.join(bundle, "coords_v2.parquet"))
        mbids = [m.lower() for m in table.column(SORT_KEY).to_pylist()]
        matrix = np.column_stack([table.column(pc).to_numpy(zero_copy_only=False)
                                  for pc in PC_COLUMNS]).astype(np.float64)
        return mbids, matrix

    def leaves_of(bundle):
        table = pq.read_table(os.path.join(bundle, "map_tree", "node_paths_v2.parquet"))
        return dict(zip([m.lower() for m in table.column(SORT_KEY).to_pylist()],
                        table.column("leaf_id").to_pylist()))

    new_mbids, new_coords = coords_of(new_bundle)
    ref_mbids, ref_coords = coords_of(ref_bundle)
    same_set = set(new_mbids) == set(ref_mbids)
    report = {"rows_new": len(new_mbids), "rows_ref": len(ref_mbids),
              "mbid_set_equal": same_set, "tolerance": tolerance}
    if same_set:
        order = {mbid: i for i, mbid in enumerate(ref_mbids)}
        take = np.array([order[mbid] for mbid in new_mbids])
        max_error = float(np.abs(new_coords - ref_coords[take]).max())
        report["coords_max_abs_error"] = max_error
        report["coords_within_tolerance"] = max_error < tolerance
        new_leaves, ref_leaves = leaves_of(new_bundle), leaves_of(ref_bundle)
        matched = sum(1 for mbid, leaf in new_leaves.items() if ref_leaves.get(mbid) == leaf)
        report["leaf_match"] = matched
        report["leaf_match_rate"] = matched / max(len(new_leaves), 1)
    report["pass"] = bool(same_set and report.get("coords_within_tolerance")
                          and report.get("leaf_match_rate") == 1.0)
    return report


def single_parquet(directory):
    """Spark 가 쓴 디렉터리에서 part 파일 하나를 찾는다. coalesce(1) 이면 하나뿐이다."""
    parts = sorted(f for f in os.listdir(directory) if f.endswith(".parquet"))
    if len(parts) != 1:
        raise ValueError("{} 에 parquet 이 {}개다. coalesce(1) 로 써야 한다".format(directory, len(parts)))
    return os.path.join(directory, parts[0])


def main():
    ap = argparse.ArgumentParser(description="S6 serving 번들 내보내기")
    ap.add_argument("--catalog", required=True, help="S5 출력 (hdfs:///...)")
    ap.add_argument("--coords", required=True, help="S3 출력")
    ap.add_argument("--node-paths", dest="node_paths", required=True, help="S4 출력")
    ap.add_argument("--out", required=True, help="정렬된 세 표를 쓸 디렉터리 (hdfs:///...)")
    args = ap.parse_args()

    from pyspark.sql import SparkSession
    spark = SparkSession.builder.appName("ody-artifact-export").getOrCreate()
    try:
        report = export_tables(spark, args.catalog, args.coords, args.node_paths, args.out)
        print(json.dumps(report, ensure_ascii=False))
    finally:
        spark.stop()
    print("다음: 세 표를 로컬로 내린 뒤 assemble_bundle 로 번들을 만든다. spark/README.md 참조")


if __name__ == "__main__":
    main()
