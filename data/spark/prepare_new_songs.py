# -*- coding: utf-8 -*-
"""신곡 증분 입력 준비 — essentia lowlevel JSON → S1.5·S5 입력 (Jira S15P21A405-600).

    songs.csv (json,title,artist[,album])  →  raw.jsonl     S1.5 `feature_select.py --from-raw` 입력
                                           →  meta.parquet  S5 `catalog_rules.py --coords` 입력(좌표 뺀 catalog_input)
                                           →  album.parquet S7 `db_load_csv.py --meta` 입력(v2_meta 와 같은 스키마)

전곡 파이프라인은 AcousticBrainz 덤프에서 시작해 S1 이 제출본을 고르고, `build_catalog_input.py` 가
S5 입력을 만든다. 신곡은 제출본이 하나라 S1 이 할 일이 없고, 덤프 부속 표(census·song_meta·genres)에도
없다. 이 스크립트가 그 두 자리를 채운다. 좌표는 여기서 만들지 않는다 — S2·S3 이 클러스터에서 만든다.

## 곡마다 정하는 값
- mbid: `metadata.tags.musicbrainz_recordingid` 가 소문자 UUID 면 그것. 없으면 **합성 uuid5**
  (`md5_encoded` 기준). 같은 음원 파일은 언제 돌려도 같은 값이라 적재가 멱등이다. MusicBrainz 는 v4 라
  버전 자리(`-5`)로 합성인지 가릴 수 있다.
- fingerprint: `metadata.version` 네 문자열로 코호트 지문을 찾는다. `essentia_build_sha` 가 없고
  나머지 세 값이 코호트 지문과 같으면 그 지문으로 본다(D20). 여러 지문이 맞으면 `FP_RANK` 앞 번호.
  못 찾으면 None 이고 S5 R4 가 제외한다. R4 판정식과 `exclusion_rules.json` 은 그대로다 — 규칙 파일을
  바꾸면 `rules_hash` 가 달라져 전곡 카탈로그 패리티(`tests/test_catalog_rules.py`)가 멈춘다.
- title·artist: songs.csv 가 우선, 비면 태그. `music.title` 이 NOT NULL 이라 title 이 없으면 중단한다.
- 묶음·태그 값: canonical=mbid, n_submissions=1, has_tag·has_exempt_tag=False, a5_keywords=[] —
  신곡은 덤프 부속 표에 없어 이 값들의 출처가 없다. n_clipped_features 는 A4 와 같은 정의로 계산한다.

실행 (로컬):
    .venv/Scripts/python.exe spark/prepare_new_songs.py --songs new/songs.csv --out-dir work/new_songs/2026-09-23
"""
import argparse
import csv
import io
import json
import os
import re
import sys
import uuid

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
for sub in (HERE, os.path.join(HERE, "jobs"), os.path.join(ROOT, "scripts")):
    if sub not in sys.path:
        sys.path.insert(0, sub)

import build_catalog_input as S5IN  # noqa: E402  (S5 입력 스키마를 여기서 다시 적지 않는다)
import feature_spec as FS  # noqa: E402
import preprocess as S2  # noqa: E402
from catalog_rules import load_rules  # noqa: E402
from manifest_rows import FP_KEY_COLUMNS, FP_RANK, load_cohort, load_fingerprints  # noqa: E402
from build_v2_song_meta import norm  # noqa: E402  (artist_norm 정의 — R6 묶음 키)

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
SYNTHETIC_NS = uuid.uuid5(uuid.NAMESPACE_URL, "https://ody.local/synthetic-mbid")
# D20: build_sha 만 빈 beta2 제출본을 코호트로 본다. 근거 v2_cohort_decision.json basis (변종 간 편향 ≤ 축 std 0.008%).
ACCEPT_MISSING_BUILD_SHA = True
# S1.5 가 원본에서 가져오는 메타(feature_select.META_COLUMNS). 덤프에서는 census 가 주던 값이다.
RAW_META = ["mbid", "part", "offset", "fingerprint", "codec", "bit_rate", "length", "lossless", "sample_rate"]
# `work/catalog_input.parquet` 과 같은 타입. 특히 빈 a5_keywords 는 지정하지 않으면 list<null> 로 써진다.
META_TYPES = {"length": pa.float32(), "sample_rate": pa.float32(), "part": pa.int16(), "offset": pa.int32(),
              "fingerprint": pa.int16(), "n_submissions": pa.int32(), "a5_keywords": pa.list_(pa.string()),
              "n_clipped_features": pa.int32(), "lossless": pa.bool_(), "has_tag": pa.bool_(),
              "has_exempt_tag": pa.bool_()}
TEXT_META = {"mbid", "canonical", "artist_norm", "artist_raw", "title_raw"}


class NewSongError(ValueError):
    """입력이 계약을 어겼다."""


def _tag(doc, name):
    value = doc.get("metadata", {}).get("tags", {}).get(name)
    if isinstance(value, list):
        value = value[0] if value else None
    return None if value is None else str(value)


def synthetic_mbid(md5_encoded):
    return str(uuid.uuid5(SYNTHETIC_NS, md5_encoded.lower()))


def song_mbid(doc):
    tagged = (_tag(doc, "musicbrainz_recordingid") or "").strip().lower()
    if UUID_RE.match(tagged):
        return tagged, False
    md5 = doc.get("metadata", {}).get("audio_properties", {}).get("md5_encoded")
    if not md5:
        raise NewSongError("mbid 태그도 md5_encoded 도 없다. 합성 mbid 를 만들 수 없다")
    return synthetic_mbid(md5), True


def resolve_fingerprint(version, fingerprints, accept_missing_build_sha):
    """(지문 번호 또는 None, build_sha 없이 맞췄는가). 코호트 밖 지문도 번호는 돌려준다 — 판정은 S5 R4 가 한다."""
    key = tuple(str(version.get(c, "") or "") for c in FP_KEY_COLUMNS)
    for fp, value in fingerprints.items():
        if value == key:
            return fp, False
    build = FP_KEY_COLUMNS.index("essentia_build_sha")
    if accept_missing_build_sha and not key[build]:
        rest = key[:build] + key[build + 1:]
        for fp in FP_RANK:
            value = fingerprints[fp]
            if value[:build] + value[build + 1:] == rest:
                return fp, True
    return None, False


def n_clipped(raw, lossless, bundle):
    """A4(`pipeline/catalog_audit.py`)와 같은 정의 — clip 직전 |Z| > clip 인 특징 수."""
    X = S2.apply_skew(np.asarray([raw], dtype=np.float64), bundle)
    if not lossless:
        X += bundle["delta_f"]
    X = np.where(np.isnan(X), bundle["impute_median"], X)
    Z = (X - bundle["scaler_center"]) / bundle["scaler_scale"]
    return int((np.abs(Z) > bundle["clip"]).sum())


def prepare(doc, title=None, artist=None, fingerprints=None, rules=None, bundle=None):
    """(raw.jsonl 한 줄 dict, meta.parquet 한 행 dict, 보고용 dict)."""
    rules = rules or load_rules()[0]
    fingerprints = fingerprints or load_fingerprints()
    bundle = bundle or S2.load_bundle()
    props = doc.get("metadata", {}).get("audio_properties", {})
    mbid, synthetic = song_mbid(doc)
    fp, inferred = resolve_fingerprint(doc.get("metadata", {}).get("version", {}), fingerprints,
                                       ACCEPT_MISSING_BUILD_SHA)
    title = (title or _tag(doc, "title") or "").strip()
    artist = (artist or _tag(doc, "artist") or "").strip()
    if not title:
        raise NewSongError("title 이 없다: {}. songs.csv 의 title 칸을 채운다".format(mbid))
    lossless = bool(props.get("lossless"))

    raw_line = dict(doc)
    raw_line.update({"mbid": mbid, "part": None, "offset": None, "fingerprint": fp,
                     "codec": props.get("codec"), "bit_rate": props.get("bit_rate"),
                     "length": props.get("length"), "lossless": lossless,
                     "sample_rate": props.get("sample_rate")})

    feats = dict(zip(FS.FEATURE_NAMES, FS.extract_features(doc)))
    row = {"mbid": mbid, "canonical": mbid, "artist_norm": norm(artist), "artist_raw": artist,
           "title_raw": title, "length": props.get("length"), "sample_rate": props.get("sample_rate"),
           "lossless": lossless, "part": None, "offset": None, "fingerprint": fp, "n_submissions": 1,
           "has_tag": False, "has_exempt_tag": False, "a5_keywords": [],
           "n_clipped_features": n_clipped([feats[n] for n in bundle["kept"]], lossless, bundle)}
    for source, short in S5IN.SILENCE_RENAME.items():
        row[short] = feats[source]
    p15 = rules["R15_static"]["params"]
    for name in list(p15["features"]) + [p15["onset_feature"]]:
        row[name] = feats[name]

    report = {"mbid": mbid, "synthetic_mbid": synthetic, "title": title, "artist": artist,
              "fingerprint": fp, "fingerprint_without_build_sha": inferred,
              "n_clipped_features": row["n_clipped_features"]}
    return raw_line, row, report


def meta_frame(rows, rules):
    """S5 입력 스키마(`build_catalog_input.required_columns`)에서 좌표만 뺀 표. 좌표는 S5 가 S3 산출과 조인한다."""
    columns = [c for c in S5IN.required_columns(rules) if c not in S5IN.PC]
    frame = pd.DataFrame(rows)
    missing = [c for c in columns if c not in frame.columns]
    if missing:
        raise NewSongError("빠진 컬럼: {}".format(missing))
    return frame[columns]


def meta_table(frame):
    """타입을 고정한 arrow 표. 나머지 특징 컬럼은 double 이다."""
    fields = [pa.field(c, META_TYPES.get(c, pa.string() if c in TEXT_META else pa.float64())) for c in frame.columns]
    return pa.Table.from_pandas(frame, schema=pa.schema(fields), preserve_index=False)


def read_songs(path):
    base = os.path.dirname(os.path.abspath(path))
    with io.open(path, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            yield os.path.join(base, row["json"]), row.get("title"), row.get("artist"), row.get("album")


def album_table(reports):
    """S7 이 조인하는 `v2_meta` 모양(mbid, album, release_year, albumid). 신곡은 연도·앨범 MBID 출처가 없다."""
    return pa.table({"mbid": [r["mbid"] for r in reports],
                     "album": [(r.get("album") or "").strip() or None for r in reports],
                     "release_year": pa.array([None] * len(reports), pa.float64()),
                     "albumid": pa.array([None] * len(reports), pa.string())})


def main():
    ap = argparse.ArgumentParser(description="신곡 lowlevel JSON → S1.5·S5 증분 입력")
    ap.add_argument("--songs", required=True, help="json,title,artist CSV. json 은 이 파일 기준 상대 경로")
    ap.add_argument("--out-dir", required=True, help="raw.jsonl · meta.parquet · report.json 을 쓸 곳")
    args = ap.parse_args()

    rules, digest = load_rules()
    fingerprints = load_fingerprints()
    load_cohort()                      # FP_RANK 와 결정 파일이 어긋나면 여기서 멈춘다
    bundle = S2.load_bundle()
    raw_lines, rows, reports, seen = [], [], [], set()
    for json_path, title, artist, album in read_songs(args.songs):
        doc = json.load(io.open(json_path, encoding="utf-8"))
        raw_line, row, report = prepare(doc, title, artist, fingerprints, rules, bundle)
        if report["mbid"] in seen:
            raise NewSongError("같은 mbid 가 두 번 나온다: {} ({})".format(report["mbid"], json_path))
        seen.add(report["mbid"])
        report["json"] = json_path
        report["album"] = album
        raw_lines.append(raw_line); rows.append(row); reports.append(report)

    os.makedirs(args.out_dir, exist_ok=True)
    with io.open(os.path.join(args.out_dir, "raw.jsonl"), "w", encoding="utf-8", newline="\n") as fh:
        for line in raw_lines:
            fh.write(json.dumps(line, ensure_ascii=False) + "\n")
    pq.write_table(meta_table(meta_frame(rows, rules)), os.path.join(args.out_dir, "meta.parquet"))
    pq.write_table(album_table(reports), os.path.join(args.out_dir, "album.parquet"))
    summary = {"songs": len(rows), "rules_hash": digest, "bundle": bundle["dir"],
               "out_dir": args.out_dir, "songs_detail": reports}
    text = json.dumps(summary, ensure_ascii=False, indent=1)
    io.open(os.path.join(args.out_dir, "report.json"), "w", encoding="utf-8", newline="\n").write(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
