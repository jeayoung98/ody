# -*- coding: utf-8 -*-
"""S4 트리 배정 패리티 (spec 20, Jira S15P21A405-131).

    16차원 좌표  →  root 에서 깊이 6까지  →  leaf_id (말단 노드 4,096개)

핵심 검사는 **실제 좌표를 배정한 말단 노드가 `map_tree/node_paths_v2.parquet` 과 같은가** 다.
스펙 20 S4 의 패리티 기준이 말단 노드 일치 100% 이고, 그 수치를 여기서 만든다.
번들 대용량이 없는 머신에서는 skip 한다.
"""
import io
import json
import os
import sys

import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "spark", "jobs"))

import tree_assign as S4  # noqa: E402

N_LEAVES = 4096
MAX_DEPTH = 6
SAMPLE_ROWS = 5000


@pytest.fixture(scope="module")
def tree(bundle_dir):
    if not os.path.exists(os.path.join(bundle_dir, "map_tree", "split_axes.npz")):
        pytest.skip("map_tree/split_axes.npz 없음")
    return S4.load_tree(bundle_dir)


def test_tree_shape(tree, bundle_dir):
    """말단 노드 4,096개, 깊이 6. 내부 노드마다 축·중앙값·평균이 있어야 한다."""
    assert tree["n_leaves"] == N_LEAVES == len(tree["leaves"])
    assert tree["max_depth"] == MAX_DEPTH
    assert S4.ROOT_NODE in tree["splits"]
    for node, (axes, median, mean) in tree["splits"].items():
        assert axes.shape == (2, 16), node
        assert median.shape == (2,) and mean.shape == (16,), node


def test_split_count_matches_tree_json(tree, bundle_dir):
    """축이 있는 노드 집합이 tree.json 의 내부 노드 집합과 같아야 한다."""
    nodes = json.load(io.open(os.path.join(bundle_dir, "map_tree", "tree.json"),
                              encoding="utf-8"))["nodes"]
    internal = {nid for nid, node in nodes.items() if not node.get("leaf")}
    assert set(tree["splits"]) == internal


def test_job_does_not_refit():
    """트리 재학습 금지(규칙 3)."""
    source = io.open(os.path.join(ROOT, "spark", "jobs", "tree_assign.py"), encoding="utf-8").read()
    body = source.split('"""', 2)[2]
    assert ".fit(" not in body
    assert "eigh" not in body, "고유분해가 있으면 트리를 다시 학습하는 코드다"


def test_quadrant_uses_greater_or_equal():
    """경계에 정확히 놓인 점은 >= 쪽으로 간다. 원본이 >= 라서 그렇다.

    실제 번들 축으로는 경계 점을 float 오차 없이 만들 수 없다(축이 float32 이고 완전히
    직교하지도 않다). 그래서 부등호 의미만 단위 축으로 확인하고, 실제 데이터 검증은
    아래 node_paths 대조가 한다.
    """
    axes = np.zeros((2, 16))
    axes[0, 0] = 1.0
    axes[1, 1] = 1.0
    median = np.zeros(2)
    mean = np.zeros(16)

    def q(pc1, pc2):
        x = np.zeros((1, 16))
        x[0, 0], x[0, 1] = pc1, pc2
        return int(S4.quadrant(x, axes, median, mean)[0])

    assert q(0.0, 0.0) == 3, "경계는 두 축 모두 >= 쪽"
    assert q(-1.0, -1.0) == 0
    assert q(1.0, -1.0) == 2, "첫 축이 >= 면 2를 더한다"
    assert q(-1.0, 1.0) == 1


def test_path_columns_take_two_and_three_segments():
    d1, d2 = S4.path_columns(["root.2.3.0.3.1.2"])
    assert d1 == ["root.2"] and d2 == ["root.2.3"]


def test_assign_stays_inside_tree(tree):
    """무작위 좌표도 트리 안의 말단 노드로 떨어진다."""
    rng = np.random.default_rng(1)
    X = rng.normal(0.0, 20.0, size=(200, 16))
    leaves = S4.assign(X, tree)
    assert len(leaves) == 200
    assert all(leaf in tree["leaves"] for leaf in leaves)
    assert all(len(str(leaf).split(".")) <= MAX_DEPTH + 1 for leaf in leaves)


def test_assign_matches_node_paths(tree, bundle_dir):
    """실제 좌표 표본의 말단 노드가 기준과 100% 같아야 한다(스펙 20 S4).

    2026-09-10 실측: 표본 5,000곡 전부 일치.
    """
    import pyarrow.parquet as pq

    coords_file = pq.ParquetFile(os.path.join(bundle_dir, "coords_v2.parquet"))
    table = coords_file.read_row_group(0, columns=["mbid"] + S4.PC_COLUMNS)
    rng = np.random.default_rng(13)
    table = table.take(rng.choice(table.num_rows, min(SAMPLE_ROWS, table.num_rows), replace=False))
    X = np.column_stack([table.column(pc).to_numpy(zero_copy_only=False) for pc in S4.PC_COLUMNS])
    mbids = [m.lower() for m in table.column("mbid").to_pylist()]
    del table

    assigned = S4.assign(X, tree)
    assert all(leaf in tree["leaves"] for leaf in assigned)

    wanted = set(mbids)
    truth = {}
    paths = pq.ParquetFile(os.path.join(bundle_dir, "map_tree", "node_paths_v2.parquet"))
    for rg in range(paths.metadata.num_row_groups):
        chunk = paths.read_row_group(rg, columns=["mbid", "leaf_id"])
        for mbid, leaf in zip(chunk.column("mbid").to_pylist(), chunk.column("leaf_id").to_pylist()):
            mbid = mbid.lower()
            if mbid in wanted:
                truth[mbid] = leaf

    checked = [(mbids[i], assigned[i], truth[mbids[i]]) for i in range(len(mbids))
               if mbids[i] in truth]
    assert len(checked) > SAMPLE_ROWS * 0.9, "대조된 곡이 {}개뿐이다".format(len(checked))
    mismatched = [row for row in checked if row[1] != row[2]]
    assert not mismatched, "말단 노드 불일치 {}건: {}".format(len(mismatched), mismatched[:3])
