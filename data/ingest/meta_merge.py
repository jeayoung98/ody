# -*- coding: utf-8 -*-
"""meta_parts/*.parquet (제출본 단위) → work/v2_meta.parquet (곡 단위) (스펙 18, Jira S15P21A405-291).

    26,275,868 제출본  →  6,624,399 곡 (coords_v2.parquet 의 곡만, 그 순서대로)

## 곡마다 값 하나를 고르는 규칙
1. **대표 제출본**(manifest 의 part·offset — 좌표를 만든 바로 그 파일)의 값이 있으면 그것.
2. 없으면 같은 mbid 의 제출본 전체에서 **최빈값**. 동률은 정렬 앞.

min 을 쓰면 오태그를 집는다. Pink Floyd 'Time' 179개 제출본 중 1973 이 82개, 1966 이 7개인데
min 은 1966 을 낸다(2026-09-13 실측). 최빈값은 1973.

## release_year
`originaldate` → `date` 순으로 앞 4자리. 1900~2026 범위 밖은 버린다. `year` 태그는 0.0% 라 안 본다.
originaldate 를 먼저 보는 이유: `date` 는 리마스터 발매일(1994)인 경우가 많고 originaldate 가 원 발매(1973)다.

## albumid / rgid
UUID 형식이 아니면 비운다(28,082행 실측). BE 는 albumid 로 커버 URL 을 만든다 —
https://coverartarchive.org/release/{albumid}/front-250 . 이미지는 저장하지 않는다.

사용:
    PYTHONUTF8=1 python ingest/meta_merge.py
    META_GLOB="meta_part29.parquet" META_OUT="_smoke.parquet" python ingest/meta_merge.py   # 한 파트 연습
산출:
    work/v2_meta.parquet · output/meta_merge_<날짜>.json
"""
import glob
import io
import json
import os
import re
import time
from datetime import date

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.environ.get("ODY_WORK") or os.path.join(ROOT, "work")
SERVING = os.environ.get("ODY_SERVING_DIR") or os.path.join(ROOT, "serving")
OUT_DIR = os.path.join(ROOT, "output")
YEAR_RE = re.compile(r"^\s*(\d{4})")
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
YEAR_MIN, YEAR_MAX = 1900, 2026
TEXT_COLS = ("albumid", "rgid", "album", "albumartist")


def year_of(text):
    """'1973-03-24' → 1973. 범위 밖·형식 밖은 NaN."""
    match = YEAR_RE.match(text) if isinstance(text, str) else None
    if not match:
        return np.nan
    year = int(match.group(1))
    return year if YEAR_MIN <= year <= YEAR_MAX else np.nan


def pick_value(rows, col):
    """곡마다 값 하나. 대표 제출본 값이 있으면 그것, 없으면 최빈값(동률은 정렬 앞)."""
    d = rows[["mbid", "is_rep", col]]
    d = d[d[col].notna() & (d[col] != "")] if d[col].dtype == object else d[d[col].notna()]
    rep = d[d["is_rep"]].drop_duplicates("mbid").set_index("mbid")[col]
    count = d.groupby(["mbid", col], sort=False).size().reset_index(name="n")
    count = count.sort_values(["mbid", "n", col], ascending=[True, False, True], kind="stable")
    mode = count.drop_duplicates("mbid").set_index("mbid")[col]
    return rep.combine_first(mode)


def main():
    t0 = time.time()
    bundle = json.load(io.open(os.path.join(SERVING, "CURRENT.json"), encoding="utf-8"))["bundle"]
    coords = pd.read_parquet(os.path.join(SERVING, bundle, "coords_v2.parquet"), columns=["mbid"])
    coords["mbid"] = coords["mbid"].str.lower()
    keep = set(coords["mbid"])
    manifest = pd.read_parquet(os.path.join(WORK, "v2_manifest.parquet"), columns=["mbid", "part", "offset"])
    manifest["mbid"] = manifest["mbid"].str.lower()
    manifest = manifest[manifest["mbid"].isin(keep)]
    rep_keys = set(zip(manifest["mbid"], manifest["part"].astype(int), manifest["offset"].astype(int)))
    print("coords {:,} · 대표 제출본 {:,}".format(len(keep), len(rep_keys)), flush=True)

    pattern = os.environ.get("META_GLOB", "meta_part*.parquet")
    parts = sorted(glob.glob(os.path.join(WORK, "meta_parts", pattern)))
    if not parts:
        raise SystemExit("meta_parts 가 없다. 먼저 run_meta_pass.sh")
    frames = []
    for path in parts:
        d = pd.read_parquet(path)
        d["mbid"] = d["mbid"].str.lower()
        d = d[d["mbid"].isin(keep)].copy()
        for col in TEXT_COLS:
            d[col] = d[col].astype(str).str.strip()
        d["is_rep"] = [(m, int(p), int(o)) in rep_keys
                       for m, p, o in zip(d["mbid"], d["part"], d["offset"])]
        d["year_any"] = d["originaldate"].map(year_of).fillna(d["date"].map(year_of))
        frames.append(d[["mbid", "is_rep", "year_any", *TEXT_COLS]])
        print("  {} {:,}행 ({:.1f}m)".format(os.path.basename(path), len(d), (time.time() - t0) / 60), flush=True)
    rows = pd.concat(frames, ignore_index=True)
    del frames
    print("제출본 행 {:,}".format(len(rows)), flush=True)

    bad_ids = {}
    for col in ("albumid", "rgid"):
        bad = (rows[col] != "") & ~rows[col].str.match(UUID_RE)
        bad_ids[col] = int(bad.sum())
        rows.loc[bad, col] = ""
    print("UUID 형식 위반 → 비움:", bad_ids, flush=True)

    t1 = time.time()
    n_sub = rows.groupby("mbid", sort=False).size().rename("n_submissions")
    out = pd.DataFrame({
        "release_year": pick_value(rows, "year_any"),
        "albumid": pick_value(rows, "albumid"),
        "rgid": pick_value(rows, "rgid"),
        "album": pick_value(rows, "album"),
        "albumartist": pick_value(rows, "albumartist"),
    }).join(n_sub, how="outer").reset_index().rename(columns={"index": "mbid"})
    print("곡 단위 집계 {:.1f}m".format((time.time() - t1) / 60), flush=True)

    out = coords.merge(out, on="mbid", how="left")          # coords 순서·전 곡 보존
    out["release_year"] = out["release_year"].astype("Int16")
    for col in TEXT_COLS:
        out[col] = out[col].fillna("")
    out_path = os.path.join(WORK, os.environ.get("META_OUT", "v2_meta.parquet"))
    out.to_parquet(out_path, compression="zstd", index=False)

    hist = out["release_year"].dropna().astype(int).floordiv(10).mul(10).value_counts().sort_index()
    summary = {
        "stage": "S18-meta-merge", "date": date.today().isoformat(), "bundle": bundle,
        "songs": int(len(out)), "submission_rows": int(len(rows)), "parts": len(parts),
        "rule": "대표 제출본 우선, 없으면 최빈값. release_year = originaldate→date 앞 4자리, 1900~2026",
        "coverage": {
            "album": round(float((out["album"] != "").mean()), 6),
            "release_year": round(float(out["release_year"].notna().mean()), 6),
            "albumid": round(float((out["albumid"] != "").mean()), 6),
            "rgid": round(float((out["rgid"] != "").mean()), 6),
            "albumid_or_rgid": round(float(((out["albumid"] != "") | (out["rgid"] != "")).mean()), 6),
            "albumartist": round(float((out["albumartist"] != "").mean()), 6),
        },
        "uuid_invalid_blanked": bad_ids,
        "release_year_hist": {str(k): int(v) for k, v in hist.items()},
        "songs_without_any_submission": int(out["n_submissions"].isna().sum()),
        "elapsed_min": round((time.time() - t0) / 60, 1),
        "output": out_path,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    report = os.path.join(OUT_DIR, "meta_merge_{}.json".format(summary["date"]))
    io.open(report, "w", encoding="utf-8").write(json.dumps(summary, ensure_ascii=False, indent=1) + "\n")
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
