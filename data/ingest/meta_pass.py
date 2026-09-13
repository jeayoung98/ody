# -*- coding: utf-8 -*-
"""메타데이터 전용 재패스 — album·발매일·albumid 를 lowlevel 덤프에서 뽑는다 (스펙 18, Jira S15P21A405-291).

좌표 파이프라인은 270개 특징만 읽고 `metadata.tags` 는 안 실었다(D11 의 "1차 NULL" 근거).
이 스크립트는 반대로 특징을 안 읽고 태그만 읽는다. 한 파트(~20GB zstd, JSON 약 90만 개)에
단독 5.4분, 4-way 병렬이면 디스크 I/O 가 병목이라 파트당 13분(2026-09-13 실측, 30파트 약 2시간).

제출본 단위로 저장한다. 곡 단위로 접는 것은 `meta_merge.py` 가 한다 — 대표 제출본(part, offset)을
고르려면 제출본 행이 있어야 한다.

사용:
    python ingest/meta_pass.py <part_index> <dump.tar.zst> <out.parquet>
    (30파트 일괄은 run_meta_pass.sh)
출력 컬럼:
    part, mbid, offset, date, originaldate, year, albumid, rgid, album, albumartist
"""
import io
import json
import os
import sys
import tarfile
import time

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import zstandard

# essentia 가 남긴 metadata.tags 키 → 저장 컬럼 이름
TAG_KEYS = ["date", "originaldate", "year", "musicbrainz_albumid",
            "musicbrainz_releasegroupid", "album", "albumartist"]
OUT_NAMES = ["date", "originaldate", "year", "albumid", "rgid", "album", "albumartist"]
SHORT = {"date", "originaldate", "year", "albumid", "rgid"}     # 64자면 충분한 컬럼
LOG_EVERY = 200_000


def first_tag(tags, key, limit):
    """태그는 리스트다. 첫 값만 문자열로, 길이는 잘라서."""
    value = tags.get(key)
    return str(value[0])[:limit] if isinstance(value, list) and value else ""


def main():
    part = int(sys.argv[1])
    dump = sys.argv[2]
    out = sys.argv[3]
    os.makedirs(os.path.dirname(out), exist_ok=True)

    cols = {name: [] for name in ["mbid", "offset"] + OUT_NAMES}
    n = n_err = 0
    t0 = time.time()
    with open(dump, "rb") as fh:
        dctx = zstandard.ZstdDecompressor()
        with dctx.stream_reader(fh) as reader:
            buffered = io.BufferedReader(reader, buffer_size=1 << 20)
            with tarfile.open(fileobj=buffered, mode="r|") as tar:
                for member in tar:
                    if not member.isfile() or not member.name.endswith(".json"):
                        continue
                    n += 1
                    if n % LOG_EVERY == 0:
                        print("  part-{} ... {} members, {:.1f}m".format(
                            part, n, (time.time() - t0) / 60), flush=True)
                    base = os.path.basename(member.name)[:-5]
                    fn_mbid, _, off = base.rpartition("-")
                    off_i = int(off) if off.isdigit() else -1
                    try:
                        doc = json.loads(tar.extractfile(member).read())
                    except Exception:
                        n_err += 1
                        continue
                    tags = (doc.get("metadata") or {}).get("tags") or {}
                    rec = tags.get("musicbrainz_recordingid")
                    mbid = (str(rec[0]).lower() if isinstance(rec, list) and rec
                            else fn_mbid.lower())
                    cols["mbid"].append(mbid)
                    cols["offset"].append(off_i)
                    for key, name in zip(TAG_KEYS, OUT_NAMES):
                        cols[name].append(first_tag(tags, key, 64 if name in SHORT else 300))

    elapsed = (time.time() - t0) / 60
    print("  part-{} 스트리밍 완료: {:,} members, 파싱실패 {}, {:.1f}m".format(
        part, n, n_err, elapsed), flush=True)

    table = {"part": pa.array(np.full(len(cols["mbid"]), part, dtype=np.int16)),
             "mbid": pa.array(cols["mbid"], type=pa.string()),
             "offset": pa.array(np.array(cols["offset"], dtype=np.int32))}
    for name in OUT_NAMES:
        arr = pa.array(cols[name], type=pa.string())
        # 앨범 이름·id 는 제출본끼리 많이 겹친다. 사전 인코딩으로 파일을 눌러 둔다.
        table[name] = arr.dictionary_encode() if name in ("albumid", "rgid", "album", "albumartist") else arr
    pq.write_table(pa.table(table), out, compression="zstd")

    have = {name: sum(1 for v in cols[name] if v) for name in OUT_NAMES}
    print("  저장: {}  보유율 {}".format(
        out, {k: "{:.1f}%".format(100 * v / max(n, 1)) for k, v in have.items()}), flush=True)
    print("  part-{} DONE {:.1f}m".format(part, elapsed), flush=True)


if __name__ == "__main__":
    main()
