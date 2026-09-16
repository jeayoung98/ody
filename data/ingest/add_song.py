# -*- coding: utf-8 -*-
"""새 곡 단건 증분 적재 — essentia lowlevel JSON → music INSERT SQL (Jira S15P21A405-376).

    lowlevel JSON  →  extract_270  →  serving_transform (skew·delta_f·impute·scaler·clip·PCA-16)
                   →  music_row (스펙 18 컬럼 형식 그대로)  →  INSERT ... WHERE NOT EXISTS

전곡 파이프라인(S1~S6)이 쓴 것과 **같은 함수**를 부른다. 재학습 없음(규칙 3).
`scripts/korean_common.serving_transform` 이 좌표를, `ingest/build_csv.music_row` 가 컬럼 형식을 결정한다.
이 파일에 숫자·규칙은 없다.

## 입력이 지켜야 할 것
- essentia **2.1-beta2** `streaming_extractor_music` 출력. `metadata.version` 네 문자열이
  `pipeline/version_census_fingerprints.csv` 의 코호트 지문과 일치해야 한다. 다르면 좌표를 믿을 수 없어
  기본은 중단한다(`--allow-foreign-extractor` 로만 통과).
- `mbid` 는 `metadata.tags.musicbrainz_recordingid` 또는 `--mbid`. 소문자 UUID.
- `title` 은 `metadata.tags.title` 또는 `--title`. `music.title` 이 NOT NULL 이라 비면 중단.
- `lossless` 는 `metadata.audio_properties.lossless`. S2 의 delta_f 보정이 이 값으로 갈린다.

## 하지 않는 것
S5 카탈로그 규칙(R1~R10). 묶음 규칙 R5·R6 은 단건에 적용할 수 없다. genre·Neo4j·HNSW 도 범위 밖.
SQL 실행도 하지 않는다 — 운영 DB 는 사람이 DBeaver 로 실행한다.
"""
import argparse
import io
import json
import os
import re
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for sub in ("scripts", "ingest", os.path.join("spark", "jobs")):
    sys.path.insert(0, os.path.join(ROOT, sub))

import korean_common as KC  # noqa: E402  (import 시 serving/CURRENT.json 번들을 읽는다)
from build_csv import MUSIC_COLUMNS, music_row  # noqa: E402
from manifest_rows import FP_KEY_COLUMNS, load_cohort, load_fingerprints  # noqa: E402

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
TEXT_COLUMNS = {"mbid", "title", "artist", "album", "youtube_url"}
BPM_INDEX = KC.KEPT.index("rhythm.bpm")


class AddSongError(ValueError):
    """입력이 계약을 어겼다. 좌표를 만들지 않는다."""


def _tag(doc, name):
    """essentia 는 태그를 리스트로 싣는다. 첫 값만 쓴다."""
    value = doc.get("metadata", {}).get("tags", {}).get(name)
    if isinstance(value, list):
        value = value[0] if value else None
    return None if value is None else str(value)


def check_extractor(doc, allow_foreign=False):
    """metadata.version 네 문자열 → 코호트 지문 번호. 코호트 밖이면 AddSongError."""
    version = doc.get("metadata", {}).get("version", {})
    key = tuple(str(version.get(c, "")) for c in FP_KEY_COLUMNS)
    by_key = {v: fp for fp, v in load_fingerprints().items()}
    cohort, _ = load_cohort()
    fp = by_key.get(key)
    if fp not in cohort and not allow_foreign:
        raise AddSongError("추출기 버전이 코호트 밖이다 {} (지문 {}). --allow-foreign-extractor 로만 통과".format(key, fp))
    return fp


def song_from_doc(doc, mbid=None, title=None, artist=None, lossless=None, allow_foreign=False):
    """lowlevel JSON 하나 → music 한 행(dict). 좌표는 float32 16개."""
    fp = check_extractor(doc, allow_foreign)
    mbid = (mbid or _tag(doc, "musicbrainz_recordingid") or "").strip().lower()
    if not UUID_RE.match(mbid):
        raise AddSongError("mbid 가 소문자 UUID 가 아니다: {!r}. --mbid 로 준다".format(mbid))
    title = (title if title is not None else _tag(doc, "title")) or ""
    if not title.strip():
        raise AddSongError("title 이 비었다. music.title 은 NOT NULL 이다. --title 로 준다")
    artist = (artist if artist is not None else _tag(doc, "artist")) or ""
    props = doc.get("metadata", {}).get("audio_properties", {})
    if lossless is None:
        lossless = props.get("lossless")
    if lossless is None:
        raise AddSongError("lossless 를 알 수 없다. --lossless 또는 --lossy 로 준다")

    X = KC.extract_270(doc)[None, :]
    coords = KC.serving_transform(X, np.array([bool(lossless)]))["pca"][0].astype(np.float32)
    bpm = X[0, BPM_INDEX]
    return {"mbid": mbid, "title": title, "artist": artist, "lossless": bool(lossless),
            "fingerprint": fp, "bpm": None if np.isnan(bpm) else float(bpm),
            "length": props.get("length"), "coords": coords}


def _literal(column, value):
    if value == "" or value is None:
        return "NULL"
    if column == "location":
        return "'{}'::vector".format(value)
    if column in TEXT_COLUMNS:
        return "'{}'".format(str(value).replace("'", "''"))
    return str(value)


def insert_sql(song):
    """music 한 행 INSERT. id 는 MAX(id)+1, 같은 mbid 가 있으면 넣지 않는다(멱등)."""
    row, _title_cut, _artist_cut = music_row(None, song["mbid"], song["title"], song["artist"],
                                             song["bpm"], song["length"], song["coords"])
    values = ["(SELECT COALESCE(MAX(id), 0) + 1 FROM music)"]
    values += [_literal(col, val) for col, val in zip(MUSIC_COLUMNS[1:], row[1:])]
    return ("INSERT INTO music ({cols})\nSELECT {vals}\n"
            "WHERE NOT EXISTS (SELECT 1 FROM music WHERE mbid = {mbid});\n").format(
                cols=", ".join(MUSIC_COLUMNS), vals=", ".join(values),
                mbid=_literal("mbid", song["mbid"]))


def main():
    ap = argparse.ArgumentParser(description="essentia lowlevel JSON 단건 → music INSERT SQL")
    ap.add_argument("json", nargs="+", help="lowlevel JSON 파일. 여러 개면 SQL 을 이어 쓴다")
    ap.add_argument("--out", required=True, help="INSERT SQL 을 쓸 파일")
    ap.add_argument("--mbid"), ap.add_argument("--title"), ap.add_argument("--artist")
    ap.add_argument("--lossless", dest="lossless", action="store_true", default=None)
    ap.add_argument("--lossy", dest="lossless", action="store_false")
    ap.add_argument("--allow-foreign-extractor", action="store_true",
                    help="코호트 밖 essentia 빌드도 통과시킨다. 좌표 신뢰 불가, 실험용")
    args = ap.parse_args()
    if len(args.json) > 1 and (args.mbid or args.title):
        ap.error("--mbid/--title 는 JSON 하나일 때만")

    report = []
    with io.open(args.out, "w", encoding="utf-8") as out:
        out.write("-- generated by ingest/add_song.py, bundle {}\nBEGIN;\n".format(os.path.basename(KC.SERVING)))
        for path in args.json:
            doc = json.load(io.open(path, encoding="utf-8"))
            song = song_from_doc(doc, args.mbid, args.title, args.artist, args.lossless,
                                 args.allow_foreign_extractor)
            out.write(insert_sql(song))
            report.append({"json": path, "mbid": song["mbid"], "title": song["title"],
                           "fingerprint": song["fingerprint"], "bpm": song["bpm"],
                           "coords": [float(c) for c in song["coords"]]})
        out.write("COMMIT;\n")
    print(json.dumps({"out": args.out, "songs": report}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
