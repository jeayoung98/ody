# -*- coding: utf-8 -*-
"""S7 적재 CSV 패리티 (스펙 18, Jira S15P21A405-385).

로컬 `ingest/build_csv.py` 와 클러스터 `spark/jobs/db_load_csv.py` 가 **같은 줄**을 내야 한다.
pyspark 없이 도는 검사다 — 줄을 만드는 함수만 부른다.
"""
import csv
import io
import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "ingest"))
sys.path.insert(0, os.path.join(ROOT, "spark", "jobs"))

import build_csv as B  # noqa: E402
import db_load_csv as S7  # noqa: E402

PC = {"pc{}".format(i): float(i) / 7.0 for i in range(1, 17)}
ROW = dict(PC, mbid="0e11c0fd-a1da-4b88-a438-7ef55c5809ec", title_raw="Time",
           artist_raw="Pink Floyd", length=412.9, bpm=115.44,
           album="The Dark Side of the Moon", release_year=1973.0,
           albumid="d6e9d69f-1111-2222-3333-444444444444", gnr="GN1400|GN1000")


def music_line_from_build_csv(song_id, row):
    """build_csv 가 쓰는 것과 같은 방식으로 한 줄을 만든다(write_csv 의 writer 설정)."""
    values, _t, _a, _al = B.music_row(
        song_id, row["mbid"], row["title_raw"], row["artist_raw"], row["bpm"], row["length"],
        [row[pc] for pc in B.PC_COLUMNS],
        (row["album"], row["release_year"], row["albumid"]))
    buffer = io.StringIO()
    csv.writer(buffer, lineterminator="").writerow(values)
    return buffer.getvalue()


def test_music_line_matches_build_csv():
    """같은 입력이면 두 경로가 글자 단위로 같은 줄을 낸다."""
    mine, _neo4j, _codes = S7.music_csv_line(42, ROW, {"GN1000": 1, "GN1400": 2})
    assert mine == music_line_from_build_csv(42, ROW)


@pytest.mark.parametrize("field,value", [
    ("title_raw", "제목,쉼표\"따옴표"),          # csv 따옴표 규칙
    ("title_raw", ""),                           # 빈 제목(3,977곡). COPY 가 FORCE_NOT_NULL 로 받는다
    ("artist_raw", None),
    ("album", "A" * 300),                        # VARCHAR(200) 절단
    ("release_year", 1799.0),                    # 범위 밖 → 빈 값
    ("release_year", None),
    ("albumid", "NOT-A-UUID"),                   # UUID 아니면 빈 값
    ("bpm", None),
    ("length", None),
])
def test_edge_values_match_build_csv(field, value):
    row = dict(ROW); row[field] = value
    mine, _neo4j, _codes = S7.music_csv_line(7, row, {"GN1000": 1, "GN1400": 2})
    assert mine == music_line_from_build_csv(7, row)


def test_vector_has_no_spaces_and_16_dims():
    """pgvector 는 '[v1,v2,...]' 를 받는다. 공백이 들어가면 COPY 가 깨진다."""
    line, _neo4j, _codes = S7.music_csv_line(1, ROW, {})
    vector = [part for part in next(csv.reader([line])) if part.startswith("[")][0]
    assert " " not in vector
    assert len(vector.strip("[]").split(",")) == 16


def test_genre_codes_are_sorted_and_deduped():
    """장르 코드는 정렬·중복 제거. id 매핑이 결정적이어야 링크가 어긋나지 않는다."""
    row = dict(ROW, gnr="GN1400|GN1000|GN1400")
    _line, neo4j, codes = S7.music_csv_line(1, row, {"GN1000": 1, "GN1400": 2})
    assert codes == ["GN1000", "GN1400"]
    assert neo4j.endswith("GN1000;GN1400")


def test_neo4j_line_uses_semicolon_separator():
    """LOAD CSV 가 split(';') 로 읽는다. 좌표도 같은 구분자다."""
    _line, neo4j, _codes = S7.music_csv_line(3, ROW, {"GN1000": 1, "GN1400": 2})
    fields = next(csv.reader([neo4j]))
    assert fields[0] == "3" and fields[1] == ROW["mbid"]
    assert len(fields[2].split(";")) == 16


def test_csv_line_matches_write_csv_quoting():
    """줄 만들기 규칙 자체가 build_csv.write_csv 와 같은지 본다."""
    values = ["1", 'a"b', "c,d", "e\nf", ""]
    buffer = io.StringIO()
    csv.writer(buffer, lineterminator="").writerow(values)
    assert S7.csv_line(values) == buffer.getvalue()


def test_headers_cover_all_four_tables():
    assert S7.TABLES == ("music", "genre", "music_genre", "neo4j_music")
    assert B.MUSIC_COLUMNS[0] == "id" and B.MUSIC_COLUMNS[-1] == "album_mbid"
