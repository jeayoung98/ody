# -*- coding: utf-8 -*-
"""Stage S1 — 제외 규칙 dry-run / apply. 규칙 값은 pipeline/exclusion_rules.json 에서만 읽는다.

dry_run=True : 규칙별 적중·겹침·총 제외 비율·표본 10곡, R6 묶음 30개 -> output/exclusion_dryrun.{md,json}
               총 제외 > stop_if_total_excluded_share 면 멈추고 보고.
dry_run=False: work/catalog_v2.parquet (전 행 + excluded/excluded_reason/dup_group_id/is_representative/flags),
               serving/v2.1-pca16 (excluded=false 만, fit·트리 재학습 없음, 규칙 해시 기록),
               output/exclusion_report.md (규칙별·depth-1 노드별), 최소 재검증 (브릿지 풀 Hit@10 전/후).
삭제 없음. 곡 개별 제외 없음 — 모든 제외는 규칙에서만 나온다.
"""
import hashlib
import io
import json
import os
import re
import shutil
import sys
import time

import numpy as np
import pandas as pd
import pyarrow.parquet as pq

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "work"); OUT = os.path.join(ROOT, "output"); PIPE = os.path.dirname(os.path.abspath(__file__))
SERV = os.path.join(ROOT, "serving", "v2-pca16"); SERV_NEW = os.path.join(ROOT, "serving", "v2.1-pca16")
sys.path.insert(0, os.path.join(ROOT, "scripts")); sys.path.insert(0, PIPE)
from korean_common import KEPT                                    # noqa: E402
from catalog_audit import r6_key, load_titles_majority, LONG_EXEMPT_KW   # noqa: E402

PC = ["pc{}".format(i) for i in range(1, 17)]
SEED = 42
fmt = lambda n: "{:,}".format(int(n))


def load_all():
    man = pd.read_parquet(os.path.join(WORK, "v2_manifest.parquet")); man["mbid"] = man["mbid"].astype(str).str.lower()
    meta = pd.read_parquet(os.path.join(WORK, "v2_song_meta.parquet"))
    meta = meta.merge(man[["mbid", "part", "offset", "fingerprint", "sample_rate"]], on="mbid", how="left")
    co = pd.read_parquet(os.path.join(SERV, "coords_v2.parquet")); co["mbid"] = co["mbid"].astype(str).str.lower()
    meta = meta.set_index("mbid").loc[co["mbid"]].reset_index()
    X = co[PC].to_numpy(np.float32); del co
    rd = pd.read_parquet(os.path.join(ROOT, "data", "canonical", "canonical_recording_redirect.parquet"))
    r2c = pd.Series(rd["canonical_recording_mbid"].str.lower().to_numpy(), index=rd["recording_mbid"].str.lower()); del rd
    raw = load_titles_majority(r2c)
    meta["title_raw"] = meta["canonical"].map(raw["title"]).fillna(""); meta["artist_raw"] = meta["canonical"].map(raw["artist"]).fillna("")
    # 제출본 수 (census, 코호트 제출본 기준) — R6 대표 선정용
    pf = pq.ParquetFile(os.path.join(WORK, "census_all.parquet")); cnt = None
    for rg in range(pf.num_row_groups):
        s = pf.read_row_group(rg, columns=["mbid"]).column("mbid").to_pandas().str.lower().value_counts()
        cnt = s if cnt is None else cnt.add(s, fill_value=0)
    meta["n_submissions"] = meta["mbid"].map(cnt).fillna(1).astype(np.int32)
    return meta, X


def scan_tags_for(mbids):
    """주어진 mbid 들의 태그(소문자) 합집합."""
    want = set(mbids); out = {}
    pf = pq.ParquetFile(os.path.join(WORK, "genres_raw.parquet"))
    for rg in range(pf.num_row_groups):
        t = pf.read_row_group(rg).to_pandas(); t["mbid"] = t["mbid"].astype(str).str.lower(); t = t[t["mbid"].isin(want)]
        for m, gl in zip(t["mbid"].to_numpy(), t["genre"].to_numpy()):
            out.setdefault(m, set()).update(str(x).lower() for x in gl)
    return out


def scan_silence_features(meta):
    pos = pd.Series(np.arange(len(meta)), index=meta["mbid"])
    loud = np.full(len(meta), np.nan); dyn = np.full(len(meta), np.nan); sil = np.full(len(meta), np.nan)
    cols = ["mbid", "lowlevel.average_loudness", "lowlevel.dynamic_complexity", "lowlevel.silence_rate_60dB.mean"]
    for d_ in ("v2_feats", "v2_feats_pilot"):
        for f in sorted(os.listdir(os.path.join(WORK, d_))):
            if f.endswith(".parquet"):
                t = pd.read_parquet(os.path.join(WORK, d_, f), columns=cols)
                ii = pos.reindex(t["mbid"].astype(str).str.lower()).to_numpy()
                loud[ii] = t[cols[1]]; dyn[ii] = t[cols[2]]; sil[ii] = t[cols[3]]
    return loud, dyn, sil


def compute(meta, X, R):
    """규칙별 마스크·R6 묶음. 반환: masks(dict), extra(dict)"""
    N = len(meta); masks = {}; extra = {}
    length = meta["length"].to_numpy(float); sr = meta["sample_rate"].to_numpy(float)
    rules = {r["id"]: r for r in R["rules"]}

    # R1
    r = rules["R1_length"]; p = r["params"]
    m_short = length < p["min_s"]; m_long = length > p["max_s"]
    if r.get("enabled") and p.get("long_exempt_tags"):
        tags = scan_tags_for(meta["mbid"].to_numpy()[m_long])
        mb_long = meta["mbid"].to_numpy()[m_long]
        tagged = np.array([bool(tags.get(m)) for m in mb_long])
        exempt = np.array([any(any(k in g for g in tags.get(m, ())) for k in p["long_exempt_tags"]) for m in mb_long])
        very_long = length[m_long] > p.get("max_s_untagged", p["max_s"])
        # 태그 비예외 곡: >max_s 제외 / 미태그 곡: >max_s_untagged 만 제외 / 예외 태그: 유지
        drop = np.where(tagged, ~exempt, very_long)
        idx = np.flatnonzero(m_long); m_long = np.zeros(N, bool); m_long[idx[drop]] = True
        extra.update({"R1_long_exempted": int(exempt.sum()), "R1_long_untagged": int((~tagged).sum()),
                      "R1_long_untagged_kept_lt30min": int(((~tagged) & ~very_long).sum())})
    masks["R1_length"] = (m_short | m_long) if r.get("enabled") else np.zeros(N, bool)

    # R2
    r = rules["R2_nonmusic"]
    hits = pd.read_parquet(os.path.join(WORK, "audit_A5_hits.parquet"))
    hits = hits[hits["keyword"].isin(r["params"]["keywords"])]
    masks["R2_nonmusic"] = meta["mbid"].isin(set(hits["mbid"])).to_numpy() if r.get("enabled") else np.zeros(N, bool)
    allhits = pd.read_parquet(os.path.join(WORK, "audit_A5_hits.parquet"))
    extra["flag_cols"] = {}
    for col, kws in r["params"].get("flag_columns", {"flag_comedy": r["params"].get("flag_keywords", [])}).items():
        fk = allhits[allhits["keyword"].isin(kws)]
        extra["flag_cols"][col] = meta["mbid"].isin(set(fk["mbid"])).to_numpy()

    # R3
    masks["R3_no_key"] = ((meta["title_raw"] == "") & (meta["artist_raw"] == "")).to_numpy() if rules["R3_no_key"].get("enabled") else np.zeros(N, bool)

    # R4 (명시용)
    coh = set(rules["R4_cohort"]["params"]["fingerprints"])
    masks["R4_cohort"] = ~meta["fingerprint"].isin(coh).to_numpy()

    # R5 canonical 잔존 중복: 대표 = lossless > part > offset
    df = pd.DataFrame({"i": np.arange(N), "c": meta["canonical"].to_numpy(), "nll": ~meta["lossless"].to_numpy(bool),
                       "part": meta["part"].to_numpy(), "off": meta["offset"].to_numpy()}).sort_values(["c", "nll", "part", "off"], kind="stable")
    rep5 = df.drop_duplicates("c").set_index("c")["i"]
    df["rep"] = df["c"].map(rep5).to_numpy()
    mem5 = df[df["i"] != df["rep"]].copy()
    mem5["dist"] = np.linalg.norm(X[mem5["i"].to_numpy()] - X[mem5["rep"].to_numpy()], axis=1)
    pd5 = rules["R5_dup_canonical"]["params"].get("protect_dist")
    fold5 = mem5 if pd5 is None else mem5[mem5["dist"] <= pd5]
    m5 = np.zeros(N, bool); m5[fold5["i"].to_numpy()] = True
    masks["R5_dup_canonical"] = m5 if rules["R5_dup_canonical"].get("enabled") else np.zeros(N, bool)
    extra.update({"R5_members": int(len(mem5)), "R5_protected": int(len(mem5) - len(fold5)), "R5_fold": int(len(fold5)),
                  "R5_member_dist_median": float(np.median(mem5["dist"])) if len(mem5) else None})

    # R6 버전 중복
    r = rules["R6_dup_version"]; p = r["params"]
    art = meta["artist_norm"].fillna("").to_numpy()
    keys, nomod = [], []
    for tt in meta["title_raw"].to_numpy():
        k, kp, dr, un = r6_key(tt); keys.append(k); nomod.append(not dr and not un)
    keys = np.array(keys, dtype=object); nomod = np.array(nomod)
    valid = (art != "") & (keys != "") & ~masks["R5_dup_canonical"]
    gk = pd.Series(np.where(valid, art + "||" + keys.astype(str), ""))
    codes, uniq = pd.factorize(gk[valid])
    g = np.full(N, -1, np.int64); g[valid] = codes
    df = pd.DataFrame({"i": np.flatnonzero(valid), "g": codes, "nomod": ~nomod[valid], "nll": ~meta["lossless"].to_numpy(bool)[valid],
                       "nsub": -meta["n_submissions"].to_numpy()[valid], "part": meta["part"].to_numpy()[valid], "off": meta["offset"].to_numpy()[valid]})
    df.sort_values(["g", "nomod", "nll", "nsub", "part", "off"], kind="stable", inplace=True)
    rep = df.drop_duplicates("g").set_index("g")["i"]
    df["rep"] = df["g"].map(rep).to_numpy()
    mem = df[df["i"] != df["rep"]].copy()
    mem["dist"] = np.linalg.norm(X[mem["i"].to_numpy()] - X[mem["rep"].to_numpy()], axis=1)
    fold = mem[mem["dist"] <= p["protect_dist"]]
    m6 = np.zeros(N, bool); m6[fold["i"].to_numpy()] = True
    masks["R6_dup_version"] = m6 if r.get("enabled") else np.zeros(N, bool)
    is_rep = np.zeros(N, bool); is_rep[rep.to_numpy()] = True
    extra.update({"R6_groups_multi": int((np.bincount(codes) > 1).sum()), "R6_members": int(len(mem)),
                  "R6_protected": int((mem["dist"] > p["protect_dist"]).sum()), "R6_fold": int(len(fold)),
                  "dup_group_id": g, "is_representative": is_rep, "R6_mem": mem, "R6_rep": rep})

    # R7
    r = rules["R7_samplerate"]
    m7 = np.isfinite(sr) & (sr < r["params"]["min_sr"])
    masks["R7_samplerate"] = m7 if r.get("enabled") else np.zeros(N, bool); extra["flag_low_sr"] = m7

    # R8
    r = rules["R8_silence"]
    loud, dyn, sil = scan_silence_features(meta)
    q = np.nanpercentile(loud, r["params"]["loudness_bottom_pct"])
    m8 = (loud <= q) & ((dyn < r["params"]["dyn_lt"]) | (sil > r["params"]["silence60_gt"]))
    masks["R8_silence"] = m8 if r.get("enabled") else np.zeros(N, bool); extra["R8_loud_q"] = float(q)

    # R9
    r = rules["R9_corrupt"]
    a4 = pd.read_parquet(os.path.join(WORK, "audit_A4_clipped.parquet"))
    a4 = a4[a4["n_clipped_features"] >= r["params"]["min_clipped_features"]]
    m9 = meta["mbid"].isin(set(a4["mbid"])).to_numpy()
    masks["R9_corrupt"] = m9 if r.get("enabled") else np.zeros(N, bool)
    extra["flag_clipped"] = m9
    return masks, extra


def main(dry_run=True):
    t0 = time.time()
    R = json.load(io.open(os.path.join(PIPE, "exclusion_rules.json"), encoding="utf-8"))
    rules_hash = hashlib.sha256(io.open(os.path.join(PIPE, "exclusion_rules.json"), "rb").read()).hexdigest()[:16]
    meta, X = load_all(); N = len(meta)
    print("로드 {} ({:.1f}m)".format(fmt(N), (time.time() - t0) / 60), flush=True)
    masks, extra = compute(meta, X, R)
    print("규칙 계산 ({:.1f}m)".format((time.time() - t0) / 60), flush=True)
    order = [r["id"] for r in R["rules"]]
    excl = np.zeros(N, bool)
    for k in order: excl |= masks[k]
    total_share = float(excl.mean())
    rng = np.random.default_rng(SEED)

    prev_path = os.path.join(OUT, "exclusion_dryrun_v1.json"); prev_d1 = None; prev_total = None
    if dry_run and os.path.exists(prev_path):
        pj = json.load(io.open(prev_path, encoding="utf-8")); prev_d1 = pj.get("by_depth1"); prev_total = pj.get("total_share")
    S = {"n_songs": N, "rules_hash": rules_hash, "total_excluded": int(excl.sum()), "total_share": total_share,
         "prev_total_share": prev_total, "by_depth1_prev": prev_d1,
         "stop_threshold": R["stop_if_total_excluded_share"], "stopped": bool(total_share > R["stop_if_total_excluded_share"]),
         "per_rule": {}, "overlap": {}, "extra": {k: v for k, v in extra.items() if not isinstance(v, (np.ndarray, pd.DataFrame, pd.Series, dict))}}
    def samp(mask, n=10):
        idx = np.flatnonzero(mask)
        if not len(idx): return []
        pick = rng.choice(idx, min(n, len(idx)), replace=False)
        return [{"artist": meta["artist_raw"].iat[i][:50], "title": meta["title_raw"].iat[i][:70],
                 "length_s": None if pd.isna(meta["length"].iat[i]) else round(float(meta["length"].iat[i]), 1),
                 "sr": None if pd.isna(meta["sample_rate"].iat[i]) else int(meta["sample_rate"].iat[i]), "codec": meta["codec"].iat[i]} for i in pick]
    for k in order:
        only = masks[k].copy()
        for k2 in order:
            if k2 != k: only &= ~masks[k2]
        S["per_rule"][k] = {"hits": int(masks[k].sum()), "share": float(masks[k].mean()), "unique_hits": int(only.sum()), "sample": samp(masks[k])}
    for a in order:
        for b in order:
            if a < b:
                ov = int((masks[a] & masks[b]).sum())
                if ov: S["overlap"]["{} & {}".format(a, b)] = ov
    # R6 묶음 30개
    mem, rep = extra["R6_mem"], extra["R6_rep"]
    gs = rng.choice(mem["g"].unique(), min(30, mem["g"].nunique()), replace=False)
    S["R6_groups"] = []
    for g_ in gs:
        r_ = int(rep[g_]); ms = mem[mem["g"] == g_]
        S["R6_groups"].append({"rep": {"artist": meta["artist_raw"].iat[r_][:40], "title": meta["title_raw"].iat[r_][:70], "codec": meta["codec"].iat[r_], "nsub": int(meta["n_submissions"].iat[r_])},
                               "members": [{"title": meta["title_raw"].iat[int(i)][:70], "dist": round(float(d), 2), "codec": meta["codec"].iat[int(i)],
                                            "folded": bool(d <= R["rules"][5]["params"]["protect_dist"])} for i, d in zip(ms["i"], ms["dist"])][:10]})
    # depth-1 노드별 제외 비율
    d1 = meta["node_d1"].to_numpy()
    S["by_depth1"] = {n: {"songs": int((d1 == n).sum()), "excluded_share": float(excl[d1 == n].mean())} for n in sorted(set(d1))}
    S["elapsed_min"] = (time.time() - t0) / 60
    tag = "dryrun" if dry_run else "report"
    json.dump(S, io.open(os.path.join(OUT, "exclusion_{}.json".format(tag)), "w", encoding="utf-8"), indent=2, ensure_ascii=False, default=float)
    write_md(S, R, dry_run)
    if dry_run:
        print("dry-run 완료: 총 제외 {} ({:.2%}) {} -> output/exclusion_dryrun.md".format(fmt(S["total_excluded"]), total_share, "**중단(>임계)**" if S["stopped"] else "")); return
    if S["stopped"]:
        sys.exit("총 제외 {:.2%} > 임계 {:.0%} — 적용 중단".format(total_share, R["stop_if_total_excluded_share"]))

    # ---------------- apply ----------------
    reasons = [[k for k in order if masks[k][i]] for i in range(N)]
    cat = meta[["mbid", "canonical", "artist_raw", "title_raw", "length", "sample_rate", "codec", "lossless", "part", "offset", "fingerprint",
                "n_submissions", "leaf_id", "node_d1", "node_d2", "is_bridge", "is_korean"]].copy()
    cat["excluded"] = excl; cat["excluded_reason"] = reasons
    cat["dup_group_id"] = extra["dup_group_id"]; cat["is_representative"] = extra["is_representative"]; cat["flag_low_sr"] = extra["flag_low_sr"]
    for col, arr in extra["flag_cols"].items(): cat[col] = arr
    cat["flag_clipped"] = extra["flag_clipped"]
    cat["rules_hash"] = rules_hash
    cat.to_parquet(os.path.join(WORK, "catalog_v2.parquet"), compression="zstd", index=False)
    # 서빙 번들 v2.1: 좌표·노드 경로에서 excluded 제거 (fit·트리 그대로)
    if os.path.exists(SERV_NEW): shutil.rmtree(SERV_NEW)
    os.makedirs(os.path.join(SERV_NEW, "map_tree"))
    for f in ("model_bundle.npz", "feature_list.json", "fit_manifest.json"): shutil.copy(os.path.join(SERV, f), SERV_NEW)
    for f in ("tree.json", "split_axes.npz", "quality_by_depth.csv"): shutil.copy(os.path.join(SERV, "map_tree", f), os.path.join(SERV_NEW, "map_tree"))
    keep = ~excl
    co = pd.read_parquet(os.path.join(SERV, "coords_v2.parquet")); co[keep].to_parquet(os.path.join(SERV_NEW, "coords_v2.parquet"), compression="zstd", index=False)
    npth = pd.read_parquet(os.path.join(SERV, "map_tree", "node_paths_v2.parquet")); npth["mbid"] = npth["mbid"].astype(str).str.lower()
    npth = npth.set_index("mbid").loc[cat.loc[keep, "mbid"]].reset_index(); npth.to_parquet(os.path.join(SERV_NEW, "map_tree", "node_paths_v2.parquet"), compression="zstd", index=False)
    shutil.copy(os.path.join(ROOT, "serving", "postprocess_rules.json"), SERV_NEW)
    m = json.load(io.open(os.path.join(SERV, "manifest.json"), encoding="utf-8"))
    m.update({"bundle_version": "v2.1-pca16-" + time.strftime("%Y-%m-%d"), "status": "PROMOTED (v2.1 = v2 + 카탈로그 정제, fit·트리 동일)",
              "songs": int(keep.sum()), "songs_before_exclusion": N, "exclusion_rules_hash": rules_hash, "exclusion_rules": "pipeline/exclusion_rules.json",
              "excluded_total": int(excl.sum()), "catalog": "work/catalog_v2.parquet"})
    json.dump(m, io.open(os.path.join(SERV_NEW, "manifest.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    # 최소 재검증: 브릿지 풀 Hit@10 전/후 + 사라진 정답 파트너
    reval = revalidate(meta, X, excl)
    S["revalidation"] = reval
    json.dump(S, io.open(os.path.join(OUT, "exclusion_report.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False, default=float)
    write_md(S, R, False)
    print("apply 완료: catalog_v2 {} 행, 제외 {}, serving/v2.1-pca16 {} 곡 ({:.1f}m)".format(fmt(N), fmt(excl.sum()), fmt(keep.sum()), (time.time() - t0) / 60))


def revalidate(meta, X, excl):
    br = pd.read_parquet(os.path.join(OUT, "bridge_v2.parquet")); br["mbid"] = br["mbid"].astype(str).str.lower()
    lab = pd.read_parquet(os.path.join(OUT, "labels_melon_pairs_v2.parquet")); m2m = br.set_index("melon_id")["mbid"]
    pa = lab["song_a"].map(m2m).to_numpy(); pb = lab["song_b"].map(m2m).to_numpy()
    pos = pd.Series(np.arange(len(meta)), index=meta["mbid"])
    ia = pos.reindex(pa).to_numpy(); ib = pos.reindex(pb).to_numpy(); ok = np.isfinite(ia) & np.isfinite(ib)
    ia = ia[ok].astype(int); ib = ib[ok].astype(int)
    lost = int((excl[ia] | excl[ib]).sum())
    pool = np.flatnonzero(pd.Series(meta["mbid"]).isin(set(br["mbid"])).to_numpy())
    rng = np.random.default_rng(SEED)
    q = rng.choice(np.unique(np.r_[ia, ib]), 2000, replace=False)
    partners = {}
    for a, b in zip(ia, ib): partners.setdefault(a, set()).add(b); partners.setdefault(b, set()).add(a)
    def hit(pool_idx):
        Xp = X[pool_idx]; sq = (Xp ** 2).sum(1); loc = {int(g): k for k, g in enumerate(pool_idx)}; h = []
        for s in range(0, len(q), 500):
            qq = q[s:s + 500]; D = sq[None, :] - 2.0 * (X[qq] @ Xp.T)
            for r_, qi in enumerate(qq):
                if int(qi) in loc: D[r_, loc[int(qi)]] = np.inf
            nn = pool_idx[np.argpartition(D, 10, axis=1)[:, :10]]
            for r_, qi in enumerate(qq):
                P = partners.get(int(qi), set()); h.append(float(any(int(x) in P for x in nn[r_])))
        return float(np.mean(h))
    h0 = hit(pool); h1 = hit(pool[~excl[pool]])
    return {"queries": int(len(q)), "pairs": int(ok.sum()), "pairs_lost_by_exclusion": lost, "pairs_lost_share": lost / max(int(ok.sum()), 1),
            "hit10_before": h0, "hit10_after": h1, "hit10_rel_change": (h1 - h0) / h0 if h0 else None,
            "flag": bool(abs((h1 - h0) / h0) > 0.05 if h0 else False) or bool(lost / max(int(ok.sum()), 1) > 0.05)}


def write_md(S, R, dry_run):
    L = []; w = L.append; N = S["n_songs"]
    w("# {} — 카탈로그 제외 규칙 (rules {})".format("S1 dry-run" if dry_run else "S1 적용 리포트", S["rules_hash"])); w("")
    w("총 제외 **{}** / {} = **{:.2%}** (중단 임계 {:.0%}) {}".format(fmt(S["total_excluded"]), fmt(N), S["total_share"], S["stop_threshold"], "— **중단**" if S["stopped"] else "")); w("")
    w("| 규칙 | 적중 | 비율 | 단독 적중 | 근거 |"); w("|:--|--:|--:|--:|:--|")
    for r in R["rules"]:
        p = S["per_rule"][r["id"]]
        w("| {}{} | {} | {:.3%} | {} | {} |".format(r["id"], "" if r.get("enabled") else " (off)", fmt(p["hits"]), p["share"], fmt(p["unique_hits"]), r["basis"]))
    w(""); w("겹침: " + (", ".join("{} {}".format(k, fmt(v)) for k, v in sorted(S["overlap"].items(), key=lambda kv: -kv[1])[:12]) or "없음")); w("")
    ex = S["extra"]; w("R1 >20min: 예외태그 {} · 미태그 {} (그중 <30min 유지 {}) · R5 멤버 {} / 보호 {} / 접힘 {} (거리 median {}) · R6 묶음 {} / 멤버 {} / 보호 {} / 접힘 {} · R8 분위값 {:.4f}".format(
        fmt(ex.get("R1_long_exempted", 0)), fmt(ex.get("R1_long_untagged", 0)), fmt(ex.get("R1_long_untagged_kept_lt30min", 0)),
        fmt(ex.get("R5_members", 0)), fmt(ex.get("R5_protected", 0)), fmt(ex.get("R5_fold", 0)),
        "{:.2f}".format(ex["R5_member_dist_median"]) if ex.get("R5_member_dist_median") is not None else "-",
        fmt(ex["R6_groups_multi"]), fmt(ex["R6_members"]), fmt(ex["R6_protected"]), fmt(ex["R6_fold"]), ex["R8_loud_q"])); w("")
    if S.get("prev_total_share") is not None:
        w("이전 dry-run 총 제외 {:.2%} -> 이번 {:.2%}".format(S["prev_total_share"], S["total_share"])); w("")
    for r in R["rules"]:
        p = S["per_rule"][r["id"]]
        if not p["sample"]: continue
        w("### {} 표본".format(r["id"])); w(""); w("| 아티스트 | 제목 | 길이 | SR | 코덱 |"); w("|:--|:--|--:|--:|:--|")
        for s in p["sample"]: w("| {} | {} | {} | {} | {} |".format(s["artist"], s["title"], s["length_s"], s["sr"], s["codec"]))
        w("")
    w("### R6 묶음 30개 (대표 / 멤버 / 좌표 거리 — 접힘 여부)"); w("")
    for g in S["R6_groups"]:
        w("- **{} — {}** ({}, 제출본 {})".format(g["rep"]["artist"], g["rep"]["title"], g["rep"]["codec"], g["rep"]["nsub"]))
        for m in g["members"]: w("  - {} — d={} ({}) {}".format(m["title"], m["dist"], m["codec"], "접힘" if m["folded"] else "**보호**"))
    w(""); w("### depth-1 노드별 제외 비율 (이전 dry-run -> 이번)"); w(""); w("| 노드 | 곡 | 이전 | 이번 | 전체 대비 |"); w("|:--|--:|--:|--:|--:|")
    for n, v in S["by_depth1"].items():
        pv = (S.get("by_depth1_prev") or {}).get(n, {}).get("excluded_share")
        w("| {} | {} | {} | {:.2%} | {:.2f}x{} |".format(n, fmt(v["songs"]), "{:.2%}".format(pv) if pv is not None else "-", v["excluded_share"],
                                                  v["excluded_share"] / max(S["total_share"], 1e-9), " !" if v["excluded_share"] > 2 * S["total_share"] else ""))
    if "revalidation" in S:
        v = S["revalidation"]; w(""); w("### 최소 재검증 (브릿지 풀 closed-world)"); w("")
        w("정답쌍 {} 중 제외로 사라진 쌍 **{}** ({:.2%}). Hit@10 {:.4f} → {:.4f} ({}). {}".format(
            fmt(v["pairs"]), fmt(v["pairs_lost_by_exclusion"]), v["pairs_lost_share"], v["hit10_before"], v["hit10_after"],
            "{:+.1%}".format(v["hit10_rel_change"]) if v["hit10_rel_change"] is not None else "—", "**>5% 변화 — 보고**" if v["flag"] else "5% 이내"))
    w(""); w("삭제 없음 · 곡 개별 제외 없음 · fit·트리 재학습 없음 · v1 아카이브 미수정.")
    io.open(os.path.join(OUT, "exclusion_{}.md".format("dryrun" if dry_run else "report")), "w", encoding="utf-8").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main(dry_run="--apply" not in sys.argv)
