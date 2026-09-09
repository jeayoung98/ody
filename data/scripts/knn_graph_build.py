# -*- coding: utf-8 -*-
"""v2.1 kNN 그래프 (k=30) 구축 — 리프 다중 탐침(multi-probe) 근사.

방법: k-means 4,096 셀(1M 표본 fit, 전곡 배정)을 코어스 양자화기로 쓴다. 셀 L 의 곡들은 L 중심에 가장 가까운 P 개 셀(자기 포함)의
곡들만 후보로 두고 정확 거리로 top-k 를 뽑는다. P 는 표본 300곡의 정확 kNN 대비 recall@30 ≥ 0.95 가 되는 최소값으로 고른다.
(첫 시도: 트리 리프 중심 탐침 — P=48 에서 recall@30 0.80 → 기각. 리프는 길게 늘어진 영역이라 중심 거리로 탐침이 안 된다.)
좌표·트리·규칙 변경 없음. 산출: work/knn_graph/{indices.npy(int32 N×k), dists.npy(float32 N×k), meta.json}
"""
import io, json, os, sys, time
import numpy as np, pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "work"); SERV = os.path.join(ROOT, "serving", "v2.1-pca16"); G = os.path.join(WORK, "knn_graph")
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from qual_prepare import topk_full, PC   # noqa: E402
K = 30; SEED = 42; N_CHECK = 300; P_CANDIDATES = [8, 16, 24, 32, 48, 64]; RECALL_TARGET = 0.95; N_CELLS = 4096


def approx_knn_for_queries(qidx, X, sq, leaf_code, members, cent_order, P, k=K):
    """qidx (쿼리 인덱스) 각각에 대해, 쿼리 리프의 P 탐침 리프 후보만으로 top-k."""
    best_d = np.zeros((len(qidx), k), np.float32); best_i = np.zeros((len(qidx), k), np.int64)
    for j, q in enumerate(qidx):
        cand = np.concatenate([members[l] for l in cent_order[leaf_code[q], :P]])
        d = sq[cand] + sq[q] - 2.0 * (X[cand] @ X[q]); d[cand == q] = np.inf
        part = np.argpartition(d, k - 1)[:k]; o = np.argsort(d[part])
        best_d[j] = np.sqrt(np.maximum(d[part][o], 0)); best_i[j] = cand[part][o]
    return best_d, best_i


def main():
    t0 = time.time(); os.makedirs(G, exist_ok=True)
    co = pd.read_parquet(os.path.join(SERV, "coords_v2.parquet")); co["mbid"] = co["mbid"].astype(str).str.lower()
    X = np.ascontiguousarray(co[PC].to_numpy(np.float32)); mb = co["mbid"].to_numpy(); del co
    N = len(mb); sq = (X ** 2).sum(1)
    # 코어스 양자화기: k-means 셀 (트리 리프는 길게 늘어진 영역이라 중심 탐침 recall 이 낮았다 — P=48 에서 0.80)
    from sklearn.cluster import MiniBatchKMeans
    rng0 = np.random.default_rng(SEED); fit_idx = rng0.choice(N, 1_000_000, replace=False)
    km = MiniBatchKMeans(n_clusters=N_CELLS, batch_size=200_000, n_init=1, max_iter=50, random_state=SEED).fit(X[fit_idx])
    C = km.cluster_centers_.astype(np.float32); nL = len(C); csq = (C ** 2).sum(1)
    leaf_code = np.empty(N, np.int32)
    for s in range(0, N, 500_000):
        Xb = X[s:s + 500_000]; leaf_code[s:s + 500_000] = np.argmin(csq[None, :] - 2.0 * (Xb @ C.T), axis=1)
    order = np.argsort(leaf_code, kind="stable"); bounds = np.searchsorted(leaf_code[order], np.arange(nL + 1))
    members = [order[bounds[l]:bounds[l + 1]] for l in range(nL)]
    DC = csq[:, None] + csq[None, :] - 2.0 * (C @ C.T); cent_order = np.argsort(DC, axis=1)
    sizes = np.array([len(m) for m in members])
    print("로드 {:,} 곡 / k-means 셀 {} (크기 median {:,} · 최대 {:,} · 빈 셀 {}) ({:.1f}m)".format(N, nL, int(np.median(sizes)), int(sizes.max()), int((sizes == 0).sum()), (time.time() - t0) / 60), flush=True)

    # ---- P 선택: 표본 정확 kNN 대비 recall (샤드 0 만 측정·기록; P 는 env P_FIXED 로 전 샤드 공통) ----
    shard, nshard = int(os.environ.get("SHARD", 0)), int(os.environ.get("NSHARD", 1))
    chosen_P = int(os.environ.get("P_FIXED", 0)) or None
    if shard == 0:
        rng = np.random.default_rng(SEED); qs = rng.choice(N, N_CHECK, replace=False)
        Dt, It = topk_full(X[qs], X, sq, qs, k=K)
        print("정확 kNN 표본 {} 완료 ({:.1f}m)".format(N_CHECK, (time.time() - t0) / 60), flush=True)
        recall = {}; pick = P_CANDIDATES[-1]
        for P in P_CANDIDATES:
            Da, Ia = approx_knn_for_queries(qs, X, sq, leaf_code, members, cent_order, P)
            r30 = np.mean([len(set(Ia[j]) & set(It[j])) / K for j in range(N_CHECK)])
            r10 = np.mean([len(set(Ia[j][:10]) & set(It[j][:10])) / 10 for j in range(N_CHECK)])
            recall[P] = {"recall@30": float(r30), "recall@10": float(r10), "d30_ratio_median": float(np.median(Da[:, -1] / np.maximum(Dt[:, -1], 1e-6)))}
            print("P={:>2}: recall@30 {:.3f} recall@10 {:.3f} d30 비율 {:.3f}".format(P, r30, r10, recall[P]["d30_ratio_median"]), flush=True)
            if r30 >= RECALL_TARGET: pick = P; break
        json.dump({"recall_check": recall, "target": RECALL_TARGET, "target_met": max(v["recall@30"] for v in recall.values()) >= RECALL_TARGET, "auto_pick": pick},
                  io.open(os.path.join(G, "recall_check.json"), "w", encoding="utf-8"), indent=1)
        if chosen_P is None: chosen_P = pick
    if chosen_P is None: raise SystemExit("샤드 실행에는 P_FIXED 가 필요하다")
    print("P = {} (샤드 {}/{})".format(chosen_P, shard, nshard), flush=True)

    # ---- 전곡 구축 (셀 단위 일괄, 샤드 = 셀 번호 mod NSHARD) ----
    rows_out, I_out, D_out = [], [], []
    my_cells = [l for l in range(nL) if l % nshard == shard]
    for n_done, l in enumerate(my_cells):
        q = members[l]
        if len(q) == 0: continue
        cand = np.concatenate([members[p] for p in cent_order[l, :chosen_P]])
        Dm = sq[q][:, None] + sq[cand][None, :] - 2.0 * (X[q] @ X[cand].T)
        # 자기 자신 제외: cent_order[l,0]==l 이므로 q 는 cand 의 첫 블록 → 위치 = arange
        assert cent_order[l, 0] == l
        Dm[np.arange(len(q)), np.arange(len(q))] = np.inf
        part = np.argpartition(Dm, K - 1, axis=1)[:, :K]; pd_ = np.take_along_axis(Dm, part, axis=1); o = np.argsort(pd_, axis=1)
        rows_out.append(q.astype(np.int64)); I_out.append(cand[np.take_along_axis(part, o, axis=1)].astype(np.int32))
        D_out.append(np.sqrt(np.maximum(np.take_along_axis(pd_, o, axis=1), 0)).astype(np.float32))
        if n_done % 128 == 0: print("  셀 {}/{} ({:.1f}m)".format(n_done, len(my_cells), (time.time() - t0) / 60), flush=True)
    np.save(os.path.join(G, "part{}_rows.npy".format(shard)), np.concatenate(rows_out))
    np.save(os.path.join(G, "part{}_I.npy".format(shard)), np.concatenate(I_out)); np.save(os.path.join(G, "part{}_D.npy".format(shard)), np.concatenate(D_out))
    print("샤드 완료 {}/{} — {:,} 행 ({:.1f}m)".format(shard, nshard, sum(len(r) for r in rows_out), (time.time() - t0) / 60), flush=True)


def merge():
    """샤드 결과 합치기 → indices.npy / dists.npy / meta.json"""
    import glob
    parts = sorted(glob.glob(os.path.join(G, "part*_rows.npy"))); N = int(pd.read_parquet(os.path.join(SERV, "coords_v2.parquet"), columns=["mbid"]).shape[0])
    I = np.full((N, K), -1, np.int32); D = np.full((N, K), np.inf, np.float32); filled = 0
    for pr in parts:
        s = os.path.basename(pr)[4:-9]; rows = np.load(pr); I[rows] = np.load(os.path.join(G, "part{}_I.npy".format(s))); D[rows] = np.load(os.path.join(G, "part{}_D.npy".format(s))); filled += len(rows)
    assert filled == N and (I >= 0).all(), "샤드 누락: {} / {}".format(filled, N)
    np.save(os.path.join(G, "indices.npy"), I); np.save(os.path.join(G, "dists.npy"), D)
    rc = json.load(io.open(os.path.join(G, "recall_check.json"), encoding="utf-8")); P = int(os.environ.get("P_FIXED", rc["auto_pick"]))
    meta = {"bundle": "serving/v2.1-pca16", "n": int(N), "k": K, "method": "k-means {} cells (1M-sample MiniBatchKMeans) multi-probe, P={}".format(N_CELLS, P),
            "note": "트리 리프 중심 탐침은 P=48 에서 recall@30 0.80 으로 기각 (리프가 길게 늘어진 영역). k-means 셀 P=64 도 목표 0.95 미달(0.912) — d30 비율 1.002 로 근접 동률 누락이라 판단, 정성 여정용으로 사용. 미달 사실 기록.",
            "recall_check": rc["recall_check"], "recall_target": rc["target"], "recall_target_met": rc["target_met"], "chosen_P": P, "n_check": N_CHECK,
            "d_k_median": float(np.median(D[:, -1])), "d_1_median": float(np.median(D[:, 0])), "d_10_median": float(np.median(D[:, 9])),
            "n_shards": len(parts), "mbid_order": "serving/v2.1-pca16/coords_v2.parquet 행 순서"}
    json.dump(meta, io.open(os.path.join(G, "meta.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    for pr in parts:
        s = os.path.basename(pr)[4:-9]
        for f in ("part{}_rows.npy", "part{}_I.npy", "part{}_D.npy"): os.remove(os.path.join(G, f.format(s)))
    print("완료 merge — {:,} 행 / d1 median {:.2f} / d10 {:.2f} / d30 {:.2f}".format(N, meta["d_1_median"], meta["d_10_median"], meta["d_k_median"]))


if __name__ == "__main__":
    merge() if "--merge" in sys.argv else main()
