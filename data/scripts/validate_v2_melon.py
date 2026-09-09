# -*- coding: utf-8 -*-
"""Phase 2 + 4 — 멜론 정답지로 v2 채점 (게이트 G1~G4, M1 트리거, 한국 곡, v1 공정 비교).

프로토콜은 v1 validate_map_melon.py 와 같고 다음만 다르다 (gates/v2_validation_gate.json):
  - negative 샘플러: 인기도 보정 (곡을 플레이리스트 빈도 cnt 에 비례해 뽑음)
  - 정답지: bridge_v2 곡 집합으로 train.json 에서 재구축 (v1 정의 동일)
  - 층화 추가: 인코딩 조합 (lossless/lossy, v2 매니페스트 대표 제출본 기준)
  - Hit@10 / Recall@K (closed-world), 섞기 검정, depth 1~6 동거율
  - v1·v2 공통 곡 풀에서 두 지도를 같은 쌍으로 채점 (공정 비교)
sklearn/duckdb 없이 numpy 로 구현 (AUC = Mann-Whitney 순위합).

출력: output/validation_v2_melon.json, output/labels_melon_pairs_v2.parquet
"""
import io
import json
import math
import os
import time
from collections import Counter
from itertools import combinations

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "output")
V2 = os.path.join(ROOT, "serving", "v2-pca16-candidate")
V1 = os.path.join(ROOT, "serving", "v1-pca16")
GATE = json.load(io.open(os.path.join(ROOT, "gates", "v2_validation_gate.json"), encoding="utf-8"))
PC = ["pc{}".format(i) for i in range(1, 17)]
SEEDS = [42, 43, 44]
MIN_CO = 2
KS = (10, 50, 100)


def fmt(n):
    return "{:,}".format(int(n))


def auc_np(pos_d, neg_d):
    """Mann-Whitney AUC: P(dist_pos < dist_neg). 작은 거리 = 높은 점수."""
    pos_d = np.asarray(pos_d, float); neg_d = np.asarray(neg_d, float)
    if len(pos_d) == 0 or len(neg_d) == 0:
        return float("nan")
    allv = np.concatenate([pos_d, neg_d])
    order = allv.argsort(kind="mergesort")
    ranks = np.empty(len(allv)); ranks[order] = np.arange(1, len(allv) + 1)
    # 동률 평균 순위
    sv = allv[order]
    i = 0
    while i < len(sv):
        j = i
        while j + 1 < len(sv) and sv[j + 1] == sv[i]:
            j += 1
        if j > i:
            ranks[order[i:j + 1]] = (i + j + 2) / 2.0
        i = j + 1
    r_pos = ranks[:len(pos_d)].sum()
    n1, n0 = len(pos_d), len(neg_d)
    u = r_pos - n1 * (n1 + 1) / 2.0           # U for "pos has larger value"
    return float(1.0 - u / (n1 * n0))          # smaller distance = positive


# self-test (분리 완전 / 무정보)
assert abs(auc_np([1, 2, 3], [4, 5, 6]) - 1.0) < 1e-12
assert abs(auc_np([1, 2, 3], [1, 2, 3]) - 0.5) < 1e-12


def load_map(bundle_dir, coords_name, paths_name, max_depth):
    c = pd.read_parquet(os.path.join(bundle_dir, coords_name), columns=["mbid"] + PC)
    c["mbid"] = c["mbid"].astype(str).str.lower()
    c = c.set_index("mbid")
    a = pd.read_parquet(os.path.join(bundle_dir, "map_tree", paths_name))
    a["mbid"] = a["mbid"].astype(str).str.lower()
    parts = a["leaf_id"].str.split(".")
    for d in range(1, max_depth + 1):
        a["node_d{}".format(d)] = parts.str[:d + 1].str.join(".")
    return c, a.set_index("mbid")


def build_labels(bridge_ids, artist_ids):
    pls = json.load(io.open(os.path.join(ROOT, "data", "melon", "train.json"), encoding="utf-8"))
    N = len(pls)
    cnt = Counter(); co = Counter()
    for p in pls:
        hits = sorted(set(s for s in (p.get("songs") or []) if s in bridge_ids))
        cnt.update(hits)
        for a, b in combinations(hits, 2):
            co[(a, b)] += 1
    rows = []
    for (a, b), c in co.items():
        if c < MIN_CO:
            continue
        ca, cb = cnt[a], cnt[b]
        rows.append((a, b, c, ca, cb, math.log(c * N / (ca * cb)),
                     bool(artist_ids.get(a, set()) & artist_ids.get(b, set()))))
    df = pd.DataFrame(rows, columns=["song_a", "song_b", "co_count", "cnt_a", "cnt_b",
                                     "pmi", "same_artist"])
    return df, cnt, N, len(co)


class Scorer:
    """한 지도(coords, nodes) 위에서 쌍 집합을 채점."""

    def __init__(self, X, nodes, max_depth, pool_mbids, pool_weight, pos_keys):
        self.X = X                      # DataFrame index=mbid
        self.nodes = nodes
        self.max_depth = max_depth
        self.pool = np.asarray(pool_mbids)
        w = np.asarray(pool_weight, float)
        self.p = w / w.sum()
        self.pos_keys = pos_keys        # set of frozenset
        self.Xp = X.loc[self.pool, PC].to_numpy(np.float32)
        self.sq = (self.Xp ** 2).sum(1)
        self.pidx = {m: i for i, m in enumerate(self.pool)}
        # positive 쌍을 정수 키로 (negative 제외용, 벡터화)
        pk = [(self.pidx[x], self.pidx[y]) for x, y in (tuple(fs) for fs in pos_keys if len(fs) == 2)
              if x in self.pidx and y in self.pidx]
        a = np.array([min(u, v) for u, v in pk], np.int64); b = np.array([max(u, v) for u, v in pk], np.int64)
        self.pos_int = np.unique(a * len(self.pool) + b) if len(pk) else np.array([], np.int64)

    def dist(self, a, b):
        return np.linalg.norm(self.X.loc[a, PC].to_numpy() - self.X.loc[b, PC].to_numpy(), axis=1)

    def negatives(self, n, seed, corrected=True):
        rng = np.random.default_rng(seed)
        out_a, out_b = [], []
        need = n
        while need > 0:
            m = int(need * 1.2) + 32
            if corrected:
                a = rng.choice(len(self.pool), size=m, p=self.p)
                b = rng.choice(len(self.pool), size=m, p=self.p)
            else:
                a = rng.integers(0, len(self.pool), size=m)
                b = rng.integers(0, len(self.pool), size=m)
            ok = a != b
            a, b = a[ok], b[ok]
            kk = np.minimum(a, b).astype(np.int64) * len(self.pool) + np.maximum(a, b)
            keep = ~np.isin(kk, self.pos_int, assume_unique=False)
            a, b = a[keep][:need], b[keep][:need]
            out_a.append(a); out_b.append(b)
            need = n - sum(len(x) for x in out_a)
        a = np.concatenate(out_a); b = np.concatenate(out_b)
        return self.pool[a], self.pool[b]

    def co_rate(self, a, b, depth):
        col = "node_d{}".format(depth)
        return float((self.nodes.loc[a, col].to_numpy() == self.nodes.loc[b, col].to_numpy()).mean())

    def knn_hits(self, a, b, ks=KS):
        """closed-world: b 가 a 의 K-최근접(풀 내) 안에 드는가. 양방향 평균."""
        ia = np.array([self.pidx[x] for x in a]); ib = np.array([self.pidx[x] for x in b])
        kmax = max(ks)
        res = {k: [] for k in ks}
        for q, tgt in ((ia, ib), (ib, ia)):
            for s in range(0, len(q), 2000):
                Q = self.Xp[q[s:s + 2000]]
                D = self.sq[None, :] - 2.0 * (Q @ self.Xp.T)              # ||x||^2 - 2 q.x (||q||^2 는 순위 무관)
                D[np.arange(len(Q)), q[s:s + 2000]] = np.inf          # 자기 자신 제외
                part = np.argpartition(D, kmax, axis=1)[:, :kmax]
                dpart = np.take_along_axis(D, part, axis=1)
                order = np.argsort(dpart, axis=1)
                nn = np.take_along_axis(part, order, axis=1)
                t = tgt[s:s + 2000][:, None]
                for k in ks:
                    res[k].append((nn[:, :k] == t).any(axis=1))
        return {k: float(np.concatenate(v).mean()) for k, v in res.items()}


def score(label, sc, pos, seeds, do_knn=True, do_shuffle=True, strata_extra=None):
    """pos: DataFrame with mbid_a, mbid_b, pmi, same_artist(+enc)."""
    R = {"n_pos": int(len(pos))}
    d_pos = sc.dist(pos["mbid_a"].to_numpy(), pos["mbid_b"].to_numpy())
    pos = pos.assign(dist=d_pos)
    negs = {}
    for s in seeds:
        na, nb = sc.negatives(len(pos), s, corrected=True)
        negs[s] = (na, nb, sc.dist(na, nb))
    # AUC 전체 / 층화 (seed 평균)
    def auc_over_seeds(mask):
        return float(np.mean([auc_np(d_pos[mask], negs[s][2]) for s in seeds]))
    allm = np.ones(len(pos), bool)
    R["auc_all"] = auc_over_seeds(allm)
    R["auc_by_seed"] = {str(s): auc_np(d_pos, negs[s][2]) for s in seeds}
    R["auc_same_artist_false"] = auc_over_seeds(~pos["same_artist"].to_numpy())
    R["auc_same_artist_true"] = auc_over_seeds(pos["same_artist"].to_numpy())
    R["n_same_artist_false"] = int((~pos["same_artist"]).sum())
    tier = pd.qcut(pos["pmi"], 3, labels=["low", "mid", "high"]) if len(pos) >= 30 else None
    if tier is not None:
        R["auc_pmi"] = {t: auc_over_seeds((tier == t).to_numpy()) for t in ["low", "mid", "high"]}
    if strata_extra is not None:
        R["auc_encoding"] = {}
        for name, mask in strata_extra.items():
            R["auc_encoding"][name] = {"n": int(mask.sum()),
                                       "auc": auc_over_seeds(mask) if mask.sum() >= 30 else None}
    # 비보정 참고
    ua, ub = sc.negatives(len(pos), seeds[0], corrected=False)
    R["auc_uncorrected_seed{}".format(seeds[0])] = auc_np(d_pos, sc.dist(ua, ub))
    R["dist"] = {"pos_median": float(np.median(d_pos)),
                 "neg_median": float(np.median(negs[seeds[0]][2]))}
    # 노드 동거율 depth 1..max
    na, nb, _ = negs[seeds[0]]
    R["node"] = []
    for d in range(1, sc.max_depth + 1):
        pr = sc.co_rate(pos["mbid_a"].to_numpy(), pos["mbid_b"].to_numpy(), d)
        nr = sc.co_rate(na, nb, d)
        row = {"depth": d, "positive": pr, "negative": nr,
               "lift": pr / nr if nr > 0 else float("nan")}
        if tier is not None and nr > 0:
            row["pmi_lift"] = {t: sc.co_rate(pos.loc[(tier == t).to_numpy(), "mbid_a"].to_numpy(),
                                             pos.loc[(tier == t).to_numpy(), "mbid_b"].to_numpy(), d) / nr
                               for t in ["low", "mid", "high"]}
        R["node"].append(row)
    # Hit@K / Recall@K
    if do_knn:
        hits = sc.knn_hits(pos["mbid_a"].to_numpy(), pos["mbid_b"].to_numpy())
        npool = len(sc.pool)
        R["hit"] = {str(k): {"rate": hits[k], "random": k / (npool - 1),
                             "lift": hits[k] / (k / (npool - 1))} for k in KS}
    # 섞기 검정: 곡<->좌표 순열
    if do_shuffle:
        rng = np.random.default_rng(seeds[0])
        perm = sc.X.copy()
        perm.loc[:, PC] = sc.X[PC].to_numpy()[rng.permutation(len(sc.X))]
        def pd_(a, b):
            return np.linalg.norm(perm.loc[a, PC].to_numpy() - perm.loc[b, PC].to_numpy(), axis=1)
        R["shuffle_auc"] = auc_np(pd_(pos["mbid_a"].to_numpy(), pos["mbid_b"].to_numpy()),
                                  pd_(na, nb))
    print("  [{}] n={} AUC {:.4f} (sa=false {:.4f}) | shuffle {} | hit@10 lift {}".format(
        label, fmt(len(pos)), R["auc_all"], R["auc_same_artist_false"],
        "{:.4f}".format(R["shuffle_auc"]) if do_shuffle else "-",
        "{:.2f}".format(R["hit"]["10"]["lift"]) if do_knn else "-"), flush=True)
    return R


def main():
    t0 = time.time()
    bridge = pd.read_parquet(os.path.join(OUT, "bridge_v2.parquet"))
    bridge["mbid"] = bridge["mbid"].astype(str).str.lower()
    m2m = bridge.set_index("melon_id")["mbid"]
    is_kor = bridge.set_index("melon_id")["is_korean"]

    # ---- 정답지 재구축 (v2 브릿지 곡) ----
    meta = json.load(io.open(os.path.join(ROOT, "data", "melon", "song_meta.json"), encoding="utf-8"))
    bset = set(bridge["melon_id"])
    artist_ids = {s["id"]: set(s.get("artist_id_basket") or []) for s in meta if s["id"] in bset}
    del meta
    lab, cnt, N, n_co_raw = build_labels(bset, artist_ids)
    lab.to_parquet(os.path.join(OUT, "labels_melon_pairs_v2.parquet"), index=False)
    print("정답지 v2: 플레이리스트 {} / 원 동시수록 쌍 {} / co>=2 쌍 {} ({:.1f}m)".format(
        fmt(N), fmt(n_co_raw), fmt(len(lab)), (time.time() - t0) / 60), flush=True)

    lab["mbid_a"] = lab["song_a"].map(m2m); lab["mbid_b"] = lab["song_b"].map(m2m)
    lab["kor_a"] = lab["song_a"].map(is_kor); lab["kor_b"] = lab["song_b"].map(is_kor)
    lab = lab[lab["mbid_a"] != lab["mbid_b"]].copy()      # 다른 멜론 id, 같은 mbid 방지

    # ---- v2 지도 ----
    X2, N2 = load_map(V2, "coords_v2.parquet", "node_paths_v2.parquet", 6)
    man = pd.read_parquet(os.path.join(ROOT, "work", "v2_manifest.parquet"), columns=["mbid", "lossless"])
    man["mbid"] = man["mbid"].astype(str).str.lower()
    ll = man.set_index("mbid")["lossless"]
    pool2 = sorted(set(bridge["mbid"]) & set(X2.index) & set(N2.index))
    w2 = np.array([cnt.get(mid, 0) for mid in bridge.set_index("mbid").loc[pool2].index], float)
    # 곡 가중치 = 그 mbid 에 대응하는 멜론 곡의 cnt (mbid 당 멜론 곡 1개)
    mb2melon = bridge.drop_duplicates("mbid").set_index("mbid")["melon_id"]
    w2 = np.array([cnt.get(mb2melon[m], 0) for m in pool2], float) + 1.0
    pos2 = lab[lab["mbid_a"].isin(pool2) & lab["mbid_b"].isin(pool2)].copy()
    keys2 = set(map(frozenset, zip(pos2["mbid_a"], pos2["mbid_b"])))
    sc2 = Scorer(X2, N2, 6, pool2, w2, keys2)
    enc_a = pos2["mbid_a"].map(ll).to_numpy(bool); enc_b = pos2["mbid_b"].map(ll).to_numpy(bool)
    strata = {"lossless_lossless": enc_a & enc_b,
              "lossless_lossy": enc_a ^ enc_b,
              "lossy_lossy": ~enc_a & ~enc_b}
    print("v2 풀 {} 곡 / positive {} 쌍".format(fmt(len(pool2)), fmt(len(pos2))), flush=True)
    R = {"funnel": {"bridge_songs": int(len(bridge)), "pool_in_map": len(pool2),
                    "pairs_co2": int(len(lab)), "pairs_in_map": int(len(pos2)),
                    "playlists": N},
         "v1_reference_funnel": {"pairs_in_map": 10024, "pool_in_map": 15387}}
    R["v2_full"] = score("v2 전체 풀", sc2, pos2, SEEDS, strata_extra=strata)

    # ---- 한국 곡 (Phase 4) ----
    kor_pool = sorted(set(bridge.loc[bridge["is_korean"], "mbid"]) & set(pool2))
    pos_k = pos2[pos2["kor_a"].fillna(False).astype(bool) & pos2["kor_b"].fillna(False).astype(bool)]
    R["korean"] = {"in_map_songs": len(kor_pool), "pairs": int(len(pos_k)),
                   "precondition": bool(len(kor_pool) >= 1000 and len(pos_k) >= 1000)}
    if R["korean"]["precondition"]:
        wk = np.array([cnt.get(mb2melon[m], 0) for m in kor_pool], float) + 1.0
        sck = Scorer(X2, N2, 6, kor_pool, wk, set(map(frozenset, zip(pos_k["mbid_a"], pos_k["mbid_b"]))))
        R["korean"]["score"] = score("한국 곡", sck, pos_k, SEEDS)
    else:
        R["korean"]["note"] = "표본 부족으로 채점 불가"
    # 한국 곡 분포 (depth-2), 해외 곡과 혼재 정도
    d2_k = N2.loc[kor_pool, "node_d2"].value_counts() if kor_pool else pd.Series(dtype=int)
    for_pool = sorted(set(bridge.loc[~bridge["is_korean"], "mbid"]) & set(pool2))
    d2_f = N2.loc[for_pool, "node_d2"].value_counts()
    all_d2 = N2["node_d2"].value_counts()
    R["korean"]["depth2_distribution"] = {
        "korean_nodes_occupied": int((d2_k > 0).sum()), "total_depth2_nodes": int(len(all_d2)),
        "korean_top5": {k: int(v) for k, v in d2_k.head(5).items()},
        "korean_share_in_top_node": float(d2_k.iloc[0] / max(len(kor_pool), 1)) if len(d2_k) else None,
        "overlap_with_foreign_nodes": int(len(set(d2_k.index) & set(d2_f.index))),
        "entropy_korean": float(-(d2_k / d2_k.sum() * np.log(d2_k / d2_k.sum())).sum()) if len(d2_k) else None,
        "entropy_foreign": float(-(d2_f / d2_f.sum() * np.log(d2_f / d2_f.sum())).sum()),
        "entropy_max": float(np.log(len(all_d2))),
    }

    # ---- v1 공정 비교: 공통 곡 풀 ----
    X1, N1 = load_map(V1, "coords_pca16.parquet", "assignments.parquet", 4)
    common = sorted(set(pool2) & set(X1.index) & set(N1.index))
    pos_c = pos2[pos2["mbid_a"].isin(common) & pos2["mbid_b"].isin(common)].copy()
    wc = np.array([cnt.get(mb2melon[m], 0) for m in common], float) + 1.0
    kc = set(map(frozenset, zip(pos_c["mbid_a"], pos_c["mbid_b"])))
    R["common"] = {"pool": len(common), "pairs": int(len(pos_c))}
    if len(pos_c) >= 100:
        R["common"]["v2"] = score("공통 풀 v2", Scorer(X2, N2, 6, common, wc, kc), pos_c, SEEDS)
        R["common"]["v1"] = score("공통 풀 v1", Scorer(X1, N1, 4, common, wc, kc), pos_c, SEEDS)

    # ---- 게이트 판정 ----
    g = GATE["gates"]; v = R["v2_full"]
    g1 = v["auc_same_artist_false"]
    node5 = next(r for r in v["node"] if r["depth"] == 5)
    pl = node5.get("pmi_lift", {})
    mono = bool(pl and pl["low"] < pl["mid"] < pl["high"])
    R["gates"] = {
        "G1": {"value": g1, "pass": bool(g1 >= 0.65 and g1 >= 0.674 - 0.02)},
        "G2": {"value": v["hit"]["10"]["lift"], "pass": bool(v["hit"]["10"]["lift"] >= 3)},
        "G3": {"value": v["shuffle_auc"], "pass": bool(0.48 <= v["shuffle_auc"] <= 0.52)},
        "G4": {"lift_d5": node5["lift"], "pmi_lift_d5": pl, "monotone": mono,
               "pass": bool(node5["lift"] > 1 and mono)},
    }
    R["gates"]["all_pass"] = all(R["gates"][k]["pass"] for k in ("G1", "G2", "G3", "G4"))
    e = v.get("auc_encoding", {})
    if e.get("lossless_lossless", {}).get("auc") and e.get("lossless_lossy", {}).get("auc"):
        diff = e["lossless_lossless"]["auc"] - e["lossless_lossy"]["auc"]
        R["m1_trigger"] = {"auc_ll": e["lossless_lossless"]["auc"], "auc_lx": e["lossless_lossy"]["auc"],
                           "diff": diff, "triggered": bool(diff >= 0.02)}
    R["elapsed_min"] = (time.time() - t0) / 60
    json.dump(R, io.open(os.path.join(OUT, "validation_v2_melon.json"), "w", encoding="utf-8"),
              indent=2, ensure_ascii=False, default=float)
    print("\n게이트:", {k: R["gates"][k]["pass"] for k in ("G1", "G2", "G3", "G4")},
          "| all_pass =", R["gates"]["all_pass"], "| {:.1f}m".format(R["elapsed_min"]))


if __name__ == "__main__":
    main()
