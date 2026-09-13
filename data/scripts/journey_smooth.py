# -*- coding: utf-8 -*-
"""부드러운 여정 — 2차(곡률) 층별 DP + 표시 곡 제외 + 근거리 한국→해외 여정 추가.

이전 층별 DP(+축)에서 더한 것:
  (1) 곡률 벌점: 연속 두 걸음의 방향 전환 ||(w−v) − (v−u)||² 에 μ 를 곱해 비용에 더함 → 좌우로 흔들리지 않고 한 방향으로 흐르는 경로.
      상태가 (이전 역, 현재 역) 쌍이 되는 2차 Viterbi. 층당 후보는 연결성 보존 가지치기(앞 층과 30-이웃 간선이 있는 곡만) 후 축 이탈 작은 순 M개.
  (2) 카탈로그 표시 곡 제외: flag_comedy / flag_spoken / flag_fieldrec / flag_clipped / flag_low_sr (제외 아님, 여정 후보에서만 뺌).
  (3) 여정 추가: 멜론 플레이리스트 정답쌍 중 한국 곡 ↔ 해외 곡이고 지도 거리 6~10 (정답쌍 median 10.7 이내) 인 쌍 — '지도가 허용하는 거리에서는 부드러운가' 확인용.
      이 여정은 직선 보간 · 층별 DP+축 · 곡률 DP 세 판을 모두 만든다 (비교 가능하게).
비용 = Σ걸음² + λ·Σ축이탈² + μ·Σ곡률², 전이는 30-이웃 간선만(실패 시 ≤ τ_far 완화 표기), 거리 < τ_dup 전이 금지, 진행도 층 10개 고정.
산출: work/qual/journeys_smooth.json, output/qual_journey.md '곡률 DP' 절. 좌표·규칙 변경 없음.
"""
import io, json, os, re, sys, time
import numpy as np, pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "work"); OUT = os.path.join(ROOT, "output"); Q = os.path.join(WORK, "qual")
SERV = os.path.join(ROOT, "serving", "v2.1-pca16"); G = os.path.join(WORK, "knn_graph")
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from qual_prepare import PC, GN, yt   # noqa: E402
from journey_layered import pair_dist  # noqa: E402
N_ST = 10; ART_CAP = 3; R0, RMAX = 4.0, 6.0; MIN_LAYER = 150; M_PRUNE = 400
LAMBDA_AXIS = 1.0; MU_CURV = 0.5; MU_DIAG = [0.25, 1.0]
NEW_PAIR_DIST = (9.0, 10.7)   # 정답쌍 median(10.7) 바로 아래 — 역 10개가 의미 있으면서 '관련 있는' 거리
FOREIGN_GN = {"GN0900", "GN1000", "GN1100", "GN1200", "GN1300", "GN1400"}   # 멜론 해외 장르 대분류 (POP·록/메탈(해외)·일렉·랩/힙합(해외)·R&B(해외)·포크/컨트리(해외))


def esc(s):
    return str(s).replace("|", "\\|").replace("\n", " ")


def viterbi2(layers, X, s, t, edge_fn, tau_dup, r, lam, mu):
    """2차 Viterbi. 상태 = (이전 역 u, 현재 역 v). 반환 경로 or None."""
    L = layers
    # 초기: (s, v1)
    D0 = pair_dist(X, np.array([s]), L[0])[0]; ok0 = edge_fn(np.array([s]), L[0], D0[None, :])[0] & (D0 >= tau_dup)
    # C[u_idx, v_idx] : u ∈ 이전 층(또는 s), v ∈ 현재 층
    C = np.where(ok0, D0 ** 2 + lam * r[L[0]] ** 2, np.inf)[None, :]          # shape (1, |L1|)
    prev_nodes = np.array([s]); backs = []
    Xd = X.astype(np.float64)
    for k in range(1, len(L) + 1):
        cur = L[k - 1]; nxt = L[k] if k < len(L) else np.array([t])
        Dvw = pair_dist(X, cur, nxt); okvw = edge_fn(cur, nxt, Dvw) & (Dvw >= tau_dup)
        step = Dvw ** 2 + (lam * r[nxt] ** 2)[None, :] if k < len(L) else Dvw ** 2
        # 곡률 ||w − 2v + u||² = |w|² + 4|v|² + |u|² − 4 w·v + 2 w·u − 4 v·u
        U, V, W = Xd[prev_nodes], Xd[cur], Xd[nxt]
        su, sv, sw = (U ** 2).sum(1), (V ** 2).sum(1), (W ** 2).sum(1)
        WV = W @ V.T; WU = W @ U.T; VU = V @ U.T                                     # (w,v) (w,u) (v,u)
        # total[u, v, w] = C[u,v] + step[v,w] + mu*(sw[w] + 4sv[v] + su[u] − 4WV[w,v] + 2WU[w,u] − 4VU[v,u])
        curv = (mu * (sw[None, None, :] + 4 * sv[None, :, None] + su[:, None, None]
                      - 4 * WV.T[None, :, :] + 2 * WU.T[:, None, :] - 4 * VU.T[:, :, None])).astype(np.float32)
        total = C[:, :, None].astype(np.float32) + np.where(okvw, step, np.inf).astype(np.float32)[None, :, :] + curv
        arg = total.argmin(0)                                    # (v, w) → best u index
        Cn = np.take_along_axis(total, arg[None, :, :], axis=0)[0]  # (v, w)
        if not np.isfinite(Cn).any(): return None
        backs.append((prev_nodes, arg)); prev_nodes = cur; C = Cn
    # 종점: C 는 (v10, t) → 최소
    v_idx = int(np.argmin(C[:, 0])); path = [t, int(L[-1][v_idx])]
    w_idx = 0
    for k in range(len(backs) - 1, -1, -1):
        prev_nodes, arg = backs[k]; u_idx = int(arg[v_idx, w_idx]); path.append(int(prev_nodes[u_idx])); w_idx, v_idx = v_idx, u_idx
    path = path[::-1]
    assert path[0] == s and path[-1] == t and len(path) == len(L) + 2
    return path


def main():
    t0 = time.time()
    co = pd.read_parquet(os.path.join(SERV, "coords_v2.parquet")); co["mbid"] = co["mbid"].astype(str).str.lower()
    X = np.ascontiguousarray(co[PC].to_numpy(np.float32)); mb = co["mbid"].to_numpy(); del co
    N = len(mb); pos = pd.Series(np.arange(N), index=mb); sq = (X ** 2).sum(1)
    flags = ["flag_comedy", "flag_spoken", "flag_fieldrec", "flag_clipped", "flag_low_sr"]
    cat = pd.read_parquet(os.path.join(WORK, "catalog_v2.parquet"), columns=["mbid", "canonical", "artist_raw", "title_raw", "length", "leaf_id", "node_d2", "is_korean"] + flags).set_index("mbid").reindex(mb)
    sm = pd.read_parquet(os.path.join(WORK, "v2_song_meta.parquet"), columns=["mbid", "artist_norm"]).set_index("mbid").reindex(mb)
    canon = cat["canonical"].to_numpy(); art_n = sm["artist_norm"].fillna("").to_numpy(); length = cat["length"].to_numpy(float)
    artist = cat["artist_raw"].fillna("").to_numpy(); title = cat["title_raw"].fillna("").to_numpy(); leaf = cat["leaf_id"].to_numpy(); d2 = cat["node_d2"].to_numpy()
    flagged = np.zeros(N, bool)
    for f in flags: flagged |= cat[f].fillna(False).to_numpy().astype(bool)
    br = pd.read_parquet(os.path.join(OUT, "bridge_v2.parquet")); br["mbid"] = br["mbid"].astype(str).str.lower(); br = br[br["mbid"].isin(set(mb))]
    gcode_of = br.set_index("mbid")["gnr"].fillna("").str.split("|").str[0].fillna("").to_dict()
    passable = (((length >= 30) & (length <= 1200)) | np.isnan(length)) & (title != "")
    I = np.load(os.path.join(G, "indices.npy")); gmeta = json.load(io.open(os.path.join(G, "meta.json"), encoding="utf-8"))
    rules = json.load(io.open(os.path.join(SERV, "postprocess_rules.json"), encoding="utf-8")); TAU_DUP = float(rules["tau_dup"]["value"]); TAU_FAR = float(rules["tau_far"]["value"])
    print("로드 ({:.1f}m) — 표시 곡 {:,}".format((time.time() - t0) / 60, int(flagged.sum())), flush=True)

    def row(i, prev=None):
        r_ = {"mbid": mb[i], "artist": artist[i][:60], "title": title[i][:80], "leaf": leaf[i], "node_d2": d2[i],
              "length_s": None if np.isnan(length[i]) else round(float(length[i]), 1), "genre": GN.get(gcode_of.get(mb[i], ""), ""), "youtube": yt(artist[i], title[i])}
        if prev is not None: r_["dist_from_prev"] = round(float(np.linalg.norm(X[i] - X[prev])), 2)
        return r_

    def is_edge(a, b):
        return bool((I[a] == b).any() or (I[b] == a).any())

    def edge_matrix(U, V, Dm=None):
        Vset = pd.Series(np.arange(len(V)), index=V); Mx = np.zeros((len(U), len(V)), bool)
        for i, u in enumerate(U):
            hit = Vset.reindex(I[u]).dropna().to_numpy().astype(int); Mx[i, hit] = True
        Uset = pd.Series(np.arange(len(U)), index=U)
        for j_, v in enumerate(V):
            hit = Uset.reindex(I[v]).dropna().to_numpy().astype(int); Mx[hit, j_] = True
        return Mx

    # ---- 여정 목록: 기존 2개 + 근거리 한국↔해외 정답쌍 1개 ----
    lin = json.load(io.open(os.path.join(Q, "journeys.json"), encoding="utf-8"))
    journeys = [{"name": j["name"], "s": int(pos[j["from"]["mbid"]]), "t": int(pos[j["to"]["mbid"]]), "lin_stations": [int(pos[x["mbid"]]) for x in j["stations"]]} for j in lin]
    lab = pd.read_parquet(os.path.join(OUT, "labels_melon_pairs_v2.parquet")); m2m = br.set_index("melon_id")["mbid"]; kor = br.set_index("mbid")["is_korean"]
    lab["ma"] = lab["song_a"].map(m2m); lab["mb"] = lab["song_b"].map(m2m); lab = lab.dropna(subset=["ma", "mb"])
    lab["ka"] = lab["ma"].map(kor).fillna(False).astype(bool); lab["kb"] = lab["mb"].map(kor).fillna(False).astype(bool)
    # 해외 곡 = 멜론 해외 장르 코드 (is_korean 만으로는 K-pop 쌍이 '해외'로 새는 오류 — 첫 실행에서 TWICE→AOA 선택됨)
    fa = lab["ma"].map(gcode_of).isin(FOREIGN_GN); fb = lab["mb"].map(gcode_of).isin(FOREIGN_GN)
    cross = lab[((lab["ka"] & fb & ~lab["kb"]) | (lab["kb"] & fa & ~lab["ka"])) & (~lab["same_artist"].astype(bool))].copy()
    ia = pos.reindex(cross["ma"]).to_numpy(); ib = pos.reindex(cross["mb"]).to_numpy(); ok = np.isfinite(ia) & np.isfinite(ib)
    cross = cross[ok]; ia = ia[ok].astype(int); ib = ib[ok].astype(int); cross["dist"] = np.linalg.norm(X[ia] - X[ib], axis=1); cross["ia"] = ia; cross["ib"] = ib
    cand = cross[(cross["dist"] >= NEW_PAIR_DIST[0]) & (cross["dist"] <= NEW_PAIR_DIST[1])].sort_values("co_count", ascending=False)
    cand = cand[[bool(title[i]) and bool(title[j_]) and passable[i] and passable[j_] for i, j_ in zip(cand["ia"], cand["ib"])]]
    top = cand.iloc[0]; s3, t3 = (int(top["ia"]), int(top["ib"])) if top["ka"] else (int(top["ib"]), int(top["ia"]))   # 한국 곡 → 해외 곡
    print("근거리 한국↔해외 정답쌍 후보 {:,} (거리 {}~{}) → 선택: {} — {}  →  {} — {} (거리 {:.2f}, 동반 {})".format(
        len(cand), *NEW_PAIR_DIST, artist[s3], title[s3], artist[t3], title[t3], top["dist"], int(top["co_count"])), flush=True)
    # 근거리 여정의 직선 보간 판 (qual_prepare 와 같은 규칙: 미사용 canonical, 아티스트 ≤2, 길이)
    def linear_journey(a, b, n=N_ST):
        used_c = {canon[a], canon[b]}; art_ct = {}; st = []
        for k in range(1, n + 1):
            tt = k / (n + 1); pnt = (1 - tt) * X[a] + tt * X[b]
            dvec = np.sqrt(np.maximum(sq - 2.0 * (X @ pnt) + (pnt ** 2).sum(), 0))
            for i in np.argsort(dvec)[:400]:
                if canon[i] in used_c or not title[i] or art_ct.get(art_n[i], 0) >= 2: continue
                if not (30 <= length[i] <= 1200) and np.isfinite(length[i]): continue
                used_c.add(canon[i]); art_ct[art_n[i]] = art_ct.get(art_n[i], 0) + 1; st.append(int(i)); break
        return st
    journeys.append({"name": "한국 곡 → 해외 곡 (근거리 정답쌍)", "s": s3, "t": t3, "lin_stations": linear_journey(s3, t3), "new": True,
                     "pair_info": {"co_count": int(top["co_count"]), "dist": round(float(top["dist"]), 2), "n_candidates": int(len(cand))}})

    # ---- DP 변형 ----
    # (라벨, λ, μ, 표시곡 제외, 양식 포함?, 전이 완화 강제?)
    #  - 곡률 DP: 이웃 간선 제약 유지 + 곡률 벌점
    #  - 축 우선 DP: 이웃 간선 제약을 버리고 전이를 '거리 ≤ τ_far' 로만 제한, λ=2 로 축에 강하게 붙임 + 곡률 벌점.
    #    근거: 청취 관찰에서 직선 보간(인접 역 간선 27%, 축 이탈 2.1~2.6) 이 우세 → '이웃 간선'보다 '축 근접'이 귀에 중요하다는 가설. 직선 보간의 최적화판.
    VARIANTS = [("곡률 DP", LAMBDA_AXIS, MU_CURV, True, True, False),
                ("축 우선 DP (≤τ_far, λ=2)", 2.0, MU_CURV, True, True, True),
                ("곡률 DP μ=0.25", LAMBDA_AXIS, MU_DIAG[0], True, False, False), ("곡률 DP μ=1", LAMBDA_AXIS, MU_DIAG[1], True, False, False),
                ("곡률 DP (표시곡 포함)", LAMBDA_AXIS, MU_CURV, False, False, False), ("층별 DP+축 (표시곡 제외, 2차 없음)", LAMBDA_AXIS, 0.0, True, False, False),
                ("축 우선 DP λ=1", 1.0, MU_CURV, True, False, True), ("축 우선 DP λ=4", 4.0, MU_CURV, True, False, True)]
    out = []
    for jn in journeys:
        s, t = jn["s"], jn["t"]; A, B = X[s], X[t]; Lax = float(np.linalg.norm(B - A)); u = (B - A) / Lax
        p = ((X @ u) - float(A @ u)) / Lax; dA2 = sq - 2.0 * (X @ A) + float(A @ A); r = np.sqrt(np.maximum(dA2 - (p * Lax) ** 2, 0))
        jn["axis"] = (Lax, p, r)
        # 근거리 여정은 청취 부담을 줄이기 위해 양식에 '직선 보간'과 '축 우선 DP' 만 (곡률 DP 는 진단 행으로만)
        variants = [(a, b, c, d, (e and not (jn.get("new") and a == "곡률 DP")), f) for a, b, c, d, e, f in VARIANTS]
        for vlabel, lam, mu, excl_flag, in_form, force_relaxed in variants:
            base_ok = passable & (p > 0) & (p < 1) & (canon != canon[s]) & (canon != canon[t])
            if excl_flag: base_ok &= ~flagged
            banned = set(); mode = None; path = None; R = R0; layers = []
            for attempt in range(6):
                ok = base_ok.copy()
                if banned: ok[np.fromiter(banned, int)] = False
                R = R0
                while True:
                    candi = np.flatnonzero(ok & (r <= R)); layers = []
                    for k in range(1, N_ST + 1):
                        c = k / (N_ST + 1); m = candi[(p[candi] >= c - 0.5 / (N_ST + 1)) & (p[candi] < c + 0.5 / (N_ST + 1))]
                        layers.append(m[np.argsort(r[m])])
                    if min(len(m) for m in layers) >= MIN_LAYER or R >= RMAX: break
                    R += 0.5
                modes = (("relaxed_tau_far", lambda U, V, Dm: Dm <= TAU_FAR),) if force_relaxed else (("neighbor_edge", edge_matrix), ("relaxed_tau_far", lambda U, V, Dm: Dm <= TAU_FAR))
                for mode_try, fn in modes:
                    # 연결성 보존 가지치기: 앞 층(또는 s)과 간선이 있는 곡만 남기고 축 이탈 작은 순 M개
                    pruned = []; prev = np.array([s])
                    for m in layers:
                        Dm = pair_dist(X, prev, m); okm = fn(prev, m, Dm) & (Dm >= TAU_DUP); keep = m[okm.any(0)][:M_PRUNE]
                        if len(keep) == 0: break
                        pruned.append(keep); prev = keep
                    if len(pruned) < N_ST: continue
                    path = viterbi2(pruned, X, s, t, fn, TAU_DUP, r, lam, mu)
                    if path is not None: mode = mode_try; layers = pruned; break
                if path is None: break
                inner = path[1:-1]; bad = set(); seen_c = {}; arts = {}
                for i in inner: seen_c.setdefault(canon[i], []).append(i); arts.setdefault(art_n[i], []).append(i)
                for lst in seen_c.values():
                    if len(lst) > 1: bad.update(lst[1:])
                for a_, lst in arts.items():
                    if a_ and len(lst) > ART_CAP: bad.update(lst[ART_CAP:])
                if not bad: break
                banned |= bad
            name = "{} ({})".format(jn["name"], vlabel)
            if path is None:
                out.append({"name": name, "journey": jn["name"], "variant": vlabel, "lambda_axis": lam, "mu_curv": mu, "exclude_flagged": excl_flag, "in_form": in_form, "force_relaxed": force_relaxed,
                            "from": row(s), "to": row(t), "endpoint_dist": round(Lax, 2), "reachable": False, "corridor_R": R, "stations": []})
                print("{} [{}]: 경로 없음".format(jn["name"], vlabel), flush=True); continue
            seg = np.linalg.norm(np.diff(X[path], axis=0), axis=1); steps = np.diff(X[path].astype(np.float64), axis=0)
            curv = np.linalg.norm(np.diff(steps, axis=0), axis=1)                       # 방향 전환 크기
            cosang = np.array([float(steps[i] @ steps[i + 1] / (np.linalg.norm(steps[i]) * np.linalg.norm(steps[i + 1]) + 1e-9)) for i in range(len(steps) - 1)])
            stations = []
            for k in range(1, len(path) - 1):
                rr = row(path[k], path[k - 1]); rr["is_graph_edge_from_prev"] = is_edge(path[k - 1], path[k]); rr["progress"] = round(float(p[path[k]]), 3); rr["off_axis"] = round(float(r[path[k]]), 2)
                rr["turn_from_prev"] = round(float(curv[k - 1]), 2) if k - 1 < len(curv) else None; stations.append(rr)
            rec = {"name": name, "journey": jn["name"], "variant": vlabel, "lambda_axis": lam, "mu_curv": mu, "exclude_flagged": excl_flag, "in_form": in_form, "force_relaxed": force_relaxed,
                   "from": row(s), "to": row(t), "endpoint_dist": round(Lax, 2), "reachable": True, "transition_mode": mode, "corridor_R": R,
                   "layer_sizes": [int(len(m)) for m in layers], "banned_for_constraints": len(banned),
                   "hops": len(path) - 1, "path_length": round(float(seg.sum()), 2), "detour_ratio": round(float(seg.sum() / Lax), 3),
                   "median_hop": round(float(np.median(seg)), 2), "min_hop": round(float(seg.min()), 2), "max_hop": round(float(seg.max()), 2),
                   "off_axis_median": round(float(np.median(r[path[1:-1]])), 2), "off_axis_max": round(float(r[path[1:-1]].max()), 2),
                   "turn_median": round(float(np.median(curv)), 2), "turn_max": round(float(curv.max()), 2), "cos_consecutive_median": round(float(np.median(cosang)), 3),
                   "edge_share": round(float(np.mean([is_edge(a, b) for a, b in zip(path[:-1], path[1:])])), 2), "d2_changes": int(sum(1 for a, b in zip(path[:-1], path[1:]) if d2[a] != d2[b])),
                   "stations": stations, "last_to_end": round(float(seg[-1]), 2), "path_nodes_d2": [d2[i] for i in path]}
            out.append(rec)
            print("{} [{}]: {} R {} / 경로 {:.2f} (직선 {:.2f}, ×{:.2f}) / 걸음 {:.2f} [{:.2f}, {:.2f}] / 축이탈 {:.2f} / 방향전환 median {:.2f} max {:.2f} cos {:.2f} / 간선 {:.0%} / 금지 {}".format(
                jn["name"], vlabel, mode, R, rec["path_length"], Lax, rec["detour_ratio"], rec["median_hop"], rec["min_hop"], rec["max_hop"], rec["off_axis_median"],
                rec["turn_median"], rec["turn_max"], rec["cos_consecutive_median"], rec["edge_share"], len(banned)), flush=True)

    # 근거리 여정의 직선 보간 판 (양식용) 도 기록
    jn3 = journeys[-1]; s, t = jn3["s"], jn3["t"]; ids = [s] + jn3["lin_stations"] + [t]; Lax, p, r = jn3["axis"]
    seg = np.linalg.norm(np.diff(X[ids], axis=0), axis=1); stations = []
    for k in range(1, len(ids) - 1):
        rr = row(ids[k], ids[k - 1]); rr["is_graph_edge_from_prev"] = is_edge(ids[k - 1], ids[k]); rr["progress"] = round(float(p[ids[k]]), 3); rr["off_axis"] = round(float(r[ids[k]]), 2); stations.append(rr)
    lin3 = {"name": jn3["name"] + " (직선 보간)", "journey": jn3["name"], "variant": "직선 보간", "in_form": True, "from": row(s), "to": row(t), "endpoint_dist": round(Lax, 2), "reachable": True,
            "hops": len(ids) - 1, "path_length": round(float(seg.sum()), 2), "detour_ratio": round(float(seg.sum() / Lax), 3), "median_hop": round(float(np.median(seg)), 2),
            "min_hop": round(float(seg.min()), 2), "max_hop": round(float(seg.max()), 2), "off_axis_median": round(float(np.median(r[ids[1:-1]])), 2),
            "edge_share": round(float(np.mean([is_edge(a, b) for a, b in zip(ids[:-1], ids[1:])])), 2), "stations": stations, "last_to_end": round(float(seg[-1]), 2), "pair_info": jn3["pair_info"]}
    out.insert(len(out) - sum(1 for o in out if o["journey"] == jn3["name"]), lin3)
    json.dump({"graph": gmeta, "params": {"n_stations": N_ST, "lambda_axis": LAMBDA_AXIS, "mu_curv": MU_CURV, "mu_diag": MU_DIAG, "M_prune": M_PRUNE, "R0": R0, "RMAX": RMAX,
                                          "flags_excluded": flags, "new_pair_dist": NEW_PAIR_DIST, "tau_dup": TAU_DUP, "tau_far": TAU_FAR},
               "new_journey": {"name": jn3["name"], "from": row(s), "to": row(t), **jn3["pair_info"]}, "journeys": out},
              io.open(os.path.join(Q, "journeys_smooth.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=str)

    # ---- md 절 ----
    def stats_of(ids, jn):
        Lax, p, r = jn["axis"]; g_ = np.linalg.norm(np.diff(X[ids], axis=0), axis=1); steps = np.diff(X[ids].astype(np.float64), axis=0)
        cv = np.linalg.norm(np.diff(steps, axis=0), axis=1); cs = [float(steps[i] @ steps[i + 1] / (np.linalg.norm(steps[i]) * np.linalg.norm(steps[i + 1]) + 1e-9)) for i in range(len(steps) - 1)]
        return dict(n=len(ids) - 2, med=np.median(g_), mn=g_.min(), mx=g_.max(), oa=np.median(r[ids[1:-1]]), turn=np.median(cv), cos=np.median(cs),
                    edge=np.mean([is_edge(a, b) for a, b in zip(ids[:-1], ids[1:])]), plen=g_.sum(), det=g_.sum() / Lax)
    def fmt(label, st, bold=False):
        lab = "**{}**".format(label) if bold else label
        return "| | | {} | {} | {:.2f} | {:.2f} | {:.2f} | {:.2f} | {:.2f} | {:.2f} | {:.0%} | {:.2f} | ×{:.2f} |".format(lab, st["n"], st["med"], st["mn"], st["mx"], st["oa"], st["turn"], st["cos"], st["edge"], st["plen"], st["det"])
    Lm = ["<!-- SMOOTH-BEGIN -->", "## 곡률 DP 여정 — 방향 전환 벌점 + 표시 곡 제외 + 근거리 한국↔해외 여정\n",
          "이전 층별 DP+축에 더한 것: (1) **곡률 벌점** μ·||(w−v)−(v−u)||² (μ={}) — 연속 두 걸음이 같은 방향을 향하게 해 좌우 흔들림을 줄임 (상태가 역 쌍인 2차 Viterbi, 층당 후보는 앞 층과 이웃 간선이 있는 곡만 남겨 축 이탈 작은 순 {}개). "
          "(2) 카탈로그 **표시 곡 제외**: {} (지도에서 제외한 것이 아니라 여정 후보에서만 뺌). (3) **근거리 여정 추가**: 멜론 정답쌍 중 한국 곡 ↔ 해외 곡, 지도 거리 {}~{} (정답쌍 median 10.7 이내), 동반 횟수 최다 — "
          "기존 한국곡→힙합(15.29, 무관 눈금 초과)이 방법과 무관하게 나빴던 것이 끝점 탓인지 확인. 비용 = Σ걸음² + λ·Σ축이탈² + μ·Σ곡률², 이웃 간선 제약·τ_dup 금지·층 10개는 그대로.\n".format(
              MU_CURV, M_PRUNE, ", ".join(flags), *NEW_PAIR_DIST)]
    Lm.append("**축 우선 DP**: 이웃 간선 제약을 버리고 전이를 '거리 ≤ τ_far {:.2f}' 로만 제한, λ=2 로 축에 강하게 붙이고 곡률 벌점 유지. 청취 관찰(직선 보간 우세 — 인접 역이 이웃인 비율 27%인데도 축 이탈 2.1~2.6) 에서 나온 "
              "'귀에는 이웃 간선보다 축 근접이 중요하다' 가설을 그대로 구현한 것 = 직선 보간의 최적화판. 표의 '간선' 열이 100% 가 아닌 것은 설계상 의도.\n".format(TAU_FAR))
    Lm.append("근거리 여정: **{} — {}** → **{} — {}** (거리 {:.2f}, 플레이리스트 동반 {}회, 후보 쌍 {:,}개 중 선택).\n".format(
        esc(artist[s3]), esc(title[s3]), esc(artist[t3]), esc(title[t3]), jn3["pair_info"]["dist"], jn3["pair_info"]["co_count"], jn3["pair_info"]["n_candidates"]))
    Lm.append("### 비교 (방향 전환 = 연속 두 걸음 벡터 차의 크기 median, 작을수록 한 방향으로 흐름 · cos = 연속 걸음 사이 코사인 median, 1 에 가까울수록 직진)\n")
    Lm.append("| 여정 | 직선 | 방식 | 역 | 걸음 median | 최소 | 최대 | 축 이탈 | **방향 전환** | **cos** | 간선 | 경로 | 우회 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    layered = json.load(io.open(os.path.join(Q, "journeys_layered.json"), encoding="utf-8"))["journeys"] if os.path.exists(os.path.join(Q, "journeys_layered.json")) else []
    for jn in journeys:
        s, t = jn["s"], jn["t"]; Lm.append("| {} | {:.2f} | | | | | | | | | | | |".format(jn["name"], jn["axis"][0]))
        Lm.append(fmt("직선 보간", stats_of([s] + jn["lin_stations"] + [t], jn)))
        for rec in layered:
            if rec["name"].startswith(jn["name"]) and rec.get("reachable") and not rec.get("diagnostic"):
                Lm.append(fmt(rec["variant"], stats_of([s] + [int(pos[x["mbid"]]) for x in rec["stations"]] + [t], jn)))
        for rec in out:
            if rec["journey"] != jn["name"] or rec["variant"] == "직선 보간": continue
            if not rec["reachable"]: Lm.append("| | | {} | 경로 없음 | | | | | | | | | |".format(rec["variant"])); continue
            Lm.append(fmt(rec["variant"] + ("" if rec["transition_mode"] == "neighbor_edge" else " (완화 τ_far)"), stats_of([s] + [int(pos[x["mbid"]]) for x in rec["stations"]] + [t], jn), bold=rec["in_form"]))
    Lm.append("\n읽는 법: 굵은 행이 평가 양식에 들어간 판. '방향 전환'과 'cos' 가 곡률 벌점이 겨냥한 지표 — 이전 판들과 비교해 줄었는지 본다. 표시곡 포함/μ 변화 행은 민감도 진단.\n")
    for rec in out:
        if not rec.get("in_form"): continue
        Lm.append("### {}\n".format(rec["name"]))
        Lm.append("- 출발: **{} — {}** (`{}`) [검색]({})".format(esc(rec["from"]["artist"]), esc(rec["from"]["title"]), rec["from"]["node_d2"], rec["from"]["youtube"]))
        Lm.append("- 도착: **{} — {}** (`{}`) [검색]({})".format(esc(rec["to"]["artist"]), esc(rec["to"]["title"]), rec["to"]["node_d2"], rec["to"]["youtube"]))
        if not rec["reachable"]: Lm.append("- **경로 없음**\n"); continue
        Lm.append("- 직선 {:.2f} · 경로 {:.2f} (우회 ×{:.2f}) · 걸음 median {:.2f} [{:.2f}, {:.2f}] · 축 이탈 median {:.2f} · 간선 {:.0%}{}\n".format(
            rec["endpoint_dist"], rec["path_length"], rec["detour_ratio"], rec["median_hop"], rec["min_hop"], rec["max_hop"], rec["off_axis_median"], rec["edge_share"],
            " · 방향 전환 median {:.2f}".format(rec["turn_median"]) if "turn_median" in rec else ""))
        Lm.append("| 역 | 제목 | 아티스트 | 노드(d2) | 장르(멜론) | 진행도 | 축 이탈 | 앞 역과 거리 | 간선? | 듣기 | 끊김? |\n|---|---|---|---|---|---|---|---|---|---|---|")
        for k, s_ in enumerate(rec["stations"], 1):
            Lm.append("| {} | {} | {} | `{}` | {} | {:.2f} | {:.2f} | {:.2f} | {} | [검색]({}) | __ |".format(
                k, esc(s_["title"]) or "(제목 없음)", esc(s_["artist"]) or "(미상)", s_["node_d2"], s_.get("genre") or "—", s_["progress"], s_["off_axis"], s_["dist_from_prev"],
                "✓" if s_["is_graph_edge_from_prev"] else "", s_["youtube"]))
        Lm.append("| 도착 | {} | {} | `{}` | | 1.00 | 0 | {:.2f} | | | |".format(esc(rec["to"]["title"]), esc(rec["to"]["artist"]), rec["to"]["node_d2"], rec["last_to_end"]))
        Lm.append("\n**사람 메모**: 자연스러운 구간 ______ · 끊기는 역 ______ · 이전 판(직선/DP+축)보다 부드러운가 ______\n")
    Lm.append("<!-- SMOOTH-END -->")
    pth = os.path.join(OUT, "qual_journey.md"); s_ = io.open(pth, encoding="utf-8").read()
    s_ = re.sub(r"<!-- SMOOTH-BEGIN -->.*?<!-- SMOOTH-END -->\n?", "", s_, flags=re.S)
    marker = "## 청취 관찰"; block = "\n".join(Lm) + "\n\n"
    s_ = s_.replace(marker, block + marker, 1) if marker in s_ else s_ + "\n" + block
    io.open(pth, "w", encoding="utf-8").write(s_)
    print("완료 ({:.1f}m): work/qual/journeys_smooth.json, output/qual_journey.md 갱신".format((time.time() - t0) / 60))


if __name__ == "__main__":
    main()
