# -*- coding: utf-8 -*-
"""S4 트리 배정 (spec 20, Jira S15P21A405-131).

    16차원 좌표  →  root 에서 깊이 6까지 한 칸씩  →  leaf_id (말단 노드 4,096개)

트리는 이미 학습된 산물이다(`map_tree/tree.json`, `split_axes.npz`, 2026-09-03 사용자 승인).
이 잡은 다시 학습하지 않고 노드별 값을 적용한다(규칙 3).

## 배정 산식 (원본 `scripts/v2_build_map_tree.py` 와 같아야 한다)

    각 내부 노드에서
      1. proj = (x - mean_<id>) @ axes_<id>.T          2차원으로 내린다
      2. q = (proj0 >= med0) * 2 + (proj1 >= med1)     사분면 0~3
      3. 다음 노드는 "<id>.<q>"

같은 값일 때는 `>=` 로 가른다. 원본이 `>=` 라서 그렇다. 이 부등호가 뒤집히면 경계에 놓인
곡의 말단 노드가 달라진다.

## 한 행씩 내려가지 않는다
깊이 한 단계마다 **같은 노드에 속한 행을 모아 한 번에** 행렬곱을 한다. 깊이가 6 이므로
배치당 최대 6번의 그룹 연산으로 끝난다. 행마다 트리를 타면 6.6M × 6 번의 파이썬 루프가 된다.

## 번들을 클러스터로 보내는 방법
`--bundle` 로 `map_tree` 가 들어 있는 디렉터리를 준다. `spark-submit --files` 로
`tree.json` 과 `split_axes.npz` 를 올릴 때는 `--tree-json`, `--split-axes` 로 직접 지정한다.
자세한 명령은 `spark/README.md`.
"""
import argparse
import io
import json
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PC_COLUMNS = ["pc{}".format(i) for i in range(1, 17)]
CARRY_COLUMNS = ["mbid"]
OUTPUT_COLUMNS = CARRY_COLUMNS + ["leaf_id", "node_d1", "node_d2"]
ROOT_NODE = "root"


def default_bundle_dir():
    """serving/CURRENT.json 이 가리키는 번들. ODY_SERVING_DIR 를 먼저 본다."""
    serving = os.environ.get("ODY_SERVING_DIR") or os.path.join(ROOT, "serving")
    with io.open(os.path.join(serving, "CURRENT.json"), encoding="utf-8") as fh:
        return os.path.join(serving, json.load(fh)["bundle"])


def load_tree(bundle_dir=None, tree_json=None, split_axes=None):
    """트리 구조와 노드별 축. 여기서 읽는 것 말고 이 잡에 파라미터는 없다.

    반환 dict: leaves(말단 노드 집합), splits({노드: (axes, median, mean)}), max_depth.
    """
    bundle_dir = bundle_dir or default_bundle_dir()
    tree_path = tree_json or os.path.join(bundle_dir, "map_tree", "tree.json")
    axes_path = split_axes or os.path.join(bundle_dir, "map_tree", "split_axes.npz")
    with io.open(tree_path, encoding="utf-8") as fh:
        tree = json.load(fh)
    npz = np.load(axes_path)
    splits = {}
    for key in npz.files:
        if not key.startswith("axes_"):
            continue
        node = key[len("axes_"):]
        splits[node] = (npz[key].astype(np.float64),
                        npz["median_" + node].astype(np.float64),
                        npz["mean_" + node].astype(np.float64))
    leaves = {nid for nid, node in tree["nodes"].items() if node.get("leaf")}
    if ROOT_NODE not in splits:
        raise ValueError("split_axes.npz 에 root 축이 없다")
    return {"leaves": leaves, "splits": splits, "max_depth": int(tree["max_depth"]),
            "n_leaves": int(tree["n_leaves"]), "dir": bundle_dir}


def quadrant(X, axes, median, mean):
    """(n, 16) → 사분면 0~3. 원본과 같은 `>=` 부등호를 쓴다."""
    proj = (np.asarray(X, dtype=np.float64) - mean) @ axes.T
    return ((proj[:, 0] >= median[0]).astype(np.int8) * 2
            + (proj[:, 1] >= median[1]).astype(np.int8))


def assign(X, tree):
    """(n, 16) → leaf_id 배열. 깊이 한 단계마다 같은 노드의 행을 모아 계산한다."""
    X = np.asarray(X, dtype=np.float64)
    current = np.array([ROOT_NODE] * len(X), dtype=object)
    for _depth in range(tree["max_depth"]):
        moving = np.array([node in tree["splits"] and node not in tree["leaves"]
                           for node in current])
        if not moving.any():
            break
        for node in set(current[moving]):
            rows = np.flatnonzero(moving & (current == node))
            axes, median, mean = tree["splits"][node]
            q = quadrant(X[rows], axes, median, mean)
            current[rows] = ["{}.{}".format(node, int(k)) for k in q]
    return current


def path_columns(leaf_ids):
    """leaf_id → (node_d1, node_d2). 서빙과 카탈로그가 쓰는 상위 두 단계 경로다."""
    d1, d2 = [], []
    for leaf in leaf_ids:
        parts = str(leaf).split(".")
        d1.append(".".join(parts[:2]))
        d2.append(".".join(parts[:3]))
    return d1, d2


# --------------------------------------------------------------------------
# Spark
# --------------------------------------------------------------------------
def output_schema():
    from pyspark.sql.types import StringType, StructField, StructType
    return StructType([StructField(name, StringType(), False) for name in OUTPUT_COLUMNS])


def assign_df(df, tree):
    """좌표 DataFrame → mbid + leaf_id + node_d1 + node_d2."""
    import pandas as pd

    schema = output_schema()

    def run(batches):
        for batch in batches:
            leaves = assign(batch[PC_COLUMNS].to_numpy(dtype=np.float64), tree)
            d1, d2 = path_columns(leaves)
            out = pd.DataFrame({"leaf_id": [str(x) for x in leaves], "node_d1": d1, "node_d2": d2},
                               index=batch.index)
            for name in CARRY_COLUMNS:
                out.insert(0, name, batch[name])
            yield out

    return df.select(*(list(CARRY_COLUMNS) + PC_COLUMNS)).mapInPandas(run, schema=schema)


def run(spark, input_path, output_path, bundle_dir=None, tree_json=None, split_axes=None):
    from pyspark.sql import functions as F
    tree = load_tree(bundle_dir, tree_json, split_axes)
    df = spark.read.parquet(input_path)
    out = assign_df(df, tree)
    out.write.mode("overwrite").parquet(output_path)
    written = spark.read.parquet(output_path)
    assigned_leaves = written.select("leaf_id").distinct().count()
    outside = written.filter(~F.col("leaf_id").isin(sorted(tree["leaves"]))).count()
    return {"stage": "S4", "input_path": input_path, "output_path": output_path,
            "input_rows": df.count(), "output_rows": written.count(),
            "leaves_in_tree": tree["n_leaves"], "leaves_used": assigned_leaves,
            "rows_outside_tree": outside, "bundle": tree["dir"],
            "refit": "없음 (동결 트리 적용만, 규칙 3)"}


def main():
    ap = argparse.ArgumentParser(description="S4 트리 배정")
    ap.add_argument("--in", dest="input_path", required=True, help="S3 좌표 parquet (hdfs:///...)")
    ap.add_argument("--out", dest="output_path", required=True)
    ap.add_argument("--bundle", dest="bundle_dir", default=None)
    ap.add_argument("--tree-json", dest="tree_json", default=None)
    ap.add_argument("--split-axes", dest="split_axes", default=None)
    args = ap.parse_args()

    from pyspark.sql import SparkSession
    spark = SparkSession.builder.appName("ody-tree-assign").getOrCreate()
    try:
        report = run(spark, args.input_path, args.output_path, args.bundle_dir,
                     args.tree_json, args.split_axes)
        print(json.dumps(report, ensure_ascii=False))
        if report["rows_outside_tree"]:
            raise SystemExit("트리 밖 leaf_id 가 {} 행 있다".format(report["rows_outside_tree"]))
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
