# -*- coding: utf-8 -*-
"""지도 레이어 인덱스·대표 트랙 검증 (스펙 16, Jira S15P21A405-210).

    coords_v2.parquet  →  칸(2.0) 격자  →  칸마다 대표곡

DB 없이 도는 검사다. 실제 DB 대조 기록은 `output/map_layer_bench_2026-09-11.json` 에 있다.

⚠️ **2026-09-18 D20 (S15P21A405-466) 으로 칸별 선정 규칙이 바뀌었다.**

    옛 규칙: 칸마다 중심 최근접 1개, 동률이면 작은 id          → 1,094칸 = 1,094곡
    새 규칙: 칸마다 k = min(round(cbrt(재생가능 곡수)), kmax) 개,
             칸 안에서는 md5(id::text) 무작위, 후보는 NOT is_unplayable

`ingest/map_grid.py` 는 **옛 규칙의 numpy 거울**이라 이제 SQL 과 일치하지 않는다.
아래 "옛 규칙" 절의 검사들은 그 거울을 그대로 검증하며, 롤백 자산으로 남긴다
(헌법: 지우지 않고 보존). 새 규칙의 DB 대조는 `tests/fixtures/map_sample_density.sql` 로 한다 —
실제 postgres 가 필요해 이 파일에서는 SQL 본문 규칙만 확인한다.
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
# ⚠️ 위 1,094 는 2026-09-11 기록이고 현재값이 아니다. map_sample 이 그 뒤 재생성돼
#    2026-09-18 운영 실집계는 850칸이다. 이 상수는 같은 시점의 coords_v2.parquet 와
#    대조하는 test_grid_over_real_coords_matches_db 전용이라 그대로 둔다.
LIVE_CELLS_2026_09_18 = 850  # 운영 실집계. 밀도 가중 후 약 7,272곡을 담는다

BENCH = os.path.join(ROOT, "output", "map_layer_bench_2026-09-11.json")
SQL_FILE = os.path.join(ROOT, "ingest", "build_map_layer.sql")
FIXTURE_FILE = os.path.join(ROOT, "tests", "fixtures", "map_sample_density.sql")


def sql_body():
    """SQL 본문만. `-- ` 주석 줄은 걷어낸다.

    "이건 쓰지 않는다" 를 설명하는 주석이 그 자체로 검사에 걸리기 때문이다.
    실제로 `DO $$ 를 쓰지 않는다` 주석이 `"DO $$" not in sql` 을 깨뜨렸다.
    """
    text = io.open(SQL_FILE, encoding="utf-8").read()
    return "\n".join(line for line in text.splitlines()
                     if not line.lstrip().startswith("--"))


# --- 옛 규칙 (D20 이전) — map_grid.py 거울. 롤백 자산으로 보존 -----------------

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


def test_sql_selects_density_weighted_k_per_cell():
    """칸당 k = min(round(cbrt(n)), kmax). 칸당 1곡으로 돌아가지 않았는지 지킨다 (D20)."""
    sql = sql_body()
    assert "least(round(cbrt(count(*)))::int, :kmax) AS k" in sql
    assert "WHERE r.rn <= q.k" in sql
    assert r"\set kmax 40" in sql, "기본 상한이 있어야 인자 없이도 돈다"
    assert "DISTINCT ON (gx, gy)" not in sql, "옛 칸당 1곡 규칙이 되살아나면 안 된다"


def test_sql_picks_randomly_within_cell():
    """칸 안은 md5 무작위다. 중심 최근접이면 점이 칸 한복판에 박혀 바둑판이 보인다 (D20).

    md5 라서 재실행해도 같은 곡이 뽑힌다 — 재현 가능해야 한다는 AC 를 이게 만족시킨다.
    """
    sql = sql_body()
    assert "ORDER BY md5(c.id::text)" in sql
    assert "row_number() OVER (PARTITION BY c.gx, c.gy" in sql
    # 옛 규칙의 거리식이 남아 선정에 다시 쓰이면 안 된다.
    assert "^ 2 + (pc2" not in sql, "칸 중심 최근접 정렬이 되살아나면 안 된다"


def test_sql_limits_candidates_to_playable():
    """후보는 재생 가능한 곡뿐이다. 판정 정본은 is_unplayable 이다 (S15P21A405-454)."""
    sql = sql_body()
    assert "WHERE NOT is_unplayable" in sql
    assert "IS DISTINCT FROM 'none'" not in sql, "video_id 표시값은 옛 판정이다"


def test_sql_primary_key_holds_many_rows_per_cell():
    """PK 가 (layer,gx,gy) 면 칸당 1행이 강제돼 밀도 가중을 담을 수 없다.

    제약 이름을 추측하지 않는다 — 운영 PK 이름은 테이블명과 다른 map_sample_v2_pkey 다.
    그리고 psql 은 달러 인용 블록 안에서 :변수를 치환하지 않으므로 DO $$ 를 쓰면 안 된다.
    """
    sql = sql_body()
    assert "PRIMARY KEY (layer, gx, gy, music_id)" in sql
    assert "PRIMARY KEY (layer, gx, gy)\n" not in sql
    assert "FROM pg_constraint" in sql, "제약 이름은 찾아서 쓴다"
    assert r"\gexec" in sql
    assert "DO $$" not in sql, "psql 변수가 치환되지 않아 실패한다"


def test_sql_analyzes_before_build():
    """is_unplayable 통계가 없으면 플래너가 후보를 절반으로 보고 정렬을 잘못 잡는다."""
    sql = sql_body()
    assert 'ANALYZE :"music_tbl";' in sql


def test_density_fixture_documents_expected_counts():
    """DB 대조 픽스처가 있어야 칸별 k 를 실제로 확인할 수 있다.

    이 검사는 픽스처가 사라지거나 기대값이 지워지는 것만 막는다.
    실제 실행은 픽스처 헤더의 docker 절차대로 한다(파이썬에서 DB 를 띄우지 않는다).
    """
    assert os.path.exists(FIXTURE_FILE), "tests/fixtures/map_sample_density.sql 이 있어야 한다"
    fx = io.open(FIXTURE_FILE, encoding="utf-8").read()
    # 운영과 같은 함정 셋을 심어야 검증에 의미가 있다.
    assert "map_sample_v2_pkey" in fx, "어긋난 PK 이름"
    assert "999999999" in fx, "music 에 없는 고아 행"
    assert "seed_cell(7,   10,  10)" in fx, "전부 재생 불가인 칸"
    # 기대값이 적혀 있어야 리뷰어가 대조할 수 있다.
    assert "INSERT 0 40" in fx
    assert "INSERT 0 14" in fx, "kmax=3 클리핑 기대값"


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
