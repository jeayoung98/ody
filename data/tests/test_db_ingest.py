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
                                 "play_cnt", "youtube_cnt", "album_mbid"], \
        "album_mbid 는 BE 가 2026-09-13 추가(D17). COPY 컬럼 목록(load_postgres.sh)과 같아야 한다"
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


def test_meta_fills_album_year_and_mbid():
    """재패스 메타가 있으면 album·release_year·album_mbid 가 채워진다(D17). youtube_url 만 빈다."""
    meta = ("The Dark Side of the Moon", 1973, "d6e9d69f-b689-3af8-9fd4-eef9b645f62d")
    row, _t, _a, album_cut = S18.music_row(1, "m", "t", "a", 120.0, 200.0,
                                           np.zeros(16, np.float32), meta)
    fields = dict(zip(S18.MUSIC_COLUMNS, row))
    assert fields["album"] == "The Dark Side of the Moon" and album_cut is False
    assert fields["release_year"] == "1973"
    assert fields["album_mbid"] == "d6e9d69f-b689-3af8-9fd4-eef9b645f62d"
    assert fields["youtube_url"] == "", "전곡 video_id 는 채우지 않는다(D11·D15)"
    assert fields["play_cnt"] == 0 and fields["youtube_cnt"] == 0


def test_meta_missing_leaves_columns_null():
    """메타가 없는 곡은 예전과 같이 빈 값. 범위 밖 연도·UUID 아닌 albumid 도 빈 값."""
    row, _t, _a, _c = S18.music_row(1, "m", "t", "a", 120.0, 200.0, np.zeros(16, np.float32))
    fields = dict(zip(S18.MUSIC_COLUMNS, row))
    assert fields["album"] == "" and fields["release_year"] == "" and fields["album_mbid"] == ""
    assert S18.format_year(1899) == "" and S18.format_year(2027) == ""
    assert S18.format_year(float("nan")) == "" and S18.format_year("1973") == "1973"
    assert S18.format_album_mbid("not-a-uuid") == ""
    assert S18.format_album_mbid("D6E9D69F-B689-3AF8-9FD4-EEF9B645F62D") == \
        "d6e9d69f-b689-3af8-9fd4-eef9b645f62d", "소문자로 정규화"
    long_album, cut = S18.clip_text("앨" * 300, S18.ALBUM_MAX)
    assert len(long_album) == 200 and cut is True


def test_meta_merge_picks_representative_then_mode():
    """meta_merge: 대표 제출본 값이 있으면 그것, 없으면 최빈값. min 은 오태그를 집는다."""
    import pandas as pd
    sys.path.insert(0, os.path.join(ROOT, "ingest"))
    import meta_merge as MM
    assert MM.year_of("1973-03-24") == 1973 and MM.year_of("1994") == 1994
    assert np.isnan(MM.year_of("0000")) and np.isnan(MM.year_of("")) and np.isnan(MM.year_of(None))
    # Pink Floyd 'Time' 축소판: 1973 x3, 1966 x1(오태그), 1994 x1(리마스터). 대표 제출본 없음 → 최빈값 1973
    rows = pd.DataFrame({"mbid": ["a"] * 5 + ["b"] * 2,
                         "is_rep": [False] * 5 + [False, True],
                         "year_any": [1973.0, 1966.0, 1973.0, 1994.0, 1973.0, 2001.0, 1999.0]})
    picked = MM.pick_value(rows, "year_any")
    assert picked["a"] == 1973, "min 이었으면 1966"
    assert picked["b"] == 1999, "대표 제출본이 있으면 최빈값(2001 과 동률)보다 우선"


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
    assert report["null_columns"] == ["youtube_url"]

    import csv
    with io.open(os.path.join(out, "music.csv"), encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    assert len(rows) == SAMPLE_ROWS
    assert [int(r["id"]) for r in rows] == list(range(1, SAMPLE_ROWS + 1))
    mbids = [r["mbid"] for r in rows]
    assert mbids == sorted(mbids), "mbid 오름차순이어야 id 가 결정적이다"
    assert len(set(mbids)) == SAMPLE_ROWS
    assert all(S18.UUID_RE.match(m) for m in mbids)
    assert all(r["youtube_url"] == "" for r in rows)
    assert all(r["release_year"] == "" or 1900 <= int(r["release_year"]) <= 2026 for r in rows)
    assert all(r["album_mbid"] == "" or S18.UUID_RE.match(r["album_mbid"]) for r in rows)
    if report["inputs"]["album_meta"]:
        # 재패스 메타가 있으면 표본 1,000곡에서도 대부분 채워져야 한다(전수 99.3% / 96.4% / 69.0%)
        assert report["album_filled"] >= SAMPLE_ROWS * 0.95
        assert report["release_year_filled"] >= SAMPLE_ROWS * 0.90
        assert report["album_mbid_filled"] >= SAMPLE_ROWS * 0.55
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


def test_feature_dirs_include_pilot():
    """특징은 두 디렉터리에 나뉘어 있다. 하나만 읽으면 786,903행이 빠진다(D16)."""
    dirs = S18.feature_dirs("work")
    assert [os.path.basename(d) for d in dirs] == ["v2_feats", "v2_feats_pilot"]


def test_full_run_evidence(root):
    """전수 CSV 를 만든 기록이 있으면 수치를 검사한다. 커밋 훅에서는 만들지 않는다."""
    import json
    path = os.path.join(root, "output", "db_ingest_csv_2026-09-11.json")
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
    # 2026-09-11 정정(D16): 733,146곡 bpm 결측은 파트 누락이 아니라 v2_feats_pilot 를
    # 안 읽어서였다. 두 디렉터리를 읽으면 결측이 없다.
    assert report["missing_bpm"] == 0
    assert report["missing_catalog"] == 0


def test_full_run_evidence_2026_09_13(root):
    """재패스 반영 전수 CSV 기록(D17). album·release_year·album_mbid 가 채워졌고 bpm 결측이 없다."""
    import json
    path = os.path.join(root, "output", "db_ingest_csv_2026-09-13.json")
    if not os.path.exists(path):
        pytest.skip("재패스 반영 전수 CSV 기록 없음")
    report = json.load(io.open(path, encoding="utf-8"))
    assert report["music_rows"] == TARGET_ROWS
    assert report["missing_bpm"] == 0, "v2_feats + v2_feats_pilot 둘 다 읽는다(D16)"
    assert report["album_filled"] >= 6_580_000          # 99.3%
    assert report["release_year_filled"] >= 6_380_000   # 96.3%
    assert report["album_mbid_filled"] >= 4_560_000     # 68.9%
    assert report["null_columns"] == ["youtube_url"]
