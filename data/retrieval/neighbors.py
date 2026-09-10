# -*- coding: utf-8 -*-
"""이웃 검색 (spec 10 T3).

두 경로가 있다.
  graph  사전 계산 kNN 그래프(k=30) 조회 → 후처리. O(1) 에 가깝다.
  exact  전곡 블록 행렬곱으로 정확 kNN. 그래프가 없거나 후처리 후 개수가 모자랄 때 폴백.

그래프 recall@30 은 0.912 로 사전 측정됐고 목표 0.95 에 미달한다(`work/knn_graph/meta.json`).
그래서 결과가 모자라면 반드시 exact 로 보정한다. 미달 사실은 규칙 1에 따라 지우지 않고 기록만 한다.
"""
import numpy as np

from . import postprocess

BLOCK = 250_000          # 블록 행렬곱 단위. 250k × 16 float32 = 16MB 작업 버퍼.
EXACT_K = 100            # 폴백에서 뽑는 후보 수. 후처리로 걸러도 10개가 남도록 넉넉히.


def exact_knn(bundle, query_row, k=EXACT_K, candidate_mask=None):
    """전곡 대상 정확 kNN. (이웃 행 인덱스, 거리) 를 거리 오름차순으로 돌려준다.

    ||q - x||^2 = ||x||^2 - 2 q·x + ||q||^2 에서 상수항을 빼고 비교한다.
    """
    coords = bundle.coords
    q = coords[query_row]
    n = coords.shape[0]
    k = min(k, n - 1)

    best_idx = np.empty(0, dtype=np.int64)
    best_val = np.empty(0, dtype=np.float32)

    for start in range(0, n, BLOCK):
        stop = min(start + BLOCK, n)
        block = coords[start:stop]
        # 부분 제곱거리(상수 ||q||^2 생략) — 순서에는 영향이 없다.
        partial = np.einsum("ij,ij->i", block, block) - 2.0 * (block @ q)
        if candidate_mask is not None:
            partial = np.where(candidate_mask[start:stop], partial, np.inf)
        take = min(k, stop - start)
        local = np.argpartition(partial, take - 1)[:take]
        best_idx = np.concatenate([best_idx, local + start])
        best_val = np.concatenate([best_val, partial[local]])
        if len(best_idx) > 4 * k:                      # 누적분 정리
            keep = np.argpartition(best_val, k - 1)[:k]
            best_idx, best_val = best_idx[keep], best_val[keep]

    order = np.argsort(best_val, kind="stable")[:k]
    idx = best_idx[order]
    # 실제 유클리드 거리로 환산해서 돌려준다(규칙 임계값이 거리 단위라서).
    dist = np.linalg.norm(coords[idx] - q, axis=1)
    return idx, dist


def graph_knn(bundle, query_row):
    """사전 계산 그래프에서 후보를 읽는다. 그래프가 없으면 None."""
    if not bundle.has_graph:
        return None, None
    idx = np.asarray(bundle.graph_indices[query_row], dtype=np.int64)
    idx = idx[(idx >= 0) & (idx < bundle.n)]
    if idx.size == 0:
        return None, None
    dist = np.linalg.norm(bundle.coords[idx] - bundle.coords[query_row], axis=1)
    order = np.argsort(dist, kind="stable")
    return idx[order], dist[order]


def neighbors(bundle, query_row, k=10, meta=None, include_excluded=False):
    """후처리까지 끝낸 이웃 k 개.

    반환: dict(rows, dists, source, low_similarity)
      source 는 "graph" 또는 "exact". 그래프로 k 개를 못 채우면 exact 로 다시 뽑는다.
    """
    meta = meta or postprocess.meta_from_bundle(bundle)
    mask = None if include_excluded else bundle.serve_mask

    source = "graph"
    idx, dist = graph_knn(bundle, query_row)
    kept = []
    if idx is not None:
        if mask is not None:
            keep = mask[idx]
            idx, dist = idx[keep], dist[keep]
        if idx.size:
            kept = postprocess.apply_rules(idx, dist, query_row, meta, bundle.rules, top_n=k)

    if len(kept) < k:
        source = "exact"
        idx, dist = exact_knn(bundle, query_row, k=EXACT_K, candidate_mask=mask)
        kept = postprocess.apply_rules(idx, dist, query_row, meta, bundle.rules, top_n=k)

    # 최종 거리는 쿼리와의 실제 거리로 다시 계산한다(그래프 경로도 동일 기준).
    rows = np.asarray(kept, dtype=np.int64)
    dists = (np.linalg.norm(bundle.coords[rows] - bundle.coords[query_row], axis=1)
             if rows.size else np.empty(0, dtype=np.float32))
    return {
        "rows": rows,
        "dists": dists,
        "source": source,
        "low_similarity": postprocess.low_similarity(dists[-1], bundle.rules) if rows.size else True,
    }
