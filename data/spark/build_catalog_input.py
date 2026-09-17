# -*- coding: utf-8 -*-
"""S5 클러스터 입력 `work/catalog_input.parquet` 을 로컬에서 만든다 (스펙 20, Jira S15P21A405-395).

    v2.1 번들 좌표 6,624,399곡 + song_meta + manifest + 제목 다수결 + 감사 A4·A5 + 특징 7컬럼 + 태그
      →  work/catalog_input.parquet  →  hdfs dfs -put  →  spark/jobs/catalog_rules.py --in hdfs:///ody/data/catalog_input

`catalog_rules.apply_rules` 가 요구하는 컬럼(그 docstring)을 한 표로 모은다. 값은 로컬 numpy 기준
구현 `pipeline/exclusion_apply.py` 의 `load_all`·`scan_feature_columns` 를 그대로 불러 만든다. 그래서
클러스터 S5 가 여기서 나온 표를 읽으면 로컬 dry-run(`output/exclusion_dryrun.json`)과 같은 입력을 본다.

기준(base)은 v2.1 번들이다. R1~R9 v3 를 이미 지난 6,624,399곡이고, v5 규칙이 여기서 1,930,196곡을
더 자른다(D18). manifest 7,404,506 전체를 base 로 쓰지 않는 이유: 그 곡들의 좌표가 번들에 없다.

실행:
    ODY_BUNDLE_BASE=serving/v2.1-pca16 .venv/Scripts/python.exe spark/build_catalog_input.py
"""
import io
import json
import os
import sys
import time

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "work")
for sub in ("pipeline", "scripts"):
    if os.path.join(ROOT, sub) not in sys.path:
        sys.path.insert(0, os.path.join(ROOT, sub))

PC = ["pc{}".format(i) for i in range(1, 17)]
META_COLUMNS = ["mbid", "canonical", "artist_norm", "artist_raw", "title_raw", "length",
                "sample_rate", "lossless", "part", "offset", "fingerprint", "n_submissions"]
DERIVED_COLUMNS = ["has_tag", "has_exempt_tag", "a5_keywords", "n_clipped_features",
                   "loudness", "dyn_complexity", "silence60"]
# R8 세 특징 → apply_rules 의 짧은 이름. R15 네 특징은 JSON 의 이름 그대로 컬럼이 된다.
SILENCE_RENAME = {"lowlevel.average_loudness": "loudness",
                  "lowlevel.dynamic_complexity": "dyn_complexity",
                  "lowlevel.silence_rate_60dB.mean": "silence60"}


def required_columns(rules):
    """apply_rules 가 읽는 컬럼 전부. 이 목록이 출력 스키마다."""
    p15 = rules["R15_static"]["params"]
    return META_COLUMNS + PC + DERIVED_COLUMNS + list(p15["features"]) + [p15["onset_feature"]]


def load_rules():
    path = os.path.join(ROOT, "pipeline", "exclusion_rules.json")
    return {r["id"]: r for r in json.load(io.open(path, encoding="utf-8"))["rules"]}


def assemble(meta, X, features, a5_hits, a4_clipped, has_tag, has_exempt_tag, rules):
    """순수 조립. meta 행 순서를 그대로 유지한다.

    meta      : META_COLUMNS 를 가진 DataFrame (load_all 의 반환)
    X         : (N, 16) 좌표
    features  : {특징 이름: (N,) float} — SILENCE_RENAME 의 세 개 + R15 네 개
    a5_hits   : DataFrame[mbid, keyword]   (audit_A5_hits)
    a4_clipped: DataFrame[mbid, n_clipped_features]
    has_tag / has_exempt_tag : (N,) bool
    """
    out = meta[META_COLUMNS].reset_index(drop=True).copy()
    for i, pc in enumerate(PC):
        out[pc] = X[:, i].astype(np.float32)
    out["has_tag"] = np.asarray(has_tag, bool)
    out["has_exempt_tag"] = np.asarray(has_exempt_tag, bool)

    a5 = a5_hits.copy()
    a5["mbid"] = a5["mbid"].astype(str).str.lower()
    kw = a5.groupby("mbid")["keyword"].agg(lambda s: sorted(set(s)))
    out["a5_keywords"] = out["mbid"].map(kw)
    out["a5_keywords"] = out["a5_keywords"].apply(lambda v: v if isinstance(v, list) else [])

    a4 = a4_clipped.copy()
    a4["mbid"] = a4["mbid"].astype(str).str.lower()
    clipped = a4.drop_duplicates("mbid").set_index("mbid")["n_clipped_features"]
    out["n_clipped_features"] = out["mbid"].map(clipped).fillna(0).astype(np.int32)

    for source, short in SILENCE_RENAME.items():
        out[short] = np.asarray(features[source], np.float64)
    p15 = rules["R15_static"]["params"]
    for name in list(p15["features"]) + [p15["onset_feature"]]:
        out[name] = np.asarray(features[name], np.float64)

    columns = required_columns(rules)
    missing = [c for c in columns if c not in out.columns]
    if missing:
        raise ValueError("빠진 컬럼: {}".format(missing))
    return out[columns]


def tag_flags(mbids, exempt_keywords):
    """genres_raw 전체를 훑어 (has_tag, has_exempt_tag). 예외 키워드가 없으면 태그 유무만 본다."""
    pos = pd.Series(np.arange(len(mbids)), index=pd.Index(mbids))
    has_tag = np.zeros(len(mbids), bool)
    has_exempt = np.zeros(len(mbids), bool)
    exempt_keywords = [k.lower() for k in exempt_keywords]
    pf = pq.ParquetFile(os.path.join(WORK, "genres_raw.parquet"))
    for rg in range(pf.num_row_groups):
        t = pf.read_row_group(rg, columns=["mbid", "genre"]).to_pandas()
        ii = pos.reindex(t["mbid"].astype(str).str.lower()).to_numpy()
        keep = np.isfinite(ii)
        idx = ii[keep].astype(np.int64)
        has_tag[idx] = True
        if exempt_keywords:
            hit = np.array([any(k in str(g).lower() for g in gl for k in exempt_keywords)
                            for gl in t["genre"].to_numpy()[keep]], bool)
            np.logical_or.at(has_exempt, idx, hit)
    return has_tag, has_exempt


def main(out_path=None):
    import exclusion_apply as X5   # noqa: E402  — 로컬 기준 구현의 로더를 그대로 쓴다
    rules = load_rules()
    started = time.time()
    meta, coords = X5.load_all()
    print("base 곡 {:,} ({})".format(len(meta), X5.SERV))
    p15 = rules["R15_static"]["params"]
    feature_names = list(SILENCE_RENAME) + list(p15["features"]) + [p15["onset_feature"]]
    features = X5.scan_feature_columns(meta, feature_names)
    has_tag, has_exempt = tag_flags(meta["mbid"].to_numpy(), rules["R1_length"]["params"].get("long_exempt_tags", []))
    table = assemble(meta, coords, features,
                     pd.read_parquet(os.path.join(WORK, "audit_A5_hits.parquet")),
                     pd.read_parquet(os.path.join(WORK, "audit_A4_clipped.parquet")),
                     has_tag, has_exempt, rules)
    out_path = out_path or os.path.join(WORK, "catalog_input.parquet")
    pq.write_table(pa.Table.from_pandas(table, preserve_index=False), out_path,
                   row_group_size=500_000, compression="snappy")
    summary = {"rows": len(table), "columns": list(table.columns), "base": X5.SERV,
               "out": out_path, "size_bytes": os.path.getsize(out_path),
               "has_tag": int(table["has_tag"].sum()), "a5_any": int(table["a5_keywords"].map(len).gt(0).sum()),
               "clipped_ge1": int((table["n_clipped_features"] > 0).sum()),
               "loudness_nan": int(table["loudness"].isna().sum()),
               "elapsed_s": round(time.time() - started, 1)}
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
