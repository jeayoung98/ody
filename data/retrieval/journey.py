# -*- coding: utf-8 -*-
"""여정 (spec 11, Jira S15P21A405-118).

출발 A 에서 도착 B 까지 분위기가 조금씩 바뀌는 곡 열을 만든다.

## 왜 축 통로인가 (D10)
곡을 고를 때 **A→B 방향**을 본다. 모든 곡에 대해 두 값을 잰다.

    진행도  p = ((x − A)·u) / |B − A|      u = (B − A)/|B − A|      0 이 A, 1 이 B
    축 이탈 r = ‖(x − A) − p·(B − A)‖      축에서 옆으로 얼마나 벗어났나

통로 = `0 < p < 1` 이고 `r ≤ R` 인 곡. 그 안에서 층(진행도 구간)마다 후보를 뽑고
Viterbi 로 비용이 가장 작은 열을 고른다.

    비용 = Σ 걸음²  +  λ·Σ 축이탈²

걸음²이 이어짐을 짧게 유지하고, 축이탈²이 A→B 방향을 벗어나지 않게 붙든다.

측정 근거(`docs/qual_journey.md`, 발라드→댄스 직선거리 10.46):

| 방식 | 인접 역 거리 median | 인접 역이 그래프 간선인 비율 |
|---|---|---|
| 직선 보간 | 3.32 | 27% |
| 축 통로 DP | **2.29** | **100%** |

직선 보간은 보간 지점마다 **독립으로** 최근접을 고른다. 그래서 연속한 두 역이 실제 이웃인
비율이 27% 에 그친다. 축 통로는 걸음 비용이 열 전체에 걸리므로 이어짐이 끊기지 않는다.

`linear` 모드는 지우지 않고 남긴다. 스펙 11 AC3 의 골든 대조가 이식 검증이기 때문이다.

## 최근접 조회 백엔드
`nearest_to_point` 하나로 모은다. 전곡 스캔과 그래프 후보 두 가지가 있고, 나중에 pgvector
백엔드를 같은 자리에 끼운다(스펙 17). 여정 로직은 어느 백엔드든 그대로 돈다.
"""
import numpy as np

from . import postprocess

# 통로 반경. 층이 얇으면 RADIUS_MAX 까지 넓힌다.
RADIUS_START, RADIUS_MAX, RADIUS_STEP = 4.0, 6.0, 1.0
RADIUS_MAX_RELAXED = 14.0   # 층 두께 조건을 버린 뒤 여기까지 넓힌다 (D3: 항상 잇는다)
MIN_LAYER = 30          # 층 하나에 이만큼은 있어야 한다
LAYER_CAP = 400         # 층당 후보 상한. 축 이탈 작은 순.
LAMBDA_OFF_AXIS = 2.0   # 축 이탈 벌점 가중치. 클수록 직선에 붙는다.
BLOCK = 250_000
MAX_REPAIR = 8          # 사후 규칙 위반 시 재시도 횟수
ARTIST_PENALTY = 1e4    # 상한을 넘은 아티스트에 매 회 더하는 벌점. 유한이라 통로를 막지 않는다.


# --------------------------------------------------------------------------
# 최근접 조회 (백엔드 교체 지점)
# --------------------------------------------------------------------------
def nearest_to_point(bundle, point, k=1, candidate_mask=None, candidates=None):
    """임의 좌표에서 가장 가까운 곡 k개. (행 인덱스, 거리) 를 거리 오름차순으로.

    candidates 를 주면 그 안에서만 찾는다(그래프 후보 경로). 없으면 전곡 스캔.
    pgvector 백엔드는 이 함수에 분기를 더해 붙인다(스펙 17).
    """
    coords = bundle.coords
    q = np.asarray(point, dtype=np.float32)

    if candidates is not None:
        cand = np.asarray(candidates, dtype=np.int64)
        if candidate_mask is not None:
            cand = cand[candidate_mask[cand]]
        if cand.size == 0:
            return np.empty(0, dtype=np.int64), np.empty(0, dtype=np.float32)
        dist = np.linalg.norm(coords[cand] - q, axis=1)
        order = np.argsort(dist, kind="stable")[:k]
        return cand[order], dist[order]

    # 전곡 스캔. ‖x−q‖² 에서 상수 ‖q‖² 를 뺀 값으로 비교한다(순서 동일).
    n = coords.shape[0]
    best_idx = np.empty(0, dtype=np.int64)
    best_val = np.empty(0, dtype=np.float32)
    for start in range(0, n, BLOCK):
        stop = min(start + BLOCK, n)
        block = coords[start:stop]
        partial = np.einsum("ij,ij->i", block, block) - 2.0 * (block @ q)
        if candidate_mask is not None:
            partial = np.where(candidate_mask[start:stop], partial, np.inf)
        take = min(k, stop - start)
        local = np.argpartition(partial, take - 1)[:take]
        best_idx = np.concatenate([best_idx, local + start])
        best_val = np.concatenate([best_val, partial[local]])
        if len(best_idx) > 4 * k:
            keep = np.argpartition(best_val, k - 1)[:k]
            best_idx, best_val = best_idx[keep], best_val[keep]

    order = np.argsort(best_val, kind="stable")
    order = order[np.isfinite(best_val[order])][:k]
    idx = best_idx[order]
    return idx, np.linalg.norm(coords[idx] - q, axis=1)


# --------------------------------------------------------------------------
# 축 좌표계
# --------------------------------------------------------------------------
def axis_frame(bundle, row_a, row_b):
    """A→B 축에서 전곡의 진행도 p 와 축 이탈 r 을 계산한다.

    p 는 A 에서 0, B 에서 1. r 은 축까지의 수직 거리.
    """
    coords = bundle.coords
    a = coords[row_a].astype(np.float64)
    b = coords[row_b].astype(np.float64)
    ab = b - a
    length = float(np.linalg.norm(ab))
    if length == 0.0:
        n = coords.shape[0]
        return np.zeros(n), np.zeros(n), 0.0
    u = (ab / length).astype(np.float32)
    a32 = a.astype(np.float32)
    n = coords.shape[0]
    p = np.empty(n, dtype=np.float32)
    r = np.empty(n, dtype=np.float32)
    # r 은 ‖rel‖² − proj² 로 구하면 두 큰 수의 차라 float32 에서 자리수가 날아간다
    # (축 위 곡의 r 이 0 대신 0.011 로 나왔다). 수직 성분을 직접 만들어 노름을 잰다.
    # (N, k) 임시 배열을 피하려고 블록으로 돈다.
    for start in range(0, n, BLOCK):
        stop = min(start + BLOCK, n)
        rel = coords[start:stop] - a32
        proj = rel @ u                                   # rel·u
        p[start:stop] = proj / np.float32(length)
        perp = rel - proj[:, None] * u                   # 수직 성분
        r[start:stop] = np.sqrt(np.einsum("ij,ij->i", perp, perp))
    return p, r, length


def _corridor_layers(p, r, n_stations, radius, passable):
    """층 k(1..n) 마다 후보 인덱스 배열. 없으면 None."""
    layers = []
    half = 1.0 / (2.0 * (n_stations + 1))
    for k in range(1, n_stations + 1):
        center = k / (n_stations + 1.0)
        sel = np.flatnonzero(passable & (r <= radius)
                             & (p > center - half) & (p < center + half))
        if sel.size == 0:
            return None
        if sel.size > LAYER_CAP:                       # 축 이탈 작은 순으로 자른다
            sel = sel[np.argpartition(r[sel], LAYER_CAP - 1)[:LAYER_CAP]]
        layers.append(sel)
    return layers


def _pair_dist(coords, u_rows, v_rows):
    """U×V 유클리드 거리. 브로드캐스트 대신 행렬곱으로 만든다."""
    xu = coords[u_rows].astype(np.float64)
    xv = coords[v_rows].astype(np.float64)
    d2 = (xu ** 2).sum(1)[:, None] + (xv ** 2).sum(1)[None, :] - 2.0 * (xu @ xv.T)
    return np.sqrt(np.maximum(d2, 0.0))


def _viterbi(coords, layers, row_a, row_b, node_penalty, tau_dup):
    """층을 지나는 최소비용 경로. 비용 = Σ 걸음² + Σ 노드벌점. 없으면 None."""
    prev_rows = np.array([row_a], dtype=np.int64)
    prev_cost = np.array([0.0])
    back = []
    for layer in list(layers) + [np.array([row_b], dtype=np.int64)]:
        step = _pair_dist(coords, prev_rows, layer)
        # 거리 tau_dup 미만은 같은 녹음 수준이라 전이로 쓰지 않는다.
        cost = np.where(step >= tau_dup,
                        prev_cost[:, None] + step ** 2 + node_penalty[layer][None, :],
                        np.inf)
        arg = cost.argmin(0)
        best = cost[arg, np.arange(len(layer))]
        if not np.isfinite(best).any():
            return None
        back.append(arg)
        prev_rows, prev_cost = layer, best

    path = [row_b]
    j = 0
    for k in range(len(back) - 1, -1, -1):
        j = int(back[k][j])
        path.append(int((np.array([row_a]) if k == 0 else layers[k - 1])[j]))
    return path[::-1]


# --------------------------------------------------------------------------
# 모드
# --------------------------------------------------------------------------
def _station_count(endpoint_dist, rules, n=None):
    """D3: 먼 여정이면 역을 늘린다."""
    if n is not None:
        return int(n)
    tau_far_pair = 10.7                       # 정답쌍 median (D3)
    if endpoint_dist <= tau_far_pair:
        return 10
    return int(np.clip(round(10 + (endpoint_dist - tau_far_pair)), 10, 20))


def _passable(bundle, meta, row_a, row_b):
    """여정 후보가 될 수 있는 곡. serve_mask 에 A·B 와 같은 녹음 제외를 더한다."""
    ok = bundle.serve_mask.copy()
    for row in (row_a, row_b):
        ok &= meta.canonical != meta.canonical[row]
    ok[row_a] = False
    ok[row_b] = False
    return ok


def _solve_corridor(bundle, p, r, n_stations, passable, row_a, row_b, penalty, tau_dup):
    """통로를 넓혀가며 경로를 찾는다. 단계마다 제약을 하나씩 푼다.

    1) 반경 4.0 → 6.0. 층이 MIN_LAYER 이상 차야 푼다.
    2) 그래도 안 되면 층 두께 조건을 버리고 반경을 넓힌다. 얇은 층이라도 하나만 있으면 된다.
    D3 이 "먼 곡도 항상 잇는다" 이므로 여기서 포기하면 안 된다.
    """
    for require_thick in (True, False):
        radius = RADIUS_START
        while radius <= RADIUS_MAX_RELAXED:
            layers = _corridor_layers(p, r, n_stations, radius, passable)
            if layers is not None:
                thick = min(len(x) for x in layers) >= MIN_LAYER
                if thick or not require_thick:
                    path = _viterbi(bundle.coords, layers, row_a, row_b, penalty, tau_dup)
                    if path is not None:
                        return path
            radius += RADIUS_STEP
            if require_thick and radius > RADIUS_MAX:
                break
    return None


def journey_axis(bundle, row_a, row_b, n=None, meta=None):
    """축 통로 + Viterbi. 기본 모드."""
    meta = meta or postprocess.meta_from_bundle(bundle)
    rules = bundle.rules
    tau_dup = rules["tau_dup"]["value"]
    p, r, endpoint_dist = axis_frame(bundle, row_a, row_b)
    n_stations = _station_count(endpoint_dist, rules, n)
    passable = _passable(bundle, meta, row_a, row_b)
    penalty = LAMBDA_OFF_AXIS * (r.astype(np.float64) ** 2)

    # 규칙 위반은 두 방식으로 고친다.
    #   같은 canonical  → 그 행만 막는다. 특정 녹음이라 행 단위가 맞다.
    #   아티스트 상한   → 그 아티스트 전체에 벌점을 더한다. 행 하나를 막아도 DP 가
    #                     같은 아티스트의 다른 곡을 집어서 수렴하지 않는다(실측).
    #                     벌점은 유한해서 그 아티스트뿐인 통로도 막히지 않는다.
    banned = np.zeros(bundle.n, dtype=bool)
    artist_penalty = np.zeros(bundle.n, dtype=np.float64)
    path = None
    for _ in range(MAX_REPAIR):
        path = _solve_corridor(bundle, p, r, n_stations, passable & ~banned,
                               row_a, row_b, penalty + artist_penalty, tau_dup)
        if path is None:
            return None, endpoint_dist, n_stations

        dup_row, over_artists = _rule_violation(path[1:-1], meta, rules)
        if dup_row is None and not over_artists:
            return path, endpoint_dist, n_stations
        if dup_row is not None:
            banned[dup_row] = True
        for artist in over_artists:
            artist_penalty[meta.artist == artist] += ARTIST_PENALTY
    return path, endpoint_dist, n_stations


def journey_linear(bundle, row_a, row_b, n=None, meta=None):
    """16차원 직선을 등분한 지점마다 최근접 미사용 곡. 이식 검증용(AC3)."""
    meta = meta or postprocess.meta_from_bundle(bundle)
    coords = bundle.coords
    a, b = coords[row_a].astype(np.float64), coords[row_b].astype(np.float64)
    endpoint_dist = float(np.linalg.norm(b - a))
    n_stations = _station_count(endpoint_dist, bundle.rules, n)
    passable = _passable(bundle, meta, row_a, row_b)

    used = np.zeros(bundle.n, dtype=bool)
    stations = []
    for k in range(1, n_stations + 1):
        t = k / (n_stations + 1.0)
        point = (a + t * (b - a)).astype(np.float32)
        idx, _ = nearest_to_point(bundle, point, k=1, candidate_mask=passable & ~used)
        if idx.size == 0:
            return None, endpoint_dist, n_stations
        row = int(idx[0])
        stations.append(row)
        used[row] = True
        # 같은 아티스트·같은 녹음이 다시 뽑히지 않게 막는다
        used |= meta.canonical == meta.canonical[row]
    return [row_a] + stations + [row_b], endpoint_dist, n_stations


def _rule_violation(station_rows, meta, rules):
    """(중복 canonical 행 하나 또는 None, 상한을 넘은 아티스트 목록)."""
    cap = rules["artist_cap"]["value"]
    seen_canonical, artist_count, dup_row = set(), {}, None
    for row in station_rows:
        canonical = int(meta.canonical[row])
        if canonical in seen_canonical and dup_row is None:
            dup_row = row
        seen_canonical.add(canonical)
        artist = int(meta.artist[row])
        if artist != postprocess.NULL:
            artist_count[artist] = artist_count.get(artist, 0) + 1
    over = [a for a, c in artist_count.items() if c > cap]
    return dup_row, over


MODES = {"axis": journey_axis, "linear": journey_linear}
DEFAULT_MODE = "axis"        # D10. D2 의 linear 기본을 대체한다.


def journey(bundle, row_a, row_b, n=None, mode=DEFAULT_MODE, meta=None):
    """여정 하나. 응답용 dict.

    mode 는 "axis"(기본) 또는 "linear".
    """
    if mode not in MODES:
        raise ValueError("mode 는 {} 중 하나".format(sorted(MODES)))
    meta = meta or postprocess.meta_from_bundle(bundle)
    path, endpoint_dist, n_stations = MODES[mode](bundle, row_a, row_b, n=n, meta=meta)
    if path is None:
        return {"mode": mode, "endpoint_dist": endpoint_dist, "far": None,
                "n_stations": n_stations, "stations": [], "reachable": False}

    coords = bundle.coords
    p, _, _ = axis_frame(bundle, row_a, row_b)
    stations = []
    for rank, row in enumerate(path[1:-1], start=1):
        stations.append({
            "rank": rank,
            "row": int(row),
            "dist_from_prev": float(np.linalg.norm(coords[row] - coords[path[rank - 1]])),
            "progress": float(p[row]),
        })
    return {
        "mode": mode,
        "endpoint_dist": float(endpoint_dist),
        "far": bool(endpoint_dist > 10.7),
        "n_stations": n_stations,
        "stations": stations,
        "last_to_end": float(np.linalg.norm(coords[path[-1]] - coords[path[-2]])),
        "reachable": True,
    }
