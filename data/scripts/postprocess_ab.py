# -*- coding: utf-8 -*-
"""Part C — 후처리 규칙 적용 전/후 비교 (브릿지 쿼리 1,000곡, seed 42).

이웃: work/diag_neighbors.parquet 의 top-50 (전 지도). 규칙: serving/postprocess_rules.json.
지표: Hit@10 (브릿지 풀 정답쌍 기준 — 쿼리의 정답 상대가 top-10 에 있는가), top-10 중복률(같은 canonical/키),
      아티스트 도배율(최다 아티스트 ≥ cap+1 비율), '유사도 낮음' 표시 비율.
출력: output/postprocess_ab.json
"""
import io, json, os
import numpy as np, pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "work"); OUT = os.path.join(ROOT, "output")
NQ = 1000; SEED = 42


def apply_rules(nbr, dist, q, meta_arrays, rules):
    """한 쿼리의 top-50 → 규칙 적용 후 top-10 (인덱스 리스트)."""
    canon, art, tit, length, cnt_hub = meta_arrays
    tau = rules["tau_dup"]["value"]; cap = rules["artist_cap"]["value"]
    lo, hi = rules["length_range_s"]["min"], rules["length_range_s"]["max"]
    order = np.arange(len(nbr))
    if rules["hub_penalty"]["enabled"]:
        # 역빈도 페널티: dist * (1 + log1p(count/expected)) 로 재정렬
        pen = dist * (1.0 + np.log1p(cnt_hub[nbr] / rules["hub_penalty"]["expected"]))
        order = np.argsort(pen, kind="stable")
    kept, kept_canon, kept_key, art_count = [], set(), set(), {}
    for j in order:
        i = nbr[j]
        if not (lo <= length[i] <= hi) and np.isfinite(length[i]):
            continue
        if dist[j] < tau:                                    # 쿼리와 같은 녹음
            continue
        if canon[i] in kept_canon or (tit[i] and (art[i], tit[i]) in kept_key):
            continue                                         # 앞선 이웃과 같은 녹음/키
        if canon[i] == canon[q] or (tit[i] and tit[i] == tit[q] and art[i] == art[q]):
            continue
        if art[i] and art_count.get(art[i], 0) >= cap:
            continue
        kept.append(i); kept_canon.add(canon[i])
        if tit[i]: kept_key.add((art[i], tit[i]))
        if art[i]: art_count[art[i]] = art_count.get(art[i], 0) + 1
        if len(kept) == 10:
            break
    return kept


def main():
    rules = json.load(io.open(os.path.join(ROOT, "serving", "postprocess_rules.json"), encoding="utf-8"))
    diag = json.load(io.open(os.path.join(OUT, "serving_diagnostics.json"), encoding="utf-8"))
    rules["hub_penalty"]["expected"] = diag["D4"]["expected_if_uniform"]
    meta = pd.read_parquet(os.path.join(WORK, "v2_song_meta.parquet"))
    coords_order = pd.read_parquet(os.path.join(ROOT, "serving", "v2-pca16-candidate", "coords_v2.parquet"), columns=["mbid"])
    coords_order["mbid"] = coords_order["mbid"].astype(str).str.lower()
    meta = meta.set_index("mbid").loc[coords_order["mbid"]].reset_index()
    canon = meta["canonical"].to_numpy(); art = meta["artist_norm"].fillna("").to_numpy()
    tit = meta["title_norm"].fillna("").to_numpy(); length = meta["length"].to_numpy(float)
    mb = meta["mbid"].to_numpy()
    nb = pd.read_parquet(os.path.join(WORK, "diag_neighbors.parquet"))
    nb = nb[nb["qtype"] == 0]
    qs = nb["q"].unique()
    rng = np.random.default_rng(SEED); qs = rng.choice(qs, min(NQ, len(qs)), replace=False)
    nb = nb[nb["q"].isin(qs)].sort_values(["q", "rank"])
    cnt_hub = np.bincount(pd.read_parquet(os.path.join(WORK, "diag_neighbors.parquet"), columns=["nbr"])["nbr"].to_numpy(),
                          minlength=len(meta))

    # 정답 상대 (브릿지 정답쌍 v2)
    lab = pd.read_parquet(os.path.join(OUT, "labels_melon_pairs_v2.parquet"))
    br = pd.read_parquet(os.path.join(OUT, "bridge_v2.parquet")); br["mbid"] = br["mbid"].astype(str).str.lower()
    m2m = br.set_index("melon_id")["mbid"]
    pa = lab["song_a"].map(m2m).to_numpy(); pb = lab["song_b"].map(m2m).to_numpy()
    partners = {}
    for x, y in zip(pa, pb):
        partners.setdefault(x, set()).add(y); partners.setdefault(y, set()).add(x)
    pool_set = set(br["mbid"])

    # ---- Hit@10 은 브릿지 풀 closed-world 로 (전 지도 top-10 에 특정 정답 상대가 들 확률은 ~0 이라 지표 불성립) ----
    PC = ["pc{}".format(i) for i in range(1, 17)]
    XY = pd.read_parquet(os.path.join(ROOT, "serving", "v2-pca16-candidate", "coords_v2.parquet"))
    XY["mbid"] = XY["mbid"].astype(str).str.lower()
    pool_idx = np.flatnonzero(pd.Series(mb).isin(pool_set).to_numpy())
    Xp = XY[PC].to_numpy(np.float32)[pool_idx]; sqp = (Xp ** 2).sum(1)
    pos_in_pool = {int(g): k for k, g in enumerate(pool_idx)}
    cw = {}
    for s0 in range(0, len(qs), 500):
        qq = qs[s0:s0 + 500]
        Q = XY[PC].to_numpy(np.float32)[qq]
        Dm = sqp[None, :] - 2.0 * (Q @ Xp.T)
        for r, q in enumerate(qq):
            if q in pos_in_pool: Dm[r, pos_in_pool[q]] = np.inf
        part = np.argpartition(Dm, 50, axis=1)[:, :50]
        dpart = np.take_along_axis(Dm, part, axis=1); o = np.argsort(dpart, axis=1)
        nn = np.take_along_axis(part, o, axis=1); dd = np.take_along_axis(dpart, o, axis=1)
        qsq = (Q ** 2).sum(1)[:, None]
        for r, q in enumerate(qq):
            cw[int(q)] = (pool_idx[nn[r]], np.sqrt(np.maximum(dd[r] + qsq[r], 0)))
    del XY
    res = {"before": {"hit10": [], "dup": [], "dom": [], "far": []}, "after": {"hit10": [], "dup": [], "dom": [], "far": [], "n_kept": []}}
    tau_far = rules["tau_far"]["value"]; cap = rules["artist_cap"]["value"]
    n_with_partner = 0
    for q, g in nb.groupby("q", sort=False):
        nbr = g["nbr"].to_numpy(); dist = g["dist"].to_numpy()
        P = partners.get(mb[q], set())
        before = nbr[:10]
        after = np.array(apply_rules(nbr, dist, q, (canon, art, tit, length, cnt_hub), rules), dtype=np.int64)
        if P and q in cw:                                   # Hit@10: 브릿지 풀 closed-world 전/후
            cn, cd = cw[q]
            res["before"]["hit10"].append(float(any(mb[i] in P for i in cn[:10])))
            ca = apply_rules(cn, cd, q, (canon, art, tit, length, cnt_hub), rules)
            res["after"]["hit10"].append(float(any(mb[i] in P for i in ca)))
        for key, top in (("before", before), ("after", after)):
            ids = mb[top]
            dup = ((canon[top] == canon[q]) | ((tit[top] == tit[q]) & (art[top] == art[q]) & (tit[q] != ""))).mean() if len(top) else 0.0
            # 이웃 간 중복도 포함
            if len(top) > 1:
                dup = max(dup, 1 - len(set(canon[top])) / len(top))
            res[key]["dup"].append(float(dup))
            a = art[top]; a = a[a != ""]
            mc = np.max(np.unique(a, return_counts=True)[1]) if len(a) else 0
            res[key]["dom"].append(float(mc > cap))
            d10 = dist[9] if key == "before" else (dist[np.isin(nbr, top)].max() if len(top) else np.inf)
            res[key]["far"].append(float(d10 > tau_far))
        res["after"]["n_kept"].append(len(after))
        if P: n_with_partner += 1

    S = {"n_queries": int(len(qs)), "n_queries_with_partner": n_with_partner, "rules": {k: v for k, v in rules.items() if k != "version"}}
    for key in ("before", "after"):
        S[key] = {"hit10": float(np.mean(res[key]["hit10"])) if res[key]["hit10"] else None,
                  "dup_rate": float(np.mean(res[key]["dup"])), "artist_dominance_rate": float(np.mean(res[key]["dom"])),
                  "far_flag_rate": float(np.mean(res[key]["far"]))}
    S["after"]["mean_kept"] = float(np.mean(res["after"]["n_kept"])); S["after"]["share_lt10"] = float(np.mean(np.array(res["after"]["n_kept"]) < 10))
    h0, h1 = S["before"]["hit10"], S["after"]["hit10"]
    S["hit10_rel_change"] = (h1 - h0) / h0 if h0 else None
    S["hit10_note"] = "Hit@10 은 브릿지 풀(67,536곡) closed-world 이웃 기준; 중복률·도배율·far 는 전 지도 top-10(서빙 조건) 기준"
    if S["hit10_rel_change"] is None:
        S["verdict"] = "Hit@10 측정 불가 (정답 상대 있는 쿼리 부족)"
    elif S["hit10_rel_change"] >= -0.10:
        S["verdict"] = "OK — 후처리가 Hit@10 을 해치지 않음 (하락 ≤10%)"
    else:
        S["verdict"] = "규칙 완화 보고 — Hit@10 하락 >10%"
    json.dump(S, io.open(os.path.join(OUT, "postprocess_ab.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False, default=float)
    print("전/후: Hit@10 {:.4f} → {:.4f} ({:+.1%}) | 중복률 {:.3f} → {:.3f} | 도배율 {:.3f} → {:.3f} | far 표시 {:.3f} → {:.3f} | {}".format(
        h0 or 0, h1 or 0, S["hit10_rel_change"] or 0, S["before"]["dup_rate"], S["after"]["dup_rate"],
        S["before"]["artist_dominance_rate"], S["after"]["artist_dominance_rate"], S["before"]["far_flag_rate"], S["after"]["far_flag_rate"], S["verdict"]))


if __name__ == "__main__":
    main()
