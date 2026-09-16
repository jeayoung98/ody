# -*- coding: utf-8 -*-
"""지도 레이어 인덱스·대표 트랙 검증 (스펙 16, Jira S15P21A405-210).

    coords_v2.parquet  →  칸(2.0) 격자  →  칸마다 중심 최근접 1개  →  1,094개

운영 DB 에 만든 `map_sample` 과 **같은 규칙**을 numpy 로 다시 계산해 대조한다.
DB 없이 도는 검사다. 실제 DB 대조 기록은 `output/map_layer_bench_2026-09-11.json` 에 있다.
"""
import io
import json
import os
import sys

import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "ingest"))

import map_grid  # noqa: E402

SAMPLE_CELLS = 1094          # 2026-09-11 실측. 셀 2.0, 662만 곡
BENCH = os.path.join(ROOT, "output", "map_layer_bench_2026-09-11.json")
SQL_FILE = os.path.join(ROOT, "ingest", "build_map_layer.sql")


# --- 규칙 --------------------------------------------------------------------

def test_layer_pairs_cover_16_dims():
    """레이어 8개가 16차원을 두 개씩 나눠 쓴다."""
    assert map_grid.layer_columns(1) == (1, 2)
    assert map_grid.layer_columns(2) == (3, 4)
    assert map_grid.layer_columns(8) == (15, 16)
    flat = [c for pair in map_grid.LAYER_PAIRS for c in pair]
    assert flat == list(range(1, 17))
    with pytest.raises(ValueError):
        map_grid.layer_columns(9)


def test_cell_of_matches_sql_floor():
    """칸 번호는 floor(x / cell). 음수도 내림이다(SQL floor 와 같다)."""
    assert list(map_grid.cell_of([0.0, 1.9, 2.0, -0.1, -2.0, -2.1])) == [0, 0, 1, -1, -1, -2]
    assert list(map_grid.cell_center([0, 1, -1])) == [1.0, 3.0, -1.0]


def test_representative_is_nearest_to_cell_center():
    """칸 안에서 중심에 가장 가까운 것이 대표다."""
    x = np.array([0.1, 1.0, 1.9])       # 전부 칸 0 (중심 1.0)
    y = np.array([1.0, 1.0, 1.0])
    gx, gy, ids, rx, ry = map_grid.representatives(x, y, np.array([10, 20, 30]))
    assert list(ids) == [20], "중심(1.0, 1.0)에 정확히 놓인 것"
    assert list(gx) == [0] and list(gy) == [0]
    assert (rx[0], ry[0]) == (1.0, 1.0)


def test_ties_break_by_smaller_id():
    """거리가 같으면 id 가 작은 쪽. SQL 의 ORDER BY ..., id 와 같다."""
    x = np.array([0.5, 1.5])            # 중심 1.0 에서 같은 거리
    y = np.array([1.0, 1.0])
    _gx, _gy, ids, _rx, _ry = map_grid.representatives(x, y, np.array([77, 42]))
    assert list(ids) == [42]


def test_one_representative_per_cell():
    rng = np.random.default_rng(5)
    x = rng.normal(0, 20, 5000)
    y = rng.normal(0, 20, 5000)
    ids = np.arange(1, 5001)
    gx, gy, picked, _rx, _ry = map_grid.representatives(x, y, ids)
    cells = list(zip(gx.tolist(), gy.tolist()))
    assert len(cells) == len(set(cells)), "칸마다 하나뿐이어야 한다"
    assert len(set(picked.tolist())) == len(picked)


# --- SQL 과 규칙이 어긋나지 않게 --------------------------------------------

def test_cell_bounds_derive_from_index():
    """칸 경계는 저장하지 않고 gx·gy 로 계산한다. 대표를 누르면 이 범위가 다음 레이어 필터다."""
    cell = map_grid.CELL
    for gx in (-13, 0, 44):
        x1, x2 = gx * cell, gx * cell + cell
        assert map_grid.cell_center(gx) == (x1 + x2) / 2
        assert list(map_grid.cell_of([x1, x2 - 1e-6])) == [gx, gx]
        assert list(map_grid.cell_of([x2])) == [gx + 1], "위 경계는 다음 칸에 속한다"


def test_sql_fills_cell_counts():
    """칸별 곡 수를 채워야 FE 가 점 크기와 LIMIT 을 판단한다."""
    sql = io.open(SQL_FILE, encoding="utf-8").read()
    assert "cnt      integer" in sql
    assert 'UPDATE :"sample_tbl" s SET cnt = c.n' in sql


def test_sql_uses_same_cell_size():
    """SQL 의 셀 크기와 파이썬 상수가 같아야 대조가 성립한다."""
    sql = io.open(SQL_FILE, encoding="utf-8").read()
    assert "/ 2.0)::smallint AS gx" in sql
    assert map_grid.CELL == 2.0
    assert "gx * 2.0 + 1.0" in sql, "중심 = gx * cell + cell/2"


def test_sql_is_idempotent_and_grants_read_role():
    """두 번 돌려도 같아야 한다. 읽기 전용 롤에도 권한을 준다."""
    sql = io.open(SQL_FILE, encoding="utf-8").read()
    # 테이블·인덱스 이름은 psql 변수다(S15P21A405-381). 기본값은 music·map_sample·music_l*_gist 이고
    # 재적재본은 -v music_tbl=music_v2 -v sample_tbl=map_sample_v2 로 준다.
    assert 'CREATE INDEX IF NOT EXISTS :"l1_idx" ON :"music_tbl"' in sql
    assert 'CREATE INDEX IF NOT EXISTS :"l2_idx" ON :"music_tbl"' in sql
    assert 'CREATE TABLE IF NOT EXISTS :"sample_tbl"' in sql
    assert 'DELETE FROM :"sample_tbl" WHERE layer = 1;' in sql, "재적재 전에 지운다"
    assert 'GRANT SELECT ON :"sample_tbl" TO ody_read;' in sql
    for name, default in (("music_tbl", "music"), ("sample_tbl", "map_sample"),
                          ("l1_idx", "music_l1_gist"), ("l2_idx", "music_l2_gist")):
        assert r"\set {} {}".format(name, default) in sql, "변수 기본값이 있어야 기존 절차가 그대로 돈다"
    assert "max_parallel_maintenance_workers = 0" in sql, "컨테이너 /dev/shm 64MB 제약"


# --- 실제 좌표 ---------------------------------------------------------------

def test_grid_over_real_coords_matches_db(bundle_dir):
    """실제 좌표로 격자를 다시 계산해 DB 가 만든 셀 수와 같은지 본다.

    id 는 mbid 오름차순 1..N 이다(D13). 그래야 DB 의 music.id 와 맞는다.
    """
    import pyarrow.compute as pc
    import pyarrow.parquet as pq

    table = pq.read_table(os.path.join(bundle_dir, "coords_v2.parquet"),
                          columns=["mbid", "pc1", "pc2"])
    table = table.take(pc.sort_indices(table, sort_keys=[("mbid", "ascending")]))
    x = table.column("pc1").to_numpy(zero_copy_only=False)
    y = table.column("pc2").to_numpy(zero_copy_only=False)
    ids = np.arange(1, table.num_rows + 1)
    del table

    gx, gy, picked, _rx, _ry = map_grid.representatives(x, y, ids)
    assert len(picked) == SAMPLE_CELLS
    assert len(set(zip(gx.tolist(), gy.tolist()))) == SAMPLE_CELLS
    assert picked.min() >= 1 and picked.max() <= len(ids)


def test_bench_records_measurements():
    """측정값이 output 에 남아 있어야 한다(AC)."""
    if not os.path.exists(BENCH):
        pytest.skip("측정 기록 없음")
    bench = json.load(io.open(BENCH, encoding="utf-8"))
    latency = bench["latency_ms"]
    assert latency["layer1_first_screen"] < 1.0
    assert latency["layer2_1000"] < 200
    assert latency["layer3_1000_heap_filter"] < 200
    assert latency["plane_knn_20"] < 1.0
    assert latency["hnsw_knn_10"] < 50
    assert latency["layer3_1000_bitmap_and"] > latency["layer3_1000_heap_filter"], \
        "인덱스를 둘 다 쓰면 오히려 느리다는 기록"
    assert bench["map_sample"]["rows"] == SAMPLE_CELLS
    assert bench["map_sample"]["parity_with_local_grid"] is True
