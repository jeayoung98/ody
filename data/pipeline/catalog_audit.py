# -*- coding: utf-8 -*-
"""Stage S0 — 카탈로그 감사 (읽기 전용). A1~A8 을 숫자·표본으로 -> output/catalog_audit.{md,json}

입력: work/v2_manifest.parquet, work/v2_song_meta.parquet, work/v2_feats*/ (특징), work/genres_raw.parquet,
      work/titles*.parquet (원문 제목·아티스트), work/v2_m1_pairs.parquet + v2_m1_feats (A7),
      serving/v2-pca16 (좌표·번들), data/canonical (A8)
아무것도 쓰지 않는다 (output/ 리포트·json, work/audit_* 중간물 제외).
"""
import io
import json
import os
import re
import sys
import time

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "work"); OUT = os.path.join(ROOT, "output")
SERV = os.path.join(ROOT, "serving", "v2-pca16")
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from korean_common import KEPT, apply_skew          # noqa: E402

PC = ["pc{}".format(i) for i in range(1, 17)]
SEED = 42
NONMUSIC_KW = ["audiobook", "spoken word", "speech", "sound effect", "field recording", "white noise",
               "asmr", "podcast", "sermon", "lecture", "comedy", "interview"]
LONG_EXEMPT_KW = ["classical", "opera", "ambient"]
DROP_MODS = [r"re-?master(ed)?", r"\bmono\b", r"\bstereo\b", r"single version", r"album version", r"radio edit",
             r"\bedit\b", r"\bdeluxe\b", r"anniversary", r"bonus track", r"expanded", r"reissue",
             r"\b(19|20)\d{2}\b", r"\bversion\b", r"\bmix\b(?!.*remix)"]
DISTINCT_MODS = ["live", "acoustic", "remix", "instrumental", "unplugged", "demo", "karaoke", "cover"]
DIST_PROTECT = 4.0
HANGUL = re.compile(r"[가-힣]")


def fmt(n): return "{:,}".format(int(n))


def base_norm(t):
    t = (t or "").lower()
    return re.sub(r"[^0-9a-z가-힣]+", "", t)


def r6_key(title):
    """R6 묶음 키: 본문 정규화 + 유지 수식어 태그. (본문, 유지태그, 제거태그, 미분류블록)"""
    t = (title or "").lower()
    blocks = re.findall(r"\(([^)]*)\)|\[([^\]]*)\]", t)
    blocks = [a or b for a, b in blocks]
    main = re.sub(r"\(([^)]*)\)|\[([^\]]*)\]", " ", t)
    # " - suffix" 도 수식어 블록으로
    if " - " in main:
        head, tail = main.split(" - ", 1)
        blocks.append(tail); main = head
    keep, dropped, unknown = set(), [], []
    for b in blocks:
        b = b.strip()
        if not b:
            continue
        hit_d = [m for m in DISTINCT_MODS if re.search(r"\b" + m + r"\b", b)]
        if hit_d:
            keep.update(hit_d); continue
        if any(re.search(p, b) for p in DROP_MODS):
            dropped.append(b); continue
        unknown.append(b)
    # 본문에 박힌 연도/remaster 도 제거
    main = re.sub(r"\b(19|20)\d{2}\s*(re-?master(ed)?)?\b", " ", main)
    main = re.sub(r"re-?master(ed)?", " ", main)
    key = base_norm(main)
    if unknown:                      # 미분류 블록은 보수적으로 키에 남긴다 (접지 않음)
        key += "|" + base_norm(" ".join(sorted(unknown)))
    if keep:
        key += "|" + "+".join(sorted(keep))
    return key, sorted(keep), dropped, unknown


def load_titles_majority(r2c):
    """canonical 당 다수결 (원문 아티스트, 원문 제목) — first-seen(낮은 part) 동률 해소."""
    fr = []
    for p in range(30):
        t = pd.read_parquet(os.path.join(WORK, "titles.parquet" if p == 0 else "titles_part{}.parquet".format(p)),
                            columns=["mbid", "title", "artist"])
        t["part"] = np.int8(p); fr.append(t)
    ab = pd.concat(fr, ignore_index=True); del fr
    ab["mbid"] = ab["mbid"].astype(str).str.lower()
    ab["canonical"] = ab["mbid"].map(r2c).fillna(ab["mbid"])
    ab["title"] = ab["title"].fillna("").astype(str).str.strip(); ab["artist"] = ab["artist"].fillna("").astype(str).str.strip()
    ab = ab[(ab["title"] != "") | (ab["artist"] != "")]
    ab["tk"] = ab["title"].str.lower(); ab["ak"] = ab["artist"].str.lower()
    v = ab.groupby(["canonical", "ak", "tk"], sort=False).agg(n=("part", "size"), fp=("part", "min"),
                                                            artist=("artist", "first"), title=("title", "first")).reset_index()
    v.sort_values(["canonical", "n", "fp"], ascending=[True, False, True], inplace=True, kind="stable")
    return v.drop_duplicates("canonical")[["canonical", "artist", "title"]].set_index("canonical")


def main():
    t0 = time.time()
    A = {}
    man = pd.read_parquet(os.path.join(WORK, "v2_manifest.parquet"))
    man["mbid"] = man["mbid"].astype(str).str.lower()
    meta = pd.read_parquet(os.path.join(WORK, "v2_song_meta.parquet"))
    meta = meta.merge(man[["mbid", "part", "offset", "fingerprint", "sample_rate"]], on="mbid", how="left")
    co = pd.read_parquet(os.path.join(SERV, "coords_v2.parquet")); co["mbid"] = co["mbid"].astype(str).str.lower()
    meta = meta.set_index("mbid").loc[co["mbid"]].reset_index()
    X = co[PC].to_numpy(np.float32); del co
    N = len(meta); A["n_songs"] = N
    rd = pd.read_parquet(os.path.join(ROOT, "data", "canonical", "canonical_recording_redirect.parquet"))
    r2c = pd.Series(rd["canonical_recording_mbid"].str.lower().to_numpy(), index=rd["recording_mbid"].str.lower()); del rd
    print("meta+coords {} ({:.1f}m)".format(fmt(N), (time.time() - t0) / 60), flush=True)

    raw = load_titles_majority(r2c)
    meta["title_raw"] = meta["canonical"].map(raw["title"]).fillna(""); meta["artist_raw"] = meta["canonical"].map(raw["artist"]).fillna("")
    del raw
    print("titles 다수결 원문 병합 ({:.1f}m)".format((time.time() - t0) / 60), flush=True)
    rng = np.random.default_rng(SEED)

    def sample(mask, n=10):
        idx = np.flatnonzero(mask)
        if len(idx) == 0: return []
        pick = rng.choice(idx, min(n, len(idx)), replace=False)
        return [{"mbid": meta["mbid"].iat[i], "artist": meta["artist_raw"].iat[i][:60], "title": meta["title_raw"].iat[i][:80],
                 "length_s": None if pd.isna(meta["length"].iat[i]) else round(float(meta["length"].iat[i]), 1),
                 "sample_rate": None if pd.isna(meta["sample_rate"].iat[i]) else int(meta["sample_rate"].iat[i]),
                 "codec": meta["codec"].iat[i]} for i in pick]

    length = meta["length"].to_numpy(float); sr = meta["sample_rate"].to_numpy(float)
    # ---------------- A1 ----------------
    short = length < 30; long_ = length > 1200
    A["A1"] = {"lt30s": int(short.sum()), "gt20min": int(long_.sum()), "length_nan": int(np.isnan(length).sum()),
               "pct": {"p0.1": float(np.nanpercentile(length, 0.1)), "p1": float(np.nanpercentile(length, 1)),
                       "median": float(np.nanmedian(length)), "p99": float(np.nanpercentile(length, 99)), "p99.9": float(np.nanpercentile(length, 99.9))},
               "sample_short": sample(short), "sample_long": sample(long_)}
    # ---------------- A2 ----------------
    low_sr = np.isfinite(sr) & (sr < 44100)
    mu_all, sd_all = X.mean(0), X.std(0); mu_low = X[low_sr].mean(0) if low_sr.any() else mu_all
    A["A2"] = {"lt44100": int(low_sr.sum()), "sr_dist": {str(int(k)): int(v) for k, v in pd.Series(sr[np.isfinite(sr)]).value_counts().head(8).items()},
               "pc_bias_in_std": [float(x) for x in (mu_low - mu_all) / sd_all], "max_abs_bias_std": float(np.max(np.abs((mu_low - mu_all) / sd_all))),
               "sample": sample(low_sr)}
    # ---------------- A6 ----------------
    art_n = meta["artist_norm"].fillna("").to_numpy()
    keys, keep_cnt, drop_cnt, unk_cnt = [], 0, 0, 0
    for tt in meta["title_raw"].to_numpy():
        k, kp, dr, un = r6_key(tt); keys.append(k)
        keep_cnt += bool(kp); drop_cnt += bool(dr); unk_cnt += bool(un)
    keys = np.array(keys, dtype=object)
    valid = (art_n != "") & (keys != "")
    gk = pd.Series(np.where(valid, art_n + "||" + keys.astype(str), ""))
    codes, uniq = pd.factorize(gk[valid])
    sizes = np.bincount(codes)
    multi = sizes > 1
    A["A6"] = {"songs_with_key": int(valid.sum()), "groups": int(len(uniq)), "groups_multi": int(multi.sum()),
               "songs_in_multi_groups": int(sizes[multi].sum()), "fold_candidates": int((sizes[multi] - 1).sum()),
               "size_dist": {str(k): int(v) for k, v in zip(*np.unique(np.minimum(sizes[multi], 10), return_counts=True))},
               "titles_with_drop_mod": int(drop_cnt), "titles_with_distinct_mod": int(keep_cnt), "titles_with_unknown_block": int(unk_cnt)}
    # 보호 추정: 그룹 대표(lossless > part > offset) 와 거리 > 4
    vidx = np.flatnonzero(valid)
    df = pd.DataFrame({"g": codes, "i": vidx, "ll": ~meta["lossless"].to_numpy(bool)[vidx],
                       "part": meta["part"].to_numpy()[vidx], "off": meta["offset"].to_numpy()[vidx]})
    df = df[np.isin(df["g"], np.flatnonzero(multi))].sort_values(["g", "ll", "part", "off"], kind="stable")
    rep = df.drop_duplicates("g").set_index("g")["i"]
    df["rep"] = df["g"].map(rep)
    mem = df[df["i"] != df["rep"]]
    d = np.linalg.norm(X[mem["i"].to_numpy()] - X[mem["rep"].to_numpy()], axis=1)
    A["A6"].update({"member_dist": {"median": float(np.median(d)), "p90": float(np.percentile(d, 90)), "p99": float(np.percentile(d, 99))},
                    "protected_gt4": int((d > DIST_PROTECT).sum()), "protected_share": float((d > DIST_PROTECT).mean()),
                    "would_fold": int((d <= DIST_PROTECT).sum())})
    # 표본: 묶음 5개 (대표 + 멤버 + 거리)
    gs = rng.choice(mem["g"].unique(), 5, replace=False)
    A["A6"]["sample_groups"] = []
    for g_ in gs:
        r = int(rep[g_]); ms = mem[mem["g"] == g_]
        A["A6"]["sample_groups"].append({"rep": "{} — {}".format(meta["artist_raw"].iat[r][:40], meta["title_raw"].iat[r][:60]),
                                         "members": [{"title": meta["title_raw"].iat[int(i)][:60], "dist": round(float(dd), 2), "codec": meta["codec"].iat[int(i)]}
                                                     for i, dd in zip(ms["i"], np.linalg.norm(X[ms["i"].to_numpy()] - X[r], axis=1))][:8]})
    print("A1/A2/A6 완료 ({:.1f}m)".format((time.time() - t0) / 60), flush=True)

    # ---------------- A3 / A4: 특징 스캔 ----------------
    B = np.load(os.path.join(SERV, "model_bundle.npz")); Bd = {k: B[k].astype(np.float64) for k in B.files if B[k].ndim}
    clip = float(B["winsorize_clip"])
    loud = np.full(N, np.nan); dyn = np.full(N, np.nan); sil = np.full(N, np.nan); nclip = np.zeros(N, np.int16)
    pos = pd.Series(np.arange(N), index=meta["mbid"])
    j_loud = KEPT.index("lowlevel.average_loudness"); j_dyn = KEPT.index("lowlevel.dynamic_complexity"); j_sil = KEPT.index("lowlevel.silence_rate_60dB.mean")
    for d_ in ("v2_feats", "v2_feats_pilot"):
        for f in sorted(os.listdir(os.path.join(WORK, d_))):
            if not f.endswith(".parquet"): continue
            t = pd.read_parquet(os.path.join(WORK, d_, f), columns=["mbid", "lossless"] + KEPT)
            ii = pos.reindex(t["mbid"].astype(str).str.lower()).to_numpy()
            Xf = t[KEPT].to_numpy(np.float64); ll = t["lossless"].to_numpy(bool)
            loud[ii] = Xf[:, j_loud]; dyn[ii] = Xf[:, j_dyn]; sil[ii] = Xf[:, j_sil]
            Z = apply_skew(Xf); Z[~ll] += Bd["delta_f"]
            np.copyto(Z, np.broadcast_to(Bd["impute_median"], Z.shape), where=np.isnan(Z))
            Z -= Bd["scaler_center"]; Z /= Bd["scaler_scale"]
            nclip[ii] = (np.abs(Z) > clip).sum(1)
    q = np.nanpercentile(loud, 0.1)
    silent = (loud <= q) & ((dyn < 0.1) | (sil > 0.9))
    A["A3"] = {"loudness_p0.1": float(q), "loudness_pct": {"p1": float(np.nanpercentile(loud, 1)), "median": float(np.nanmedian(loud))},
               "bottom_0.1pct": int((loud <= q).sum()), "silence_candidates": int(silent.sum()),
               "dyn_lt0.1_in_bottom": int(((loud <= q) & (dyn < 0.1)).sum()), "sil60_gt0.9_in_bottom": int(((loud <= q) & (sil > 0.9)).sum()),
               "sample": sample(silent)}
    corrupt = nclip > 0
    A["A4"] = {"songs_with_clip": int(corrupt.sum()), "share": float(corrupt.mean()), "clip_count_dist": {str(k): int(v) for k, v in zip(*np.unique(np.minimum(nclip[corrupt], 20), return_counts=True))},
               "sample": sample(corrupt)}
    pd.DataFrame({"mbid": meta["mbid"].to_numpy()[corrupt], "n_clipped_features": nclip[corrupt]}).to_parquet(os.path.join(WORK, "audit_A4_clipped.parquet"), index=False)
    print("A3/A4 완료 ({:.1f}m)".format((time.time() - t0) / 60), flush=True)

    # ---------------- A7: 같은 MBID 제출본 간 거리 (M1 쌍, v2 공간) ----------------
    from v2_fit_m1 import load_side_tables
    from v2_transform_all import load_bundle, transform
    pairs = pd.read_parquet(os.path.join(WORK, "v2_m1_pairs.parquet")).sample(n=100_000, random_state=SEED)
    ka = [f"{m}-{o}" for m, o in zip(pairs["mbid"], pairs["offset_lossless"])]; kb = [f"{m}-{o}" for m, o in zip(pairs["mbid"], pairs["offset_lossy"])]
    side = load_side_tables(set(ka) | set(kb)); spos = {k: i for i, k in enumerate(side["mbid"].astype(str) + "-" + side["offset"].astype(str))}
    ia = np.array([spos.get(k, -1) for k in ka]); ib = np.array([spos.get(k, -1) for k in kb]); ok = (ia >= 0) & (ib >= 0)
    Bv2 = load_bundle.__globals__["BUNDLE_DIR"] = SERV; Bz = load_bundle()
    P = transform(side[KEPT].to_numpy(np.float64), side["lossless"].to_numpy(bool), Bz)
    d7 = np.linalg.norm(P[ia[ok]] - P[ib[ok]], axis=1)
    A["A7"] = {"pairs": int(ok.sum()), "note": "같은 MBID 의 lossless 대표 vs lossy 제출본, v2 좌표 거리 (M1 쌍 표본)",
               "dist": {"median": float(np.median(d7)), "p75": float(np.percentile(d7, 75)), "p90": float(np.percentile(d7, 90)), "p99": float(np.percentile(d7, 99))},
               "share_gt4": float((d7 > DIST_PROTECT).mean()), "share_gt_tau_dup_1.66": float((d7 > 1.66).mean()),
               "ref": {"random_pair_median_v1_space": 15.7, "pos_pair_median": 10.7}}
    del side, P
    print("A7 완료 ({:.1f}m)".format((time.time() - t0) / 60), flush=True)

    # ---------------- A8 ----------------
    cdir = os.path.join(ROOT, "data", "canonical", "musicbrainz-canonical-dump-20260817-080002", "canonical")
    files = os.listdir(cdir) if os.path.isdir(cdir) else []
    cols = {}
    for f in files:
        if f.endswith(".csv"):
            with io.open(os.path.join(cdir, f), encoding="utf-8", errors="ignore") as fh: cols[f] = fh.readline().strip()
    A["A8"] = {"files": cols, "release_year_available": any("year" in c.lower() or "date" in c.lower() for c in cols.values()),
               "note": "AB 문서 metadata.tags.date 는 titles 추출 시 수집하지 않았음 — 연도 사용은 588GB 재패스 필요"}

    # ---------------- A5 + 표본 태그: genres_raw 스캔 ----------------
    import pyarrow.parquet as pq
    mset = set(meta["mbid"]); hits = {k: set() for k in NONMUSIC_KW}
    long_set = set(meta["mbid"].to_numpy()[long_]); long_tags = {}
    want_tags = set()
    for sec in ("A1", "A2", "A3", "A4"):
        for key in ("sample", "sample_short", "sample_long"):
            for s in A[sec].get(key, []): want_tags.add(s["mbid"])
    tag_of = {}
    pf = pq.ParquetFile(os.path.join(WORK, "genres_raw.parquet"))
    for rg in range(pf.num_row_groups):
        t = pf.read_row_group(rg).to_pandas()
        t["mbid"] = t["mbid"].astype(str).str.lower(); t = t[t["mbid"].isin(mset)]
        for m, gl in zip(t["mbid"].to_numpy(), t["genre"].to_numpy()):
            gl_l = [str(x).lower() for x in gl]
            for kw in NONMUSIC_KW:
                if any(kw in g for g in gl_l): hits[kw].add(m)
            if m in long_set:
                long_tags.setdefault(m, set()).update(gl_l)
            if m in want_tags:
                tag_of.setdefault(m, set()).update(gl_l)
    all_hit = set().union(*hits.values())
    A["A5"] = {"by_keyword": {k: len(v) for k, v in hits.items()}, "any_keyword": len(all_hit),
               "sample": [{"mbid": m, "artist": meta["artist_raw"].iat[int(pos[m])][:60], "title": meta["title_raw"].iat[int(pos[m])][:80],
                           "length_s": None if pd.isna(meta["length"].iat[int(pos[m])]) else round(float(meta["length"].iat[int(pos[m])]), 1),
                           "kw": [k for k in NONMUSIC_KW if m in hits[k]]} for m in rng.choice(sorted(all_hit), min(10, len(all_hit)), replace=False)] if all_hit else []}
    pd.DataFrame([(m, k) for k, v in hits.items() for m in v], columns=["mbid", "keyword"]).to_parquet(os.path.join(WORK, "audit_A5_hits.parquet"), index=False)
    # A1: >20min 중 예외 태그 비율
    ex = sum(1 for m in long_set if any(any(k in g for g in long_tags.get(m, ())) for k in LONG_EXEMPT_KW))
    tagged = sum(1 for m in long_set if long_tags.get(m))
    A["A1"].update({"gt20min_tagged": tagged, "gt20min_exempt_tag": ex, "gt20min_exempt_share_of_tagged": (ex / tagged) if tagged else None})
    for sec in ("A1", "A2", "A3", "A4"):
        for key in ("sample", "sample_short", "sample_long"):
            for s in A[sec].get(key, []): s["tags"] = sorted(tag_of.get(s["mbid"], set()))[:6]
    A["elapsed_min"] = (time.time() - t0) / 60
    json.dump(A, io.open(os.path.join(OUT, "catalog_audit.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False, default=float)
    write_report(A)
    print("완료 {:.1f}m -> output/catalog_audit.md".format(A["elapsed_min"]))


def write_report(A):
    L = []; w = L.append; N = A["n_songs"]
    def pc(n): return "{:.3%}".format(n / N)
    def samp(rows):
        if not rows: return ["(표본 없음)"]
        out = ["| 아티스트 | 제목 | 길이(s) | SR | 코덱 | 태그 |", "|:--|:--|--:|--:|:--|:--|"]
        for r in rows:
            out.append("| {} | {} | {} | {} | {} | {} |".format(r["artist"], r["title"], r["length_s"], r["sample_rate"] if "sample_rate" in r else "", r.get("codec", ""),
                                                             ", ".join(r.get("tags", r.get("kw", [])))[:80]))
        return out
    w("# 카탈로그 감사 (S0, 읽기 전용) — v2 {} 곡".format(fmt(N))); w("")
    w("생성: {} · 소요 {:.1f}분 · 표본 seed {}. 규칙 값은 이 숫자로만 정한다.".format(time.strftime("%Y-%m-%d %H:%M"), A["elapsed_min"], SEED)); w("")
    a = A["A1"]
    w("## A1 길이 극단"); w("")
    w("| | 곡 수 | 비율 |"); w("|:--|--:|--:|")
    w("| < 30s | {} | {} |".format(fmt(a["lt30s"]), pc(a["lt30s"]))); w("| > 20min | {} | {} |".format(fmt(a["gt20min"]), pc(a["gt20min"])))
    w("| length 결측 | {} | {} |".format(fmt(a["length_nan"]), pc(a["length_nan"]))); w("")
    w("길이 분포: p0.1 {:.1f}s · p1 {:.1f}s · median {:.1f}s · p99 {:.0f}s · p99.9 {:.0f}s".format(a["pct"]["p0.1"], a["pct"]["p1"], a["pct"]["median"], a["pct"]["p99"], a["pct"]["p99.9"])); w("")
    w("**>20min 중 태그 있는 곡 {} 중 클래식/오페라/앰비언트 태그 {} ({})** → R1 예외 유지 여부 판단 재료.".format(
        fmt(a["gt20min_tagged"]), fmt(a["gt20min_exempt_tag"]), "{:.1%}".format(a["gt20min_exempt_share_of_tagged"]) if a["gt20min_exempt_share_of_tagged"] is not None else "—")); w("")
    w("표본 <30s:"); L += samp(a["sample_short"]); w(""); w("표본 >20min:"); L += samp(a["sample_long"]); w("")
    a = A["A2"]
    w("## A2 샘플레이트 < 44100"); w("")
    w("곡 수 **{}** ({}). SR 분포 상위: {}".format(fmt(a["lt44100"]), pc(a["lt44100"]), ", ".join("{} {}".format(k, fmt(v)) for k, v in a["sr_dist"].items()))); w("")
    w("좌표 편향 (저SR 평균 − 전체 평균, 축 std 단위): " + ", ".join("pc{} {:+.2f}".format(i + 1, b) for i, b in enumerate(a["pc_bias_in_std"])) + " · **최대 |편향| {:.2f} std**".format(a["max_abs_bias_std"])); w("")
    L += samp(a["sample"]); w("")
    a = A["A3"]
    w("## A3 무음 후보"); w("")
    w("average_loudness p0.1 = {:.4f} (p1 {:.4f}, median {:.4f}). 하위 0.1% {}곡 중 dynamic_complexity<0.1 {} · silence_rate_60dB>0.9 {} → **후보 {} ({})**".format(
        a["loudness_p0.1"], a["loudness_pct"]["p1"], a["loudness_pct"]["median"], fmt(a["bottom_0.1pct"]), fmt(a["dyn_lt0.1_in_bottom"]), fmt(a["sil60_gt0.9_in_bottom"]), fmt(a["silence_candidates"]), pc(a["silence_candidates"]))); w("")
    L += samp(a["sample"]); w("")
    a = A["A4"]
    w("## A4 손상 추출 (winsorize ±20 IQR 적중)"); w("")
    w("적중 곡 **{}** ({}). 적중 특징 수 분포: {}. 전체 목록 `work/audit_A4_clipped.parquet`.".format(fmt(a["songs_with_clip"]), pc(a["songs_with_clip"]), ", ".join("{}개 {}".format(k, fmt(v)) for k, v in a["clip_count_dist"].items()))); w("")
    L += samp(a["sample"]); w("")
    a = A["A5"]
    w("## A5 비음악 태그"); w("")
    w("| 키워드 | 적중 곡 |"); w("|:--|--:|")
    for k, v in sorted(a["by_keyword"].items(), key=lambda kv: -kv[1]): w("| {} | {} |".format(k, fmt(v)))
    w("| **합집합** | **{}** ({}) |".format(fmt(a["any_keyword"]), pc(a["any_keyword"]))); w("")
    w("표본 (적중 키워드):"); L += samp(a["sample"]); w("")
    a = A["A6"]
    w("## A6 중복 사전 추정 (R6 키: 아티스트 + 제목−수식어, live/acoustic/remix 등은 별도 묶음)"); w("")
    w("| | 값 |"); w("|:--|--:|")
    w("| 키 있는 곡 | {} |".format(fmt(a["songs_with_key"]))); w("| 묶음 수 | {} |".format(fmt(a["groups"])))
    w("| 2곡 이상 묶음 | {} (곡 {}) |".format(fmt(a["groups_multi"]), fmt(a["songs_in_multi_groups"])))
    w("| 접힐 후보 (대표 제외) | **{}** ({}) |".format(fmt(a["fold_candidates"]), pc(a["fold_candidates"])))
    w("| 대표와 거리 > {} 로 보호 | **{}** ({:.1%} of 후보) |".format(DIST_PROTECT, fmt(a["protected_gt4"]), a["protected_share"]))
    w("| 실제 접힘 예상 | **{}** ({}) |".format(fmt(a["would_fold"]), pc(a["would_fold"])))
    w("| 멤버-대표 거리 median / p90 / p99 | {:.2f} / {:.2f} / {:.2f} |".format(a["member_dist"]["median"], a["member_dist"]["p90"], a["member_dist"]["p99"]))
    w("| 제목에 제거 수식어 / 유지 수식어 / 미분류 괄호 | {} / {} / {} |".format(fmt(a["titles_with_drop_mod"]), fmt(a["titles_with_distinct_mod"]), fmt(a["titles_with_unknown_block"]))); w("")
    w("묶음 크기 분포 (10+ 는 10): " + ", ".join("{}곡 {}".format(k, fmt(v)) for k, v in sorted(a["size_dist"].items(), key=lambda kv: int(kv[0])))); w("")
    w("표본 묶음 5개 (대표 → 멤버, 좌표 거리):"); w("")
    for g in a["sample_groups"]:
        w("- **{}**".format(g["rep"]))
        for m in g["members"]: w("  - {} — d={} ({}){}".format(m["title"], m["dist"], m["codec"], " **보호**" if m["dist"] > DIST_PROTECT else ""))
    w("")
    a = A["A7"]
    w("## A7 대표 민감도 (같은 MBID 제출본 간 v2 좌표 거리)"); w("")
    w("{} — 쌍 {}: median **{:.2f}** · p75 {:.2f} · p90 {:.2f} · p99 {:.2f}. 거리 > 4 비율 **{:.1%}**, > τ_dup(1.66) 비율 {:.1%}. "
      "참조: 정답쌍 median 10.7, 랜덤쌍 ~15.7.".format(a["note"], fmt(a["pairs"]), a["dist"]["median"], a["dist"]["p75"], a["dist"]["p90"], a["dist"]["p99"], a["share_gt4"], a["share_gt_tau_dup_1.66"])); w("")
    a = A["A8"]
    w("## A8 연도 소스"); w("")
    for f, c in a["files"].items(): w("- `{}`: `{}`".format(f, c))
    w("- release year 컬럼: **{}**. {}".format("있음" if a["release_year_available"] else "없음", a["note"])); w("")
    w("## 규칙 값 도출 시 참고 (S1 에서 확정)"); w("")
    w("- R1: <30s {} / >20min {} — >20min 예외 태그 비율 {}".format(fmt(A["A1"]["lt30s"]), fmt(A["A1"]["gt20min"]), "{:.1%}".format(A["A1"]["gt20min_exempt_share_of_tagged"]) if A["A1"]["gt20min_exempt_share_of_tagged"] is not None else "—"))
    w("- R2: 적중 있는 키워드만 — 합집합 {}".format(fmt(A["A5"]["any_keyword"])))
    w("- R6: 접힘 예상 {} (보호 {}), 연도 소스 없음 → 대표 = 수식어 없는 제목 → lossless → 제출본 수 → (part, offset)".format(fmt(A["A6"]["would_fold"]), fmt(A["A6"]["protected_gt4"])))
    w("- R7: 최대 |편향| {:.2f} std — {}".format(A["A2"]["max_abs_bias_std"], "유의(≥0.5 std) → 제외 후보" if A["A2"]["max_abs_bias_std"] >= 0.5 else "미미 → 플래그만"))
    w("- R8: {} 곡 · R9: {} 곡 (표본 검수 후)".format(fmt(A["A3"]["silence_candidates"]), fmt(A["A4"]["songs_with_clip"])))
    io.open(os.path.join(OUT, "catalog_audit.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
