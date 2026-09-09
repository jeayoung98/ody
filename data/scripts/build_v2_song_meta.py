# -*- coding: utf-8 -*-
"""진단·시각화용 곡 단위 메타 테이블 — work/v2_song_meta.parquet (7,404,506 행).

컬럼: mbid, canonical, artist_norm, title_norm, n_keys(복수 키 충돌 수), codec, bit_rate,
      length, lossless, node_d1, node_d2, leaf_id, is_bridge, is_korean, gnr(브릿지 곡 장르 코드)
"""
import io, os, re, time
import numpy as np, pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "work"); OUT = os.path.join(ROOT, "output")
V2 = os.path.join(ROOT, "serving", "v2-pca16-candidate")
HANGUL = re.compile(r"[가-힣]")


def norm(t):
    t = (t or "").lower()
    t = re.sub(r"\(.*?\)|\[.*?\]", "", t)
    return re.sub(r"[^0-9a-z가-힣]+", "", t)


def main():
    t0 = time.time()
    # ---- 대표 제출본 메타 (v2_feats) ----
    fr = []
    for d in ("v2_feats", "v2_feats_pilot"):
        for f in sorted(os.listdir(os.path.join(WORK, d))):
            if f.endswith(".parquet"):
                fr.append(pd.read_parquet(os.path.join(WORK, d, f),
                                          columns=["mbid", "codec", "bit_rate", "length", "lossless"]))
    meta = pd.concat(fr, ignore_index=True); del fr
    meta["mbid"] = meta["mbid"].astype(str).str.lower()
    print("meta {:,} ({:.1f}m)".format(len(meta), (time.time() - t0) / 60), flush=True)

    # ---- canonical ----
    rd = pd.read_parquet(os.path.join(ROOT, "data", "canonical", "canonical_recording_redirect.parquet"))
    r2c = pd.Series(rd["canonical_recording_mbid"].str.lower().to_numpy(), index=rd["recording_mbid"].str.lower()); del rd
    meta["canonical"] = meta["mbid"].map(r2c).fillna(meta["mbid"])

    # ---- 다수결 키 + 복수 키 수 (titles 30파트, canonical 단위) ----
    fr = []
    for p in range(30):
        t = pd.read_parquet(os.path.join(WORK, "titles.parquet" if p == 0 else "titles_part{}.parquet".format(p)),
                            columns=["mbid", "title", "artist"])
        t["part"] = np.int8(p); fr.append(t)
    ab = pd.concat(fr, ignore_index=True); del fr
    ab["mbid"] = ab["mbid"].astype(str).str.lower()
    ab["canonical"] = ab["mbid"].map(r2c).fillna(ab["mbid"])
    ab["artist_norm"] = ab["artist"].map(norm); ab["title_norm"] = ab["title"].map(norm)
    ab = ab[(ab["artist_norm"] != "") & (ab["title_norm"] != "")]
    votes = (ab.groupby(["canonical", "artist_norm", "title_norm"], sort=False)
               .agg(n=("part", "size"), fp=("part", "min")).reset_index())
    nkeys = votes.groupby("canonical").size().rename("n_keys")
    votes.sort_values(["canonical", "n", "fp"], ascending=[True, False, True], inplace=True, kind="stable")
    key = votes.drop_duplicates("canonical")[["canonical", "artist_norm", "title_norm"]]
    del ab, votes
    meta = meta.merge(key, on="canonical", how="left").merge(nkeys, on="canonical", how="left")
    meta["n_keys"] = meta["n_keys"].fillna(0).astype(np.int16)
    print("keys 병합 ({:.1f}m)".format((time.time() - t0) / 60), flush=True)

    # ---- 노드 ----
    np_ = pd.read_parquet(os.path.join(V2, "map_tree", "node_paths_v2.parquet"))
    np_["mbid"] = np_["mbid"].astype(str).str.lower()
    parts = np_["leaf_id"].str.split(".")
    np_["node_d1"] = parts.str[:2].str.join("."); np_["node_d2"] = parts.str[:3].str.join(".")
    meta = meta.merge(np_, on="mbid", how="left")

    # ---- 브릿지 ----
    br = pd.read_parquet(os.path.join(OUT, "bridge_v2.parquet"), columns=["mbid", "is_korean", "gnr"])
    br["mbid"] = br["mbid"].astype(str).str.lower()
    meta = meta.merge(br, on="mbid", how="left")
    meta["is_bridge"] = meta["is_korean"].notna()
    meta["is_korean"] = meta["is_korean"].fillna(False).astype(bool)
    meta["gnr"] = meta["gnr"].fillna("")
    meta.to_parquet(os.path.join(WORK, "v2_song_meta.parquet"), compression="zstd", index=False)
    print("저장 v2_song_meta.parquet {:,} 행, 컬럼 {} ({:.1f}m)".format(
        len(meta), list(meta.columns), (time.time() - t0) / 60))


if __name__ == "__main__":
    main()
