# -*- coding: utf-8 -*-
"""Part A.3/4 — gates/v2_validation_gate_v2.json 실행: G1'(공통 풀 쌍대 비열등성 + 부트스트랩 CI),
G1''(v2 풀 절대 바닥), G2~G4(원안, validation_v2_melon.json 재사용) → 판정 → 통과 시 승격.
"""
import io, json, os, shutil, sys, time
import numpy as np, pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from validate_v2_melon import Scorer, load_map, auc_np, PC, SEEDS   # noqa: E402
OUT = os.path.join(ROOT, "output")
V2 = os.path.join(ROOT, "serving", "v2-pca16-candidate"); V1 = os.path.join(ROOT, "serving", "v1-pca16")
G = json.load(io.open(os.path.join(ROOT, "gates", "v2_validation_gate_v2.json"), encoding="utf-8"))
N_BOOT = 1000


def main():
    t0 = time.time()
    M = json.load(io.open(os.path.join(OUT, "validation_v2_melon.json"), encoding="utf-8"))
    lab = pd.read_parquet(os.path.join(OUT, "labels_melon_pairs_v2.parquet"))
    br = pd.read_parquet(os.path.join(OUT, "bridge_v2.parquet")); br["mbid"] = br["mbid"].astype(str).str.lower()
    m2m = br.set_index("melon_id")["mbid"]; mb2melon = br.drop_duplicates("mbid").set_index("mbid")["melon_id"]
    cnt = {}
    for s, c in zip(lab["song_a"], lab["cnt_a"]): cnt[s] = int(c)
    for s, c in zip(lab["song_b"], lab["cnt_b"]): cnt[s] = int(c)
    lab["mbid_a"] = lab["song_a"].map(m2m); lab["mbid_b"] = lab["song_b"].map(m2m)

    X2, N2 = load_map(V2, "coords_v2.parquet", "node_paths_v2.parquet", 6)
    X1, N1 = load_map(V1, "coords_pca16.parquet", "assignments.parquet", 4)
    common = sorted(set(br["mbid"]) & set(X2.index) & set(N2.index) & set(X1.index) & set(N1.index))
    pos = lab[lab["mbid_a"].isin(common) & lab["mbid_b"].isin(common) & (lab["mbid_a"] != lab["mbid_b"])].copy()
    w = np.array([cnt.get(mb2melon[m], 0) for m in common], float) + 1.0
    keys = set(map(frozenset, zip(pos["mbid_a"], pos["mbid_b"])))
    sc2 = Scorer(X2, N2, 6, common, w, keys); sc1 = Scorer(X1, N1, 4, common, w, keys)
    print("공통 풀 {:,} 곡 / 쌍 {:,}".format(len(common), len(pos)), flush=True)

    sa_false = ~pos["same_artist"].to_numpy(bool)
    a, b = pos["mbid_a"].to_numpy(), pos["mbid_b"].to_numpy()
    d2 = sc2.dist(a, b); d1 = sc1.dist(a, b)
    negs = {}
    for s in SEEDS:                       # 같은 negative 쌍(같은 seed → 같은 곡 쌍)을 두 지도에서 잰다
        na, nb = sc2.negatives(len(pos), s, corrected=True)
        negs[s] = (sc2.dist(na, nb), sc1.dist(na, nb))
    auc2 = float(np.mean([auc_np(d2[sa_false], negs[s][0]) for s in SEEDS]))
    auc1 = float(np.mean([auc_np(d1[sa_false], negs[s][1]) for s in SEEDS]))
    diff = auc2 - auc1

    # ---- 쌍 단위 부트스트랩 (positive 재표본, negative 고정) ----
    rng = np.random.default_rng(42)
    idx = np.flatnonzero(sa_false); n = len(idx)
    boots = np.empty(N_BOOT)
    for i in range(N_BOOT):
        bs = idx[rng.integers(0, n, n)]
        boots[i] = np.mean([auc_np(d2[bs], negs[s][0]) - auc_np(d1[bs], negs[s][1]) for s in SEEDS])
    ci = (float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5)))
    print("G1' 공통 풀 sa=false: v1 {:.4f} → v2 {:.4f}  Δ {:+.4f}  95% CI [{:+.4f}, {:+.4f}] ({} 쌍, {} 회)".format(
        auc1, auc2, diff, ci[0], ci[1], n, N_BOOT), flush=True)

    v2f = M["v2_full"]; g_old = M["gates"]
    R = {"gate_id": G["gate_id"], "common_pool": len(common), "common_pairs": int(len(pos)),
         "common_pairs_same_artist_false": int(n),
         "G1p": {"v1": auc1, "v2": auc2, "diff": diff, "ci95": ci, "n_boot": N_BOOT,
                 "criterion": "v2 >= v1 - 0.01", "pass": bool(auc2 >= auc1 - 0.01),
                 "ci_excludes_zero": bool(ci[0] > 0)},
         "G1pp": {"value": v2f["auc_same_artist_false"], "criterion": ">= 0.60",
                  "pass": bool(v2f["auc_same_artist_false"] >= 0.60)},
         "G2": g_old["G2"], "G3": g_old["G3"], "G4": g_old["G4"],
         "original_G1": {"value": g_old["G1"]["value"], "pass": g_old["G1"]["pass"], "preserved": True},
         "elapsed_min": (time.time() - t0) / 60}
    R["all_pass"] = all(R[k]["pass"] for k in ("G1p", "G1pp", "G2", "G3", "G4"))
    R["verdict"] = "PROMOTE" if R["all_pass"] else "HOLD"
    json.dump(R, io.open(os.path.join(OUT, "validation_v2_gate2.json"), "w", encoding="utf-8"),
              indent=2, ensure_ascii=False, default=float)
    print("판정:", {k: R[k]["pass"] for k in ("G1p", "G1pp", "G2", "G3", "G4")}, "→", R["verdict"])

    if R["all_pass"]:
        dst = os.path.join(ROOT, "serving", "v2-pca16")
        if os.path.exists(dst):
            shutil.rmtree(dst)
        shutil.copytree(V2, dst)
        m = json.load(io.open(os.path.join(dst, "manifest.json"), encoding="utf-8"))
        m["status"] = "PROMOTED"; m["promoted_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        m["promotion_gate"] = {"gate_id": G["gate_id"],
                               "results": {k: R[k] for k in ("G1p", "G1pp", "G2", "G3", "G4")},
                               "original_G1": R["original_G1"]}
        json.dump(m, io.open(os.path.join(dst, "manifest.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        json.dump({"status": "ARCHIVED", "superseded_by": "serving/v2-pca16", "archived_at": m["promoted_at"],
                   "note": "v1 파일은 수정하지 않았다. 이 표지 파일만 추가."},
                  io.open(os.path.join(V1, "ARCHIVED.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        print("승격 완료: serving/v2-pca16 = PROMOTED, v1 ARCHIVED 표시")


if __name__ == "__main__":
    main()
