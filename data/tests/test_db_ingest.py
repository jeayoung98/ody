# -*- coding: utf-8 -*-
"""스펙 18 적재 CSV 검증 (Jira S15P21A405-209).

    coords_v2.parquet  →  music.csv (id 1..6,624,399) · genre.csv · music_genre.csv

DB 없이 도는 검사다. 값 변환 규칙은 합성 입력으로, **실제 좌표 왕복과 id 부여**는
번들에서 뽑은 표본으로 확인한다.
"""
import io
import os
import sys

import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "ingest"))

import build_csv as S18  # noqa: E402

TARGET_ROWS = 6_624_399
SAMPLE_ROWS = 1000


# --- 값 변환 ---------------------------------------------------------------

def test_music_columns_match_real_schema():
    """BE 가 만든 실제 컬럼 순서·개수와 같아야 COPY 가 통한다."""
    assert S18.MUSIC_COLUMNS == ["id", "mbid", "title", "artist", "release_year", "bpm",
                                 "duration", "album", "youtube_url", "location",
                                 "play_cnt", "youtube_cnt"]
    assert S18.GENRE_COLUMNS == ["id", "name"]
    assert S18.MUSIC_GENRE_COLUMNS == ["id", "music_id", "genre_id"], "mbid 가 아니라 music_id 다"


def test_vector_round_trip_keeps_float32_bits():
    """float32 값이 텍스트를 거쳐도 비트가 같아야 한다(AC2 좌표 불변성)."""
    rng = np.random.default_rng(3)
    values = rng.normal(0, 30, size=16).astype(np.float32)
    text = S18.format_vector(values)
    assert text.startswith("[") and text.endswith("]") and " " not in text
    assert np.array_equal(S18.parse_vector(text).view(np.uint32), values.view(np.uint32))


def test_bpm_fits_numeric_5_1():
    """NUMERIC(5,1) 을 넘거나 결측이면 NULL(빈 문자열)."""
    assert S18.format_bpm(128.34) == "128.3"
    assert S18.format_bpm(None) == ""
    assert S18.format_bpm(float("nan")) == ""
    assert S18.format_bpm(-1.0) == ""
    assert S18.format_bpm(99999.0) == "", "NUMERIC(5,1) 상한을 넘으면 넣지 않는다"
    assert len(S18.format_bpm(9999.9).replace(".", "").replace("-", "")) <= 5


def test_duration_is_rounded_seconds():
    assert S18.format_duration(212.3733) == "212"
    assert S18.format_duration(None) == ""
    assert S18.format_duration(float("inf")) == ""


def test_text_is_clipped_to_column_limits():
    long_title, cut = S18.clip_text("가" * 300, S18.TITLE_MAX)
    assert len(long_title) == 200 and cut is True
    short, cut = S18.clip_text("짧은 제목", S18.TITLE_MAX)
    assert short == "짧은 제목" and cut is False
    assert S18.clip_text(None, S18.TITLE_MAX) == ("", False), "NOT NULL 이라 빈 문자열로 낸다"


def test_genres_split_on_pipe_and_sorted():
    assert S18.split_genres("GN1400|GN1000") == ["GN1000", "GN1400"]
    assert S18.split_genres("GN1000|GN1000") == ["GN1000"], "중복 코드는 한 번만"
    assert S18.split_genres(None) == []
    assert S18.split_genres("") == []


def test_three_columns_are_left_null():
    """release_year·album·youtube_url 은 출처가 없어 비운다(D11)."""
    row, _t, _a = S18.music_row(1, "m", "t", "a", 120.0, 200.0, np.zeros(16, np.float32))
    fields = dict(zip(S18.MUSIC_COLUMNS, row))
    assert fields["release_year"] == ""
    assert fields["album"] == ""
    assert fields["youtube_url"] == ""
    assert fields["play_cnt"] == 0 and fields["youtube_cnt"] == 0


# --- 실제 데이터 -----------------------------------------------------------

@pytest.fixture(scope="module")
def sample_bundle(bundle_dir, tmp_path_factory):
    """실제 번들 좌표에서 표본을 떼어 작은 coords parquet 을 만든다."""
    import pyarrow.compute as pc
    import pyarrow.parquet as pq

    table = pq.ParquetFile(os.path.join(bundle_dir, "coords_v2.parquet")).read_row_group(
        0, columns=["mbid"] + S18.PC_COLUMNS).slice(0, SAMPLE_ROWS)
    table = table.take(pc.sort_indices(table, sort_keys=[("mbid", "ascending")]))
    path = str(tmp_path_factory.mktemp("s18") / "coords_sample.parquet")
    pq.write_table(table, path)
    return path, table


def test_build_assigns_ids_by_mbid_order(sample_bundle, tmp_path, root):
    """id 는 mbid 오름차순 1..N. 좌표는 비트 단위로 같다."""
    coords_path, table = sample_bundle
    work = os.environ.get("ODY_WORK") or os.path.join(root, "work")
    catalog = os.path.join(work, "catalog_v2.parquet")
    meta = os.path.join(work, "v2_song_meta.parquet")
    if not (os.path.exists(catalog) and os.path.exists(meta)):
        pytest.skip("catalog_v2.parquet 또는 v2_song_meta.parquet 없음")

    out = str(tmp_path / "csv")
    report = S18.build(out, coords_path=coords_path, catalog_path=catalog, meta_path=meta,
                       feats_dir=os.path.join(work, "v2_feats"))
    assert report["music_rows"] == SAMPLE_ROWS
    assert report["id_range"] == [1, SAMPLE_ROWS]
    assert report["next_music_id_for_backend"] == SAMPLE_ROWS + 1
    assert report["null_columns"] == ["release_year", "album", "youtube_url"]

    import csv
    with io.open(os.path.join(out, "music.csv"), encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    assert len(rows) == SAMPLE_ROWS
    assert [int(r["id"]) for r in rows] == list(range(1, SAMPLE_ROWS + 1))
    mbids = [r["mbid"] for r in rows]
    assert mbids == sorted(mbids), "mbid 오름차순이어야 id 가 결정적이다"
    assert len(set(mbids)) == SAMPLE_ROWS
    assert all(S18.UUID_RE.match(m) for m in mbids)
    assert all(r["release_year"] == "" and r["album"] == "" and r["youtube_url"] == ""
               for r in rows)
    assert all(len(r["title"]) <= S18.TITLE_MAX and len(r["artist"]) <= S18.ARTIST_MAX
               for r in rows)

    truth = {m.lower(): np.array([table.column(pc)[i].as_py() for pc in S18.PC_COLUMNS],
                                 dtype=np.float32)
             for i, m in enumerate(table.column("mbid").to_pylist())}
    for row in rows[:200]:
        got = S18.parse_vector(row["location"])
        assert np.array_equal(got.view(np.uint32), truth[row["mbid"]].view(np.uint32)), row["mbid"]


def test_genre_csv_links_by_music_id(sample_bundle, tmp_path, root):
    """music_genre 는 music_id 로 잇는다. genre_id 는 genre.csv 에 있는 값이다."""
    import csv
    coords_path, _table = sample_bundle
    work = os.environ.get("ODY_WORK") or os.path.join(root, "work")
    meta = os.path.join(work, "v2_song_meta.parquet")
    catalog = os.path.join(work, "catalog_v2.parquet")
    if not (os.path.exists(catalog) and os.path.exists(meta)):
        pytest.skip("입력 parquet 없음")

    out = str(tmp_path / "csv2")
    S18.build(out, coords_path=coords_path, catalog_path=catalog, meta_path=meta,
              feats_dir=os.path.join(work, "v2_feats"))
    with io.open(os.path.join(out, "genre.csv"), encoding="utf-8", newline="") as fh:
        genre_rows = list(csv.DictReader(fh))
    with io.open(os.path.join(out, "music_genre.csv"), encoding="utf-8", newline="") as fh:
        link_rows = list(csv.DictReader(fh))

    genre_ids = {int(r["id"]) for r in genre_rows}
    assert genre_ids == set(range(1, len(genre_rows) + 1))
    assert all(len(r["name"]) <= S18.GENRE_NAME_MAX for r in genre_rows)
    for row in link_rows:
        assert int(row["genre_id"]) in genre_ids
        assert 1 <= int(row["music_id"]) <= SAMPLE_ROWS
    assert [int(r["id"]) for r in link_rows] == list(range(1, len(link_rows) + 1))


def test_full_run_evidence(root):
    """전수 CSV 를 만든 기록이 있으면 수치를 검사한다. 커밋 훅에서는 만들지 않는다."""
    import json
    path = os.path.join(root, "output", "db_ingest_csv_2026-09-10.json")
    if not os.path.exists(path):
        pytest.skip("전수 CSV 기록 없음")
    report = json.load(io.open(path, encoding="utf-8"))
    assert report["music_rows"] == TARGET_ROWS
    assert report["id_range"] == [1, TARGET_ROWS]
    assert report["genre_rows"] == 29, "멜론 대분류 코드 종류"
    # 브릿지의 장르 보유 곡은 manifest 기준 67,472 곡이다. 그중 1,436 곡이 S5 제외 규칙에
    # 걸려 coords 에 없다. 적재 대상은 66,036 곡이고 코드 링크는 71,285 개다(곡당 복수 코드).
    assert report["songs_with_genre"] == 66_036
    assert report["music_genre_rows"] == 71_285
    assert report["songs_without_genre"] == TARGET_ROWS - 66_036
    # v2_feats 가 28/30 파트라 bpm 이 없는 곡이 있다. coords 에만 있는 733,146 곡과 같다(Q7).
    assert report["missing_bpm"] == 733_146
    assert report["missing_catalog"] == 0
