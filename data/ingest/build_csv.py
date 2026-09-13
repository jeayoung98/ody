# -*- coding: utf-8 -*-
"""스펙 18 적재 1단계 — COPY 용 CSV 만들기 (Jira S15P21A405-209).

    coords_v2.parquet + catalog_v2 + v2_song_meta + v2_feats + v2_meta
      →  music.csv (6,624,399행) · genre.csv · music_genre.csv · neo4j_music.csv

적재 대상은 **`coords_v2.parquet` 에 있는 곡**이다. 그 파일이 S1·S5 를 지나온 체크포인트이고,
곡을 자르는 일은 파이프라인이 한다(스펙 20). 이 스크립트는 자르지 않고 행 수만 검증한다.

## 실제 스키마를 따른다
BE 가 만든 테이블이 스펙 18 초안과 다르다. 실제 DDL 기준으로 낸다.

    music        id BIGINT PK · mbid VARCHAR(64) · title VARCHAR(200) NOT NULL
                 artist VARCHAR(500) · release_year SMALLINT · bpm NUMERIC(5,1)
                 duration INT · album VARCHAR(200) · youtube_url TEXT
                 location VECTOR(16) · play_cnt INT NOT NULL · youtube_cnt INT NOT NULL
                 album_mbid VARCHAR(36)                       -- BE 가 2026-09-13 추가
    genre        id BIGINT PK · name VARCHAR(100)
    music_genre  id BIGINT PK · music_id BIGINT · genre_id BIGINT

`music.id` 에 DEFAULT·IDENTITY·시퀀스가 없다. 그래서 **우리가 값을 넣는다.**

## id 부여 (사용자 결정 2026-09-10)
`mbid` 오름차순으로 정렬해 1부터 붙인다. mbid 는 유일하므로 같은 입력이면 항상 같은 id 다.
재적재해도 id 가 흔들리지 않는다. 적재 뒤 BE 에게 **새 곡은 6,624,400 부터** 쓰라고 알린다.

`music_genre` 는 mbid 가 아니라 `music_id` 를 보므로 장르도 이 매핑을 거친다.

## album · release_year · album_mbid — 재패스로 채운다 (D17)
D11 은 "원본 재패스가 필요해 1차 NULL" 이었다. 2026-09-13 에 `ingest/meta_pass.py` 로 덤프의
`metadata.tags` 만 다시 읽어 `work/v2_meta.parquet`(곡 단위)을 만들었다. 커버리지 album 99.33% ·
release_year 96.37% · albumid 68.96%. 규칙은 `meta_merge.py` 에 있다(대표 제출본 우선, 없으면 최빈값).
`v2_meta.parquet` 이 없으면 세 컬럼은 예전처럼 빈 값으로 나가고 리포트에 `album_meta: null` 이 남는다.

## 비워 두는 컬럼
`youtube_url` 만 빈 값이다. 전곡 `video_id` 확보는 하지 않는다(D11·D15). 검색 URL 은 BE 가 조회 시 만든다.

## location 은 float32 가 그대로 오가야 한다
`repr(float(x))` 는 double 로 왕복하는 최단 표기다. 원값이 float32 였으므로 pgvector 의
float4 로 되돌려도 비트가 같다. 스펙 18 AC2(좌표 불변성)가 이걸 요구한다.
"""
import argparse
import csv
import io
import json
import os
import re

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PC_COLUMNS = ["pc{}".format(i) for i in range(1, 17)]
MUSIC_COLUMNS = ["id", "mbid", "title", "artist", "release_year", "bpm", "duration",
                 "album", "youtube_url", "location", "play_cnt", "youtube_cnt", "album_mbid"]
GENRE_COLUMNS = ["id", "name"]
MUSIC_GENRE_COLUMNS = ["id", "music_id", "genre_id"]
NEO4J_COLUMNS = ["id", "mbid", "location", "genres"]

TITLE_MAX = 200          # VARCHAR(200) NOT NULL
ARTIST_MAX = 500         # VARCHAR(500)
ALBUM_MAX = 200          # VARCHAR(200). 200자 초과 387곡(2026-09-13 실측)은 잘린다
YEAR_MIN, YEAR_MAX = 1900, 2026   # SMALLINT. meta_merge 가 같은 범위로 걸렀다
GENRE_NAME_MAX = 100
BPM_MAX = 9999.9         # NUMERIC(5,1)
GENRE_SEPARATOR = "|"    # v2_song_meta.gnr 이 여러 코드를 이 문자로 잇는다
NEO4J_SEPARATOR = ";"    # LOAD CSV 에서 split() 할 문자
CHUNK = 200_000
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


# --------------------------------------------------------------------------
# 값 변환 — 전부 실제 컬럼 타입에 맞춘다
# --------------------------------------------------------------------------
def format_vector(values):
    """float32 16개 → pgvector text. `[v1,v2,...]` 이고 공백이 없다."""
    return "[" + ",".join(repr(float(v)) for v in values) + "]"


def parse_vector(text):
    """format_vector 의 역. 테스트가 왕복을 확인한다."""
    return np.array([float(x) for x in text.strip("[]").split(",")], dtype=np.float32)


def clip_text(value, limit):
    """VARCHAR 상한을 넘으면 자른다. (잘린 문자열, 잘랐는지) 를 준다."""
    text = "" if value is None else str(value)
    if len(text) <= limit:
        return text, False
    return text[:limit], True


def format_bpm(value):
    """NUMERIC(5,1). 결측·비유한·범위 밖은 빈 값(NULL)."""
    if value is None:
        return ""
    number = float(value)
    if not np.isfinite(number) or number < 0 or number > BPM_MAX:
        return ""
    return "{:.1f}".format(number)


def format_duration(value):
    """INT(초). 원본은 float 초라 반올림한다. 결측은 NULL."""
    if value is None:
        return ""
    number = float(value)
    if not np.isfinite(number) or number < 0:
        return ""
    return str(int(round(number)))


def split_genres(value):
    """`GN1400|GN1000` → ['GN1000', 'GN1400']. 코드는 정렬해 결정적으로 만든다."""
    if not value:
        return []
    codes = {code.strip()[:GENRE_NAME_MAX] for code in str(value).split(GENRE_SEPARATOR)}
    return sorted(code for code in codes if code)


def format_year(value):
    """SMALLINT. 결측·범위 밖은 NULL."""
    if value is None:
        return ""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return ""
    if not np.isfinite(number) or not (YEAR_MIN <= number <= YEAR_MAX):
        return ""
    return str(int(number))


def format_album_mbid(value):
    """VARCHAR(36). 소문자 UUID 가 아니면 NULL — BE 가 이 값으로 커버 URL 을 만든다."""
    text = "" if value is None else str(value).strip().lower()
    return text if UUID_RE.match(text) else ""


EMPTY_META = (None, None, None)   # (album, release_year, album_mbid)


def music_row(song_id, mbid, title, artist, bpm, length, vector, meta=EMPTY_META):
    """music 테이블 한 행. meta = (album, release_year, album_mbid). youtube_url 만 비운다(D11·D15).

    (row, title_cut, artist_cut, album_cut) 을 준다.
    """
    album, release_year, album_mbid = meta
    title_text, title_cut = clip_text(title, TITLE_MAX)
    artist_text, artist_cut = clip_text(artist, ARTIST_MAX)
    album_text, album_cut = clip_text(album, ALBUM_MAX)
    row = [song_id, mbid, title_text, artist_text, format_year(release_year), format_bpm(bpm),
           format_duration(length), album_text, "", format_vector(vector), 0, 0,
           format_album_mbid(album_mbid)]
    return row, title_cut, artist_cut, album_cut


# --------------------------------------------------------------------------
# 입력 읽기
# --------------------------------------------------------------------------
def current_bundle(serving_dir=None):
    serving = serving_dir or os.environ.get("ODY_SERVING_DIR") or os.path.join(ROOT, "serving")
    with io.open(os.path.join(serving, "CURRENT.json"), encoding="utf-8") as fh:
        return os.path.join(serving, json.load(fh)["bundle"])


def load_targets(coords_path):
    """적재 대상. (mbid 배열, 좌표 행렬) 을 mbid 오름차순으로 준다. id = 순번 + 1."""
    import pyarrow.compute as pc
    import pyarrow.parquet as pq

    table = pq.read_table(coords_path, columns=["mbid"] + PC_COLUMNS)
    table = table.take(pc.sort_indices(table, sort_keys=[("mbid", "ascending")]))
    mbids = [m.lower() for m in table.column("mbid").to_pylist()]
    coords = np.column_stack([table.column(pc_name).to_numpy(zero_copy_only=False)
                              for pc_name in PC_COLUMNS])
    del table
    return mbids, coords


def load_column_map(path, key, value, wanted, lower_key=True):
    """parquet 에서 `wanted` 에 있는 키만 골라 {키: 값} 으로 만든다. 행 그룹 단위로 읽는다."""
    import pyarrow.parquet as pq
    out = {}
    parquet = pq.ParquetFile(path)
    for group in range(parquet.metadata.num_row_groups):
        chunk = parquet.read_row_group(group, columns=[key, value])
        keys = chunk.column(key).to_pylist()
        values = chunk.column(value).to_pylist()
        for k, v in zip(keys, values):
            if lower_key:
                k = k.lower()
            if k in wanted:
                out[k] = v
    return out


def load_catalog(path, wanted):
    """카탈로그에서 제목·아티스트·길이를 뽑는다. 세 컬럼을 한 번에 읽는다."""
    import pyarrow.parquet as pq
    out = {}
    parquet = pq.ParquetFile(path)
    columns = ["mbid", "title_raw", "artist_raw", "length"]
    for group in range(parquet.metadata.num_row_groups):
        chunk = parquet.read_row_group(group, columns=columns)
        data = [chunk.column(name).to_pylist() for name in columns]
        for mbid, title, artist, length in zip(*data):
            mbid = mbid.lower()
            if mbid in wanted:
                out[mbid] = (title, artist, length)
    return out


def feature_dirs(work):
    """특징 parquet 이 있는 디렉터리 **둘 다**.

    파일럿 추출(`v2_feats_pilot`)이 본 추출의 첫 조각이라 part10·part24 가 거기 있다.
    한쪽만 읽으면 786,903행이 통째로 빠진다(2026-09-11 에 이것 때문에 bpm 이
    733,146곡 NULL 이었고 "파트 2개 누락" 으로 잘못 판단했다). 원본
    `pipeline/exclusion_apply.py` 도 두 디렉터리를 순회한다.
    """
    return [os.path.join(work, name) for name in ("v2_feats", "v2_feats_pilot")]


def load_bpm(feats_dirs, wanted, column="rhythm.bpm"):
    """특징에서 bpm 만 뽑는다. 디렉터리 목록을 받는다(문자열 하나도 받아준다)."""
    import pyarrow.parquet as pq
    out = {}
    if isinstance(feats_dirs, str):
        feats_dirs = [feats_dirs]
    for feats_dir in feats_dirs:
        if not os.path.isdir(feats_dir):
            continue
        for name in sorted(os.listdir(feats_dir)):
            if not name.endswith(".parquet"):
                continue
            table = pq.read_table(os.path.join(feats_dir, name), columns=["mbid", column])
            for mbid, bpm in zip(table.column("mbid").to_pylist(), table.column(column).to_pylist()):
                mbid = mbid.lower()
                if mbid in wanted:
                    out[mbid] = bpm
    return out


def load_album_meta(path, wanted):
    """`work/v2_meta.parquet`(meta_merge.py 산출)에서 {mbid: (album, release_year, albumid)}.

    파일이 없으면 빈 dict — 세 컬럼이 빈 값으로 나가고 리포트가 그 사실을 남긴다.
    """
    import pyarrow.parquet as pq
    out = {}
    if not path or not os.path.exists(path):
        return out
    parquet = pq.ParquetFile(path)
    columns = ["mbid", "album", "release_year", "albumid"]
    for group in range(parquet.metadata.num_row_groups):
        chunk = parquet.read_row_group(group, columns=columns)
        data = [chunk.column(name).to_pylist() for name in columns]
        for mbid, album, year, albumid in zip(*data):
            mbid = mbid.lower()
            if mbid in wanted:
                out[mbid] = (album or None, year, albumid or None)
    return out


# --------------------------------------------------------------------------
# 쓰기
# --------------------------------------------------------------------------
def write_csv(path, header, rows):
    """COPY ... WITH (FORMAT csv, HEADER true) 가 읽는 형식."""
    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh, lineterminator="\n")
        writer.writerow(header)
        count = 0
        for row in rows:
            writer.writerow(row)
            count += 1
    return count


def build(out_dir, coords_path=None, catalog_path=None, meta_path=None, feats_dir=None,
          expect_rows=None, album_meta_path=None):
    """네 CSV 를 만들고 리포트를 준다.

    meta_path 는 장르(`v2_song_meta.parquet`), album_meta_path 는 앨범·연도(`v2_meta.parquet`)다.
    이름이 비슷하지만 다른 파일이다.
    """
    work = os.environ.get("ODY_WORK") or os.path.join(ROOT, "work")
    bundle = current_bundle()
    coords_path = coords_path or os.path.join(bundle, "coords_v2.parquet")
    catalog_path = catalog_path or os.path.join(work, "catalog_v2.parquet")
    meta_path = meta_path or os.path.join(work, "v2_song_meta.parquet")
    album_meta_path = album_meta_path or os.path.join(work, "v2_meta.parquet")
    feats_dirs = [feats_dir] if feats_dir else feature_dirs(work)
    os.makedirs(out_dir, exist_ok=True)

    mbids, coords = load_targets(coords_path)
    wanted = set(mbids)
    if len(wanted) != len(mbids):
        raise ValueError("coords 에 mbid 중복이 있다: {} vs {}".format(len(mbids), len(wanted)))
    bad = [m for m in mbids[:1000] if not UUID_RE.match(m)]
    if bad:
        raise ValueError("소문자 UUID 가 아닌 mbid: {}".format(bad[:3]))

    catalog = load_catalog(catalog_path, wanted)
    bpm = load_bpm(feats_dirs, wanted)
    genres = load_column_map(meta_path, "mbid", "gnr", wanted)
    album_meta = load_album_meta(album_meta_path, wanted)

    # --- genre.csv: 코드 하나가 행 하나. 이름 오름차순으로 id 를 준다 ---
    codes = sorted({code for value in genres.values() for code in split_genres(value)})
    genre_ids = {code: index + 1 for index, code in enumerate(codes)}
    write_csv(os.path.join(out_dir, "genre.csv"), GENRE_COLUMNS,
              ([genre_ids[code], code] for code in codes))

    # --- music.csv + neo4j_music.csv ---
    title_cuts = artist_cuts = album_cuts = 0
    missing_catalog = missing_bpm = 0
    album_filled = year_filled = album_mbid_filled = 0
    music_path = os.path.join(out_dir, "music.csv")
    neo4j_path = os.path.join(out_dir, "neo4j_music.csv")
    with io.open(music_path, "w", encoding="utf-8", newline="") as music_fh, \
            io.open(neo4j_path, "w", encoding="utf-8", newline="") as neo4j_fh:
        music_writer = csv.writer(music_fh, lineterminator="\n")
        neo4j_writer = csv.writer(neo4j_fh, lineterminator="\n")
        music_writer.writerow(MUSIC_COLUMNS)
        neo4j_writer.writerow(NEO4J_COLUMNS)
        for start in range(0, len(mbids), CHUNK):
            for offset, mbid in enumerate(mbids[start:start + CHUNK]):
                index = start + offset
                song_id = index + 1
                title, artist, length = catalog.get(mbid, (None, None, None))
                if mbid not in catalog:
                    missing_catalog += 1
                if mbid not in bpm:
                    missing_bpm += 1
                vector = coords[index]
                row, title_cut, artist_cut, album_cut = music_row(
                    song_id, mbid, title, artist, bpm.get(mbid), length, vector,
                    album_meta.get(mbid, EMPTY_META))
                music_writer.writerow(row)
                title_cuts += title_cut
                artist_cuts += artist_cut
                album_cuts += album_cut
                album_filled += bool(row[7])
                year_filled += bool(row[4])
                album_mbid_filled += bool(row[12])
                neo4j_writer.writerow([song_id, mbid, NEO4J_SEPARATOR.join(str(v) for v in vector),
                                       NEO4J_SEPARATOR.join(split_genres(genres.get(mbid)))])

    # --- music_genre.csv ---
    def genre_rows():
        link_id = 0
        for index, mbid in enumerate(mbids):
            for code in split_genres(genres.get(mbid)):
                link_id += 1
                yield [link_id, index + 1, genre_ids[code]]
    links = write_csv(os.path.join(out_dir, "music_genre.csv"), MUSIC_GENRE_COLUMNS, genre_rows())

    songs_with_genre = sum(1 for value in genres.values() if split_genres(value))
    report = {
        "stage": "S18-csv", "out_dir": out_dir,
        "inputs": {"coords": coords_path, "catalog": catalog_path, "meta": meta_path,
                   "feats": feats_dirs,
                   "album_meta": album_meta_path if album_meta else None},
        "music_rows": len(mbids), "id_range": [1, len(mbids)],
        "genre_rows": len(codes), "music_genre_rows": links,
        "songs_with_genre": songs_with_genre,
        "songs_without_genre": len(mbids) - songs_with_genre,
        "title_truncated": title_cuts, "artist_truncated": artist_cuts,
        "album_truncated": album_cuts,
        "missing_catalog": missing_catalog, "missing_bpm": missing_bpm,
        "album_filled": album_filled, "release_year_filled": year_filled,
        "album_mbid_filled": album_mbid_filled,
        "null_columns": ["youtube_url"],
        "next_music_id_for_backend": len(mbids) + 1,
    }
    if expect_rows:
        report["expected_rows"] = int(expect_rows)
        report["rows_match"] = len(mbids) == int(expect_rows)
    return report


def main():
    ap = argparse.ArgumentParser(description="스펙 18 적재용 CSV 만들기")
    ap.add_argument("--out", required=True, help="CSV 를 쓸 디렉터리")
    ap.add_argument("--coords", default=None)
    ap.add_argument("--catalog", default=None)
    ap.add_argument("--meta", default=None)
    ap.add_argument("--feats", default=None,
                    help="특징 디렉터리 하나. 생략하면 v2_feats 와 v2_feats_pilot 를 모두 읽는다")
    ap.add_argument("--album-meta", default=None,
                    help="재패스 메타 parquet(D17). 생략하면 work/v2_meta.parquet, 없으면 세 컬럼이 빈다")
    ap.add_argument("--expect-rows", type=int, default=6_624_399,
                    help="기대 행 수. 0 이면 검사하지 않는다")
    ap.add_argument("--report", default=None, help="리포트 json 경로")
    args = ap.parse_args()

    report = build(args.out, args.coords, args.catalog, args.meta, args.feats,
                   args.expect_rows or None, album_meta_path=args.album_meta)
    text = json.dumps(report, ensure_ascii=False, indent=2)
    print(text)
    if args.report:
        io.open(args.report, "w", encoding="utf-8").write(text + "\n")
    if report.get("rows_match") is False:
        raise SystemExit("행 수 불일치: {} != {}".format(report["music_rows"],
                                                    report["expected_rows"]))


if __name__ == "__main__":
    main()
