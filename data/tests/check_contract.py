# -*- coding: utf-8 -*-
"""서빙 아티팩트 계약 검사기 (specs/00_artifact_contract/spec.md, contract v1).

사용: python tests/check_contract.py serving/v2.1-pca16 [--strict] [--prev serving/v2.0-pca16] [--json]
exit 0 = FAIL 없음 (WARN 허용), exit 1 = FAIL 있음.
"""
import argparse, hashlib, io, json, os, re, sys, time
import numpy as np
import pyarrow.parquet as pq, pyarrow.compute as pc, pyarrow as pa

REQ_FILES = ["manifest.json", "coords_v2.parquet", "map_tree/node_paths_v2.parquet", "map_tree/tree.json", "map_tree/split_axes.npz",
             "map_tree/quality_by_depth.csv", "model_bundle.npz", "feature_list.json", "fit_manifest.json", "postprocess_rules.json"]
MANIFEST_KEYS = ["bundle_version", "status", "k", "n_features", "seed", "songs", "fit_sample", "explained_variance", "explained_variance_per_axis",
                 "extractor_version", "cohort_fingerprints", "correction", "pipeline", "map_tree", "songs_before_exclusion", "exclusion_rules",
                 "exclusion_rules_hash", "excluded_total", "catalog"]
STRICT_KEYS = ["files", "catalog_sha256", "contract_version", "created_at"]
MODEL_SHAPES = {"impute_median": (270,), "delta_f": (270,), "scaler_center": (270,), "scaler_scale": (270,), "winsorize_clip": (),
                "pca_components": (16, 270), "pca_mean": (270,), "explained_variance_ratio": (16,)}
RULE_KEYS = [("tau_dup", "value"), ("artist_cap", "value"), ("tau_far", "value"), ("length_range_s", "min"), ("length_range_s", "max"),
             ("hub_penalty", "enabled"), ("display_filter", "enabled")]
MINOR_SAME = ["coords_v2.parquet", "map_tree/split_axes.npz", "model_bundle.npz", "map_tree/node_paths_v2.parquet"]
LEAF_RE = re.compile(r"^root(\.[0-3]){6}$")


def sha256(path, block=1 << 24):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(block), b""): h.update(chunk)
    return h.hexdigest()


class Report:
    def __init__(self): self.items = []
    def ok(self, name, msg=""): self.items.append(("OK", name, msg))
    def warn(self, name, msg=""): self.items.append(("WARN", name, msg))
    def fail(self, name, msg=""): self.items.append(("FAIL", name, msg))
    def check(self, cond, name, msg=""): (self.ok if cond else self.fail)(name, msg)
    @property
    def failed(self): return any(s == "FAIL" for s, _, _ in self.items)


def check_bundle(bundle, strict=False, prev=None):
    R = Report(); t0 = time.time(); B = lambda *p: os.path.join(bundle, *p)
    for f in REQ_FILES: R.check(os.path.exists(B(f)), "file:" + f)
    if R.failed: return R
    man = json.load(io.open(B("manifest.json"), encoding="utf-8"))
    miss = [k for k in MANIFEST_KEYS if k not in man]; R.check(not miss, "manifest.keys", "missing " + ",".join(miss) if miss else "")
    R.check(man.get("k") == 16 and man.get("n_features") == 270, "manifest.k/n_features", "{} / {}".format(man.get("k"), man.get("n_features")))
    R.check(bool(re.match(r"^v\d+\.\d+-pca16-\d{4}-\d{2}-\d{2}$", str(man.get("bundle_version", "")))), "manifest.bundle_version", str(man.get("bundle_version")))
    R.check(len(man.get("explained_variance_per_axis", [])) == 16, "manifest.explained_variance_per_axis[16]")
    if str(man.get("status", "")).startswith("PROMOTED"):
        R.check("promoted_at" in man and "promotion_gate" in man, "manifest.promotion_gate(PROMOTED)")
    smiss = [k for k in STRICT_KEYS if k not in man]
    if smiss: (R.fail if strict else R.warn)("manifest.strict_keys", "missing " + ",".join(smiss) + (" (v2.2 부터 필수)" if not strict else ""))
    N = int(man["songs"])

    # coords
    sch = pq.read_schema(B("coords_v2.parquet")); names = sch.names
    R.check(names[0] == "mbid" and names[1:] == ["pc{}".format(i) for i in range(1, 17)], "coords.columns", ",".join(names[:3]) + "...")
    R.check(all(str(sch.field(c).type) == "float" for c in names[1:]), "coords.pc_dtype_float32", ",".join({str(sch.field(c).type) for c in names[1:]}))
    R.check(pq.read_metadata(B("coords_v2.parquet")).num_rows == N, "coords.rows==manifest.songs", str(pq.read_metadata(B("coords_v2.parquet")).num_rows))
    tbl = pq.read_table(B("coords_v2.parquet"))
    mb = tbl.column("mbid"); R.check(len(pc.unique(mb)) == N, "coords.mbid_unique")
    R.check(bool(pc.all(pc.equal(mb, pc.utf8_lower(mb))).as_py()), "coords.mbid_lowercase")
    finite = all(bool(pc.all(pc.is_finite(tbl.column(c))).as_py()) for c in names[1:]); R.check(finite, "coords.all_finite")
    # node_paths
    npth = pq.read_table(B("map_tree", "node_paths_v2.parquet")); R.check(npth.num_rows == N, "node_paths.rows==songs", str(npth.num_rows))
    R.check(npth.schema.names == ["mbid", "leaf_id"], "node_paths.columns", ",".join(npth.schema.names))
    leaves = pc.unique(npth.column("leaf_id")); nl = int(man["map_tree"]["n_leaves"]); R.check(len(leaves) == nl, "node_paths.distinct_leaf=={}".format(nl), str(len(leaves)))
    bad_leaf = [x for x in leaves.to_pylist()[:50000] if not LEAF_RE.match(x)]; R.check(not bad_leaf, "node_paths.leaf_id_format", bad_leaf[:3])
    mb2 = npth.column("mbid")
    if len(mb2) == len(mb):
        s1 = pc.take(mb, pc.array_sort_indices(mb)); s2 = pc.take(mb2, pc.array_sort_indices(mb2))
        same_set = bool(pc.all(pc.equal(s1, s2)).as_py()); del s1, s2
    else: same_set = False
    R.check(same_set, "node_paths.mbid_set==coords.mbid_set")
    del tbl, npth
    # tree.json
    tree = json.load(io.open(B("map_tree", "tree.json"), encoding="utf-8")); nodes = tree.get("nodes", {})
    R.check(len(nodes) == tree.get("n_nodes"), "tree.n_nodes==len(nodes)", "{} vs {}".format(len(nodes), tree.get("n_nodes")))
    n_leaf_nodes = sum(1 for v in nodes.values() if v.get("leaf")); R.check(n_leaf_nodes == nl, "tree.leaf_count=={}".format(nl), str(n_leaf_nodes))
    R.check(tree.get("max_depth") == man["map_tree"]["max_depth"], "tree.max_depth==manifest")
    bad_child = [v["id"] for v in nodes.values() if not v.get("leaf") and (len(v.get("children", [])) != 4 or any(not c.startswith(v["id"] + ".") for c in v["children"]))]
    R.check(not bad_child, "tree.children_4_and_prefixed", bad_child[:3])
    # split_axes
    z = np.load(B("map_tree", "split_axes.npz")); internal = len(nodes) - n_leaf_nodes
    R.check(len(z.files) == 3 * internal, "split_axes.keys==3*internal({})".format(internal), str(len(z.files)))
    a0 = z["axes_root"]; R.check(a0.shape == (2, 16) and z["median_root"].shape == (2,) and z["mean_root"].shape == (16,), "split_axes.root_shapes")
    # model_bundle
    m = np.load(B("model_bundle.npz")); bad = [k for k, s in MODEL_SHAPES.items() if k not in m.files or m[k].shape != s]
    R.check(not bad, "model_bundle.shapes", bad); R.check(all(str(m[k].dtype) == "float32" for k in m.files), "model_bundle.float32")
    # feature_list
    fl = json.load(io.open(B("feature_list.json"), encoding="utf-8")); feats = fl.get("features", []); sk = fl.get("skew_transform", {})
    R.check(len(feats) == 270 and len(set(feats)) == 270, "feature_list.270_unique", str(len(feats)))
    R.check(set(sk.keys()) == set(feats), "feature_list.skew_keys==features")
    R.check(set(sk.values()) <= {"", "log1p", "signed_log1p"}, "feature_list.skew_values", str(set(sk.values()) - {"", "log1p", "signed_log1p"}))
    # fit_manifest / rules
    fm = json.load(io.open(B("fit_manifest.json"), encoding="utf-8")); R.check(all(k in fm for k in ["fit_sample_n", "fit_sample_mbid_sha256", "seed", "generated"]), "fit_manifest.keys")
    rules = json.load(io.open(B("postprocess_rules.json"), encoding="utf-8")); badr = [a + "." + b for a, b in RULE_KEYS if a not in rules or b not in rules[a]]
    R.check(not badr, "postprocess_rules.keys", badr)
    # quality csv
    head = io.open(B("map_tree", "quality_by_depth.csv"), encoding="utf-8").readline().strip()
    R.check(head == "depth,n_nodes,n_leaves_at_depth,songs_median,songs_p10,songs_p90,songs_min,songs_max", "quality_by_depth.header", head)
    # strict: hashes
    if strict or "files" in man:
        files = man.get("files", {}); badh = []
        for rel, h in files.items():
            p = B(*rel.split("/"))
            if not os.path.exists(p) or sha256(p) != h: badh.append(rel)
        R.check(not badh and (not strict or all(f in files for f in REQ_FILES if f != "manifest.json")), "manifest.files_sha256", badh[:3] if badh else "")
        if "catalog_sha256" in man and os.path.exists(man.get("catalog", "")):
            R.check(sha256(man["catalog"]) == man["catalog_sha256"], "manifest.catalog_sha256")
        elif strict: R.fail("manifest.catalog_sha256", "catalog 경로 없음 또는 키 없음")
        if strict: R.check(man.get("contract_version") == "v1", "manifest.contract_version==v1", str(man.get("contract_version")))
    # minor rule vs prev
    if prev:
        for f in MINOR_SAME:
            R.check(os.path.exists(os.path.join(prev, f)) and sha256(os.path.join(prev, f)) == sha256(B(f)), "minor.same_as_prev:" + f)
    R.ok("elapsed_s", "{:.1f}".format(time.time() - t0))
    return R


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("bundle"); ap.add_argument("--strict", action="store_true"); ap.add_argument("--prev"); ap.add_argument("--json", action="store_true")
    a = ap.parse_args(); R = check_bundle(a.bundle, a.strict, a.prev)
    if a.json: print(json.dumps({"bundle": a.bundle, "failed": R.failed, "items": R.items}, ensure_ascii=False, indent=1, default=str))
    else:
        for s, n, m in R.items: print("{:4} {} {}".format(s, n, m if m else ""))
        print("=>", "FAIL" if R.failed else "PASS", "({} OK / {} WARN / {} FAIL)".format(*[sum(1 for s, _, _ in R.items if s == k) for k in ("OK", "WARN", "FAIL")]))
    sys.exit(1 if R.failed else 0)


if __name__ == "__main__":
    main()
