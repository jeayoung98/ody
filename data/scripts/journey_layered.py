# -*- coding: utf-8 -*-
"""층별 DP 여정 — 역 10개 고정, 이웃 간선 제약, 걸음² 합 최소화 (부드러운 여정).

1) 축: 출발 A → 도착 B 직선. 모든 곡의 진행도 p = ((x−A)·u)/|B−A|, 축 이탈 거리 r.
2) 통로 후보: 0<p<1, r ≤ R (R 은 4.0 에서 시작, 층당 후보가 MIN_LAYER 미만이면 6.0 까지 확대), 통과 가능(길이 30–1200s 또는 결측, 제목 있음),
   A·B 와 같은 canonical 제외. 층 k(1..10) = p ∈ [k/11 − 1/22, k/11 + 1/22]; 층당 r 작은 순 상위 LAYER_CAP.
3) 전이: 서로 30-이웃(kNN 그래프 k=30, 무방향)일 때만. 거리 < τ_dup(1.66) 인 전이는 같은 녹음 수준이라 금지.
   이웃 간선만으로 경로가 없으면 완화(거리 ≤ τ_far 4.91)로 재시도하고 사용한 모드를 기록.
4) 비용: Σ d² (Viterbi). 사후 제약: 같은 canonical 중복·아티스트 상한 3 위반 시 해당 곡 제거 후 재실행(최대 5회).
산출: work/qual/journeys_layered.json, output/qual_journey.md 층별 DP 절(+ 4방식 비교표). 좌표·규칙 변경 없음.
"""
import io, json, os, re, sys, time
import numpy as np, pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "work"); OUT = os.path.join(ROOT, "output"); Q = os.path.join(WORK, "qual")
SERV = os.path.join(ROOT, "serving", "v2.1-pca16"); G = os.path.join(WORK, "knn_graph")
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from qual_prepare import PC, GN, yt   # noqa: E402
N_ST = 10; ART_CAP = 3; R0, RMAX = 4.0, 6.0; MIN_LAYER = 200; LAYER_CAP = 4000


def esc(s):
    return str(s).replace("|", "\\|").replace("\n", " ")


def pair_dist(X, U, V):
    """U×V 유클리드 거리 (행렬곱 형태 — 브로드캐스트 4000×4000×16 회피)."""
    XU = X[U].astype(np.float64); XV = X[V].astype(np.float64)
    D2 = (XU ** 2).sum(1)[:, None] + (XV ** 2).sum(1)[None, :] - 2.0 * (XU @ XV.T)
    return np.sqrt(np.maximum(D2, 0))


def viterbi(layers, X, s, t, allowed_fn, tau_dup, node_pen=None):
    """layers: 층별 후보 인덱스 배열 리스트. allowed_fn(u_arr, v_arr, Dm) → bool 행렬. node_pen: 노드별 추가 비용(전곡 배열, 예: λ·축이탈²).
    반환: 경로 인덱스 리스트 or None, 비용."""
    prev_nodes = np.array([s]); prev_cost = np.array([0.0]); back = []
    for L in layers + [np.array([t])]:
        Dm = pair_dist(X, prev_nodes, L)
        ok = allowed_fn(prev_nodes, L, Dm) & (Dm >= tau_dup)
        pen = node_pen[L][None, :] if node_pen is not None else 0.0
        C = np.where(ok, prev_cost[:, None] + Dm ** 2 + pen, np.inf)
        arg = C.argmin(0); best = C[arg, np.arange(len(L))]
        if not np.isfinite(best).any(): return None, None
        back.append(arg); prev_nodes, prev_cost = L, best
    # 역추적
    path = [t]; j = 0
    for k in range(len(back) - 1, -1, -1):
        j = back[k][j]; path.append(int(([s] if k == 0 else layers[k - 1])[j]))
    return path[::-1], float(prev_cost[0])


def main():
    t0 = time.time()
    co = pd.read_parquet(os.path.join(SERV, "coords_v2.parquet")); co["mbid"] = co["mbid"].astype(str).str.lower()
    X = np.ascontiguousarray(co[PC].to_numpy(np.float32)); mb = co["mbid"].to_numpy(); del co
    N = len(mb); pos = pd.Series(np.arange(N), index=mb); sq = (X ** 2).sum(1)
    cat = pd.read_parquet(os.path.join(WORK, "catalog_v2.parquet"), columns=["mbid", "canonical", "artist_raw", "title_raw", "length", "leaf_id", "node_d2"]).set_index("mbid").reindex(mb)
    sm = pd.read_parquet(os.path.join(WORK, "v2_song_meta.parquet"), columns=["mbid", "artist_norm"]).set_index("mbid").reindex(mb)
    canon = cat["canonical"].to_numpy(); art_n = sm["artist_norm"].fillna("").to_numpy(); length = cat["length"].to_numpy(float)
    artist = cat["artist_raw"].fillna("").to_numpy(); title = cat["title_raw"].fillna("").to_numpy(); leaf = cat["leaf_id"].to_numpy(); d2 = cat["node_d2"].to_numpy()
    br = pd.read_parquet(os.path.join(OUT, "bridge_v2.parquet")); br["mbid"] = br["mbid"].astype(str).str.lower()
    gcode_of = br.set_index("mbid")["gnr"].fillna("").str.split("|").str[0].fillna("").to_dict()
    passable = (((length >= 30) & (length <= 1200)) | np.isnan(length)) & (title != "")
    I = np.load(os.path.join(G, "indices.npy")); gmeta = json.load(io.open(os.path.join(G, "meta.json"), encoding="utf-8"))
    rules = json.load(io.open(os.path.join(SERV, "postprocess_rules.json"), encoding="utf-8")); TAU_DUP = float(rules["tau_dup"]["value"]); TAU_FAR = float(rules["tau_far"]["value"])
    print("로드 ({:.1f}m)".format((time.time() - t0) / 60), flush=True)

    def row(i, prev=None):
        r = {"mbid": mb[i], "artist": artist[i][:60], "title": title[i][:80], "leaf": leaf[i], "node_d2": d2[i],
             "length_s": None if np.isnan(length[i]) else round(float(length[i]), 1), "genre": GN.get(gcode_of.get(mb[i], ""), ""), "youtube": yt(artist[i], title[i])}
        if prev is not None: r["dist_from_prev"] = round(float(np.linalg.norm(X[i] - X[prev])), 2)
        return r

    def is_edge(a, b):
        return bool((I[a] == b).any() or (I[b] == a).any())

    def edge_matrix(U, V, Dm=None):
        """U×V 불리언: 서로 30-이웃인가 (무방향)."""
        Vset = pd.Series(np.arange(len(V)), index=V); M = np.zeros((len(U), len(V)), bool)
        for i, u in enumerate(U):
            hit = Vset.reindex(I[u]).dropna().to_numpy().astype(int); M[i, hit] = True
        Uset = pd.Series(np.arange(len(U)), index=U)
        for j, v in enumerate(V):
            hit = Uset.reindex(I[v]).dropna().to_numpy().astype(int); M[hit, j] = True
        return M

    lin = json.load(io.open(os.path.join(Q, "journeys.json"), encoding="utf-8"))
    ast = json.load(io.open(os.path.join(Q, "journeys_astar.json"), encoding="utf-8")) if os.path.exists(os.path.join(Q, "journeys_astar.json")) else None
    # 변형: (이름, λ_axis, 진단용?) — 비용 = Σ걸음² + λ·Σ(역 축이탈)². 진단용(λ 민감도)은 비교표에만 싣고 양식·상세표에서는 제외
    VARIANTS = [("층별 DP", 0.0, False), ("층별 DP+축 λ=1", 1.0, False), ("층별 DP+축 λ=0.5", 0.5, True), ("층별 DP+축 λ=2", 2.0, True)]
    out = []
    for j, (vlabel, lam, diag) in [(j_, v) for j_ in lin for v in VARIANTS]:
        s, t = int(pos[j["from"]["mbid"]]), int(pos[j["to"]["mbid"]]); A, B = X[s], X[t]
        L = float(np.linalg.norm(B - A)); u = (B - A) / L
        p = ((X @ u) - float(A @ u)) / L; dA2 = sq - 2.0 * (X @ A) + float(A @ A); r = np.sqrt(np.maximum(dA2 - (p * L) ** 2, 0))
        base_ok = passable & (p > 0) & (p < 1) & (canon != canon[s]) & (canon != canon[t])
        banned = set(); mode = None; path = None; R = R0; info = {}
        for attempt in range(6):
            ok = base_ok.copy()
            if banned: ok[np.fromiter(banned, int)] = False
            layers = []; R = R0
            while True:
                cand = np.flatnonzero(ok & (r <= R)); layers = []
                for k in range(1, N_ST + 1):
                    c = k / (N_ST + 1); m = cand[(p[cand] >= c - 0.5 / (N_ST + 1)) & (p[cand] < c + 0.5 / (N_ST + 1))]
                    m = m[np.argsort(r[m])][:LAYER_CAP]; layers.append(m)
                if min(len(m) for m in layers) >= MIN_LAYER or R >= RMAX: break
                R += 0.5
            for mode_try, fn in (("neighbor_edge", edge_matrix), ("relaxed_tau_far", lambda U, V, Dm: Dm <= TAU_FAR)):
                path, cost = viterbi(layers, X, s, t, fn, TAU_DUP, node_pen=(lam * r ** 2) if lam > 0 else None)
                if path is not None: mode = mode_try; break
            if path is None: break
            # 사후 제약: canonical 중복·아티스트 상한
            inner = path[1:-1]; bad = set()
            seen_c = {};
            for i in inner: seen_c.setdefault(canon[i], []).append(i)
            for c_, lst in seen_c.items():
                if len(lst) > 1: bad.update(lst[1:])
            arts = {}
            for i in inner: arts.setdefault(art_n[i], []).append(i)
            for a_, lst in arts.items():
                if a_ and len(lst) > ART_CAP: bad.update(lst[ART_CAP:])
            if not bad: break
            banned |= bad
        straight = L
        if path is None:
            out.append({"name": "{} ({})".format(j["name"], vlabel), "variant": vlabel, "lambda_axis": lam, "diagnostic": diag, "from": row(s), "to": row(t), "endpoint_dist": round(straight, 2), "reachable": False,
                        "corridor_R": R, "layer_sizes": [int(len(m)) for m in layers], "stations": []})
            print("{} [{}]: 경로 없음 (R={}, 층 크기 {})".format(j["name"], vlabel, R, [len(m) for m in layers]), flush=True); continue
        seg = np.linalg.norm(np.diff(X[path], axis=0), axis=1); stations = []
        for k in range(1, len(path) - 1):
            rr = row(path[k], path[k - 1]); rr["is_graph_edge_from_prev"] = is_edge(path[k - 1], path[k]); rr["progress"] = round(float(p[path[k]]), 3); rr["off_axis"] = round(float(r[path[k]]), 2); stations.append(rr)
        rec = {"name": "{} ({})".format(j["name"], vlabel), "variant": vlabel, "lambda_axis": lam, "diagnostic": diag, "from": row(s), "to": row(t), "endpoint_dist": round(straight, 2), "reachable": True,
               "transition_mode": mode, "corridor_R": R, "layer_sizes": [int(len(m)) for m in layers], "banned_for_constraints": len(banned),
               "hops": len(path) - 1, "path_length": round(float(seg.sum()), 2), "detour_ratio": round(float(seg.sum() / straight), 3), "cost_sum_sq": round(float((seg ** 2).sum()), 2),
               "max_hop": round(float(seg.max()), 2), "median_hop": round(float(np.median(seg)), 2), "min_hop": round(float(seg.min()), 2),
               "edge_share": round(float(np.mean([is_edge(a, b) for a, b in zip(path[:-1], path[1:])])), 2), "d2_changes": int(sum(1 for a, b in zip(path[:-1], path[1:]) if d2[a] != d2[b])),
               "off_axis_median": round(float(np.median(r[path[1:-1]])), 2), "off_axis_max": round(float(r[path[1:-1]].max()), 2),
               "stations": stations, "last_to_end": round(float(seg[-1]), 2), "path_nodes_d2": [d2[i] for i in path]}
        out.append(rec)
        print("{} [{}]: 모드 {} / R {} / 층 {}~{} / 경로 {:.2f} (직선 {:.2f}, ×{:.2f}) / hop median {:.2f} min {:.2f} max {:.2f} / 축이탈 median {:.2f} / 간선 {:.0%} / 금지 {}".format(
            j["name"], vlabel, mode, R, min(rec["layer_sizes"]), max(rec["layer_sizes"]), rec["path_length"], straight, rec["detour_ratio"], rec["median_hop"], rec["min_hop"], rec["max_hop"], rec["off_axis_median"], rec["edge_share"], len(banned)), flush=True)
    json.dump({"graph": gmeta, "params": {"n_stations": N_ST, "R0": R0, "RMAX": RMAX, "MIN_LAYER": MIN_LAYER, "LAYER_CAP": LAYER_CAP, "tau_dup": TAU_DUP, "tau_far": TAU_FAR, "artist_cap": ART_CAP},
               "journeys": out}, io.open(os.path.join(Q, "journeys_layered.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=str)

    # ---- md 절 ----
    Lm = ["<!-- LAYERED-BEGIN -->", "## 층별 DP 여정 — 역 10개 고정 · 이웃 간선 제약 · 걸음² 최소화\n",
          "방법: 출발→도착 축 위 진행도 p 로 층 10개(p = k/11 ± 1/22)를 만들고, 축 이탈 r ≤ R(시작 {}, 층당 {}곡 미만이면 {}까지 확대) 통로 안 후보만 둔다. "
          "전이는 서로 30-이웃(kNN 그래프)일 때만 허용, 거리 < τ_dup {:.2f} 전이는 같은 녹음 수준이라 금지. 비용 = Σ 걸음². 이웃 간선만으로 길이 없으면 거리 ≤ τ_far {:.2f} 로 완화하고 그 사실을 표기. "
          "같은 canonical 중복·아티스트 상한 {} 위반 곡은 제거 후 재실행.\n".format(R0, MIN_LAYER, RMAX, TAU_DUP, TAU_FAR, ART_CAP)]
    Lm.append("축 이탈 항: **층별 DP+축** 은 비용에 λ·Σ(역의 축 이탈 r)² 를 더해 직선에 붙으면서 이웃 간선도 지키는 절충 (청취 관찰 '직선 보간 우세' 가설 검증용). λ=1 이 양식에 들어가고 λ=0.5·2 는 민감도 진단.\n")
    Lm.append("### 방식 비교 (같은 출발·도착)\n")
    Lm.append("| 여정 | 직선 | 방식 | 역 수 | 걸음 median | 최소 | 최대 | **축 이탈 median** | 최대 | 인접 역 간선 비율 | 노드(d2) 변경 | 경로 길이 | 우회 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|")

    def axis_of(j):
        s_, t_ = int(pos[j["from"]["mbid"]]), int(pos[j["to"]["mbid"]]); A_, B_ = X[s_], X[t_]; L_ = float(np.linalg.norm(B_ - A_)); u_ = (B_ - A_) / L_
        def off(ids):
            P = X[ids]; pp = ((P - A_) @ u_); return np.sqrt(np.maximum(((P - A_) ** 2).sum(1) - pp ** 2, 0))
        return L_, off

    def stat_row(label, ids, L_, off, bold=False):
        g_ = np.linalg.norm(np.diff(X[ids], axis=0), axis=1); oa = off(ids[1:-1]); lab = "**{}**".format(label) if bold else label
        return "| | | {} | {} | {:.2f} | {:.2f} | {:.2f} | **{:.2f}** | {:.2f} | {:.0%} | {} | {:.2f} | ×{:.2f} |".format(
            lab, len(ids) - 2, np.median(g_), g_.min(), g_.max(), np.median(oa), oa.max(), np.mean([is_edge(x, y) for x, y in zip(ids[:-1], ids[1:])]),
            sum(1 for x, y in zip(ids[:-1], ids[1:]) if d2[x] != d2[y]), g_.sum(), g_.sum() / L_)

    for j in lin:
        L_, off = axis_of(j)
        lin_ids = [int(pos[j["from"]["mbid"]])] + [int(pos[x["mbid"]]) for x in j["stations"]] + [int(pos[j["to"]["mbid"]])]
        Lm.append("| {} | {:.2f} | | | | | | | | | | | |".format(j["name"], L_))
        Lm.append(stat_row("직선 보간", lin_ids, L_, off))
        if ast:
            for a in ast["journeys"]:
                if not a["name"].startswith(j["name"]): continue
                if not a.get("reachable"):
                    Lm.append("| | | {} | {} | | | | | | | | | |".format(a["variant"], "탐색 예산 초과" if a.get("search_budget_exceeded") else "도달 불가")); continue
                Lm.append(stat_row(a["variant"], [int(pos[a["from"]["mbid"]])] + [int(pos[x["mbid"]]) for x in a["stations"]] + [int(pos[a["to"]["mbid"]])], L_, off))
        for rec in out:
            if not rec["name"].startswith(j["name"]): continue
            if not rec["reachable"]:
                Lm.append("| | | **{}** | 경로 없음 (R={}) | | | | | | | | | |".format(rec["variant"], rec["corridor_R"])); continue
            lab = "{} ({})".format(rec["variant"], "이웃 간선" if rec["transition_mode"] == "neighbor_edge" else "완화 τ_far")
            Lm.append(stat_row(lab, [int(pos[rec["from"]["mbid"]])] + [int(pos[x["mbid"]]) for x in rec["stations"]] + [int(pos[rec["to"]["mbid"]])], L_, off, bold=not rec["diagnostic"]))
    Lm.append("\n읽는 법: 층별 DP 계열은 역 10개·진행 단조·이웃 간선이 제약이라 '역 수 10 / 간선 100%' 는 설계상 보장. 볼 것은 **걸음 크기의 고름(median·최소·최대)** 과 **축 이탈**(작을수록 두 끝점 직선에 붙음 — 청취 관찰에서 직선 보간이 우세했던 축), 그리고 우회 배율. 걸음이 전부 2.6~3.6 사이면 이 지도에서 낼 수 있는 가장 잔 걸음이다.\n")
    for rec in out:
        if rec.get("diagnostic"): continue
        Lm.append("### {}\n".format(rec["name"]))
        Lm.append("- 출발: **{} — {}** (`{}`) [검색]({})".format(esc(rec["from"]["artist"]), esc(rec["from"]["title"]), rec["from"]["node_d2"], rec["from"]["youtube"]))
        Lm.append("- 도착: **{} — {}** (`{}`) [검색]({})".format(esc(rec["to"]["artist"]), esc(rec["to"]["title"]), rec["to"]["node_d2"], rec["to"]["youtube"]))
        if not rec["reachable"]:
            Lm.append("- **경로 없음** — 통로 R={} 층 크기 {} 에서 이웃 간선·완화 모두 실패. 관찰로 기록.\n".format(rec["corridor_R"], rec["layer_sizes"])); continue
        Lm.append("- 전이 모드 **{}** · 통로 R {} · 층 크기 {}~{} · 경로 {:.2f} (직선 {:.2f}, 우회 ×{:.2f}) · 걸음 median {:.2f} / 최소 {:.2f} / 최대 {:.2f} · 제약 위반으로 제거된 곡 {}\n".format(
            "이웃 간선만" if rec["transition_mode"] == "neighbor_edge" else "완화(거리 ≤ τ_far)", rec["corridor_R"], min(rec["layer_sizes"]), max(rec["layer_sizes"]),
            rec["path_length"], rec["endpoint_dist"], rec["detour_ratio"], rec["median_hop"], rec["min_hop"], rec["max_hop"], rec["banned_for_constraints"]))
        Lm.append("| 역 | 제목 | 아티스트 | 노드(d2) | 리프 | 장르(멜론) | 진행도 | 축 이탈 | 앞 역과 거리 | 간선? | 듣기 | 끊김? |\n|---|---|---|---|---|---|---|---|---|---|---|---|")
        for k, s_ in enumerate(rec["stations"], 1):
            Lm.append("| {} | {} | {} | `{}` | {} | {} | {:.2f} | {:.2f} | {:.2f} | {} | [검색]({}) | __ |".format(
                k, esc(s_["title"]) or "(제목 없음)", esc(s_["artist"]) or "(미상)", s_["node_d2"], s_["leaf"], s_.get("genre") or "—", s_["progress"], s_["off_axis"], s_["dist_from_prev"],
                "✓" if s_["is_graph_edge_from_prev"] else "", s_["youtube"]))
        Lm.append("| 도착 | {} | {} | `{}` | | | 1.00 | 0 | {:.2f} | | | |".format(esc(rec["to"]["title"]), esc(rec["to"]["artist"]), rec["to"]["node_d2"], rec["last_to_end"]))
        Lm.append("\n경로 depth-2 노드 순서: `{}`\n".format(" → ".join(dict.fromkeys(rec["path_nodes_d2"]))))
        Lm.append("**사람 메모**: 자연스러운 구간 ______ · 끊기는 역 ______ · 세 방식 중 가장 자연스러운 판 ______\n")
    Lm.append("<!-- LAYERED-END -->")
    pth = os.path.join(OUT, "qual_journey.md"); s_ = io.open(pth, encoding="utf-8").read()
    s_ = re.sub(r"<!-- LAYERED-BEGIN -->.*?<!-- LAYERED-END -->\n?", "", s_, flags=re.S)
    marker = "---\n출처:"; block = "\n".join(Lm) + "\n\n"
    s_ = s_.replace(marker, block + marker, 1) if marker in s_ else s_ + "\n" + block
    io.open(pth, "w", encoding="utf-8").write(s_)
    print("완료 ({:.1f}m): work/qual/journeys_layered.json, output/qual_journey.md 갱신".format((time.time() - t0) / 60))


if __name__ == "__main__":
    main()
