# -*- coding: utf-8 -*-
"""격자 대표 트랙 선정 규칙 (스펙 16, Jira S15P21A405-210).

    좌표 662만 개  →  칸(2.0) 나누기  →  칸마다 중심에 가장 가까운 1개  →  1,094개

`ingest/build_map_layer.sql` 의 `DISTINCT ON` 과 **같은 규칙**을 numpy 로 쓴 것이다.
SQL 이 만든 `map_sample` 을 이걸로 대조한다(`tests/test_map_layer.py`).

## 규칙
    gx = floor(x / cell)                    칸 번호. 음수도 그대로 내림
    gy = floor(y / cell)
    중심 = (gx * cell + cell/2, gy * cell + cell/2)
    대표 = 그 칸에서 중심과의 거리가 가장 작은 트랙. 동률이면 id 가 작은 쪽

점수(제출본 수 등) 순으로 뽑으면 칸 안에서 한쪽에 뭉친다. 지도용으로는 중심 기준이 낫다.
"""
import numpy as np

CELL = 2.0          # build_map_layer.sql 과 같아야 한다
LAYER_PAIRS = [(1, 2), (3, 4), (5, 6), (7, 8), (9, 10), (11, 12), (13, 14), (15, 16)]


def layer_columns(layer):
    """레이어 번호(1..8) → 좌표 쌍의 1-based 성분 번호. 1레이어는 (1, 2)."""
    if not 1 <= layer <= len(LAYER_PAIRS):
        raise ValueError("레이어는 1..{} 다: {}".format(len(LAYER_PAIRS), layer))
    return LAYER_PAIRS[layer - 1]


def cell_of(values, cell=CELL):
    """좌표 → 칸 번호. SQL 의 floor(x / cell) 과 같다."""
    return np.floor(np.asarray(values, dtype=np.float64) / cell).astype(np.int64)


def cell_center(index, cell=CELL):
    """칸 번호 → 칸 중심 좌표."""
    return np.asarray(index, dtype=np.float64) * cell + cell / 2.0


def representatives(x, y, ids, cell=CELL):
    """칸마다 중심에 가장 가까운 하나. 반환은 (gx, gy, id, x, y) 배열 다섯 개.

    동률은 id 가 작은 쪽. SQL 의 `ORDER BY ..., id` 와 같다.
    """
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    ids = np.asarray(ids)
    gx, gy = cell_of(x, cell), cell_of(y, cell)
    distance = (x - cell_center(gx, cell)) ** 2 + (y - cell_center(gy, cell)) ** 2

    # 칸을 하나의 정수 키로 접는다. gy 범위보다 큰 자릿수를 곱한다.
    span = int(gy.max() - gy.min()) + 1
    key = (gx - gx.min()) * (span + 1) + (gy - gy.min())
    order = np.lexsort((ids, distance, key))       # 칸 → 거리 → id
    first = np.ones(len(order), dtype=bool)
    first[1:] = key[order][1:] != key[order][:-1]
    picked = order[first]
    return gx[picked], gy[picked], ids[picked], x[picked], y[picked]
