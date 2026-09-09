# -*- coding: utf-8 -*-
"""주말 정성 확인 — 데이터 준비 (v2.1 번들만 사용).

산출 (work/qual/):
  viz_points.parquet   : 2D 표본 (v2.1 에 남은 곡만) + hover 라벨 + 노드/장르/한국곡 + clickable_id
  leaf_centroids.parquet: depth-6 리프 4,096 중심 (pc1, pc2, n, top_genre)
  clickable.json       : 200곡의 top-10 이웃 (후처리 적용본) — HTML 클릭 패널용
  qual_queries.json    : 쿼리 20곡 (후처리 top-10 + 원본 top-10, 거리·노드·정답 파트너·링크)
  reverse_pairs.json   : 정답쌍인데 거리 > 14 인 3쌍
  journeys.json        : 두 경로 × 10 정거장
음원 재생·다운로드 없음. 링크는 유튜브 검색 URL 만.
"""
import io, json, os, sys, time, urllib.parse
import numpy as np, pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "work"); OUT = os.path.join(ROOT, "output"); Q = os.path.join(WORK, "qual")
SERV = os.path.join(ROOT, "serving", "v2.1-pca16")
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from postprocess_ab import apply_rules            # noqa: E402
PC = ["pc{}".format(i) for i in range(1, 17)]; SEED = 42
BLOCK = 250_000; K = 50

# Kakao Arena 멜론 장르 대분류 코드 (genre_gn_all.json 부재 — 공개 스키마 기준 표기)
GN = {"GN0100": "발라드", "GN0200": "댄스", "GN0300": "랩/힙합", "GN0400": "R&B/Soul", "GN0500": "인디", "GN0600": "록/메탈",
      "GN0700": "성인가요", "GN0800": "포크/블루스", "GN0900": "POP", "GN1000": "록/메탈(해외)", "GN1100": "일렉트로니카",
      "GN1200": "랩/힙합(해외)", "GN1300": "R&B/Soul(해외)", "GN1400": "포크/블루스/컨트리(해외)", "GN1500": "OST",
      "GN1600": "클래식", "GN1700": "재즈", "GN1800": "뉴에이지", "GN1900": "J-POP", "GN2000": "월드뮤직", "GN2100": "CCM",
      "GN2200": "어린이/태교", "GN2300": "종교음악", "GN2400": "국악", "GN2500": "뮤직테라피", "GN2600": "캐롤", "GN2700": "기타"}
BUCKETS = {"발라드": ["GN0100"], "댄스": ["GN0200"], "락": ["GN0600", "GN1000"], "힙합": ["GN0300", "GN1200"],
           "R&B": ["GN0400", "GN1300"], "재즈": ["GN1700"], "클래식": ["GN1600"], "OST": ["GN1500"]}


def yt(artist, title):
    return "https://www.youtube.com/results?search_query=" + urllib.parse.quote_plus("{} {}".format(artist, title))


def topk_full(Xq, X, sq, qidx, k=K):
    nq = len(Xq); best_d = np.full((nq, k), np.inf, np.float32); best_i = np.full((nq, k), -1, np.int64)
    qsq = (Xq ** 2).sum(1)[:, None]
    for s in range(0, len(X), BLOCK):
        Xb = X[s:s + BLOCK]; D = qsq + sq[None, s:s + BLOCK] - 2.0 * (Xq @ Xb.T); np.maximum(D, 0, out=D)
        loc = qidx - s; m = (loc >= 0) & (loc < len(Xb)); D[np.flatnonzero(m), loc[m]] = np.inf
        kk = min(k, D.shape[1]); part = np.argpartition(D, kk - 1, axis=1)[:, :kk]
        cd = np.concatenate([best_d, np.take_along_axis(D, part, axis=1).astype(np.float32)], axis=1)
        ci = np.concatenate([best_i, part + s], axis=1); o = np.argsort(cd, axis=1)[:, :k]
        best_d = np.take_along_axis(cd, o, axis=1); best_i = np.take_along_axis(ci, o, axis=1)
    return np.sqrt(best_d), best_i


def main():
    t0 = time.time(); os.makedirs(Q, exist_ok=True)
    co = pd.read_parquet(os.path.join(SERV, "coords_v2.parquet")); co["mbid"] = co["mbid"].astype(str).str.lower()
    X = np.ascontiguousarray(co[PC].to_numpy(np.float32)); mb = co["mbid"].to_numpy(); del co
    N = len(mb); sq = (X ** 2).sum(1); pos = pd.Series(np.arange(N), index=mb)
    cat = pd.read_parquet(os.path.join(WORK, "catalog_v2.parquet"), columns=["mbid", "canonical", "artist_raw", "title_raw", "length", "leaf_id", "node_d1", "node_d2", "is_bridge", "is_korean"])
    cat = cat.set_index("mbid").reindex(mb).reset_index()
    sm = pd.read_parquet(os.path.join(WORK, "v2_song_meta.parquet"), columns=["mbid", "artist_norm", "title_norm"]).set_index("mbid").reindex(mb)
    canon = cat["canonical"].to_numpy(); art_n = sm["artist_norm"].fillna("").to_numpy(); tit_n = sm["title_norm"].fillna("").to_numpy()
    length = cat["length"].to_numpy(float); artist = cat["artist_raw"].fillna("").to_numpy(); title = cat["title_raw"].fillna("").to_numpy()
    leaf = cat["leaf_id"].to_numpy(); d1 = cat["node_d1"].to_numpy(); d2 = cat["node_d2"].to_numpy()
    print("v2.1 {:,} 곡 로드 ({:.1f}m)".format(N, (time.time() - t0) / 60), flush=True)

    br = pd.read_parquet(os.path.join(OUT, "bridge_v2.parquet")); br["mbid"] = br["mbid"].astype(str).str.lower()
    br = br[br["mbid"].isin(set(mb))].copy(); br["gcode"] = br["gnr"].fillna("").str.split("|").str[0].fillna("")
    lab = pd.read_parquet(os.path.join(OUT, "labels_melon_pairs_v2.parquet"))
    cnt = {}
    for s, c in zip(lab["song_a"], lab["cnt_a"]): cnt[s] = int(c)
    for s, c in zip(lab["song_b"], lab["cnt_b"]): cnt[s] = int(c)
    br["cnt"] = br["melon_id"].map(cnt).fillna(0).astype(int)
    m2m = br.set_index("melon_id")["mbid"]
    partners = {}
    for a, b in zip(lab["song_a"].map(m2m), lab["song_b"].map(m2m)):
        if isinstance(a, str) and isinstance(b, str): partners.setdefault(a, set()).add(b); partners.setdefault(b, set()).add(a)
    gcode_of = br.set_index("mbid")["gcode"]

    # ---- 쿼리 20곡 ----
    rng = np.random.default_rng(SEED); chosen = []; used_art = set()
    def pick(df, n):
        out = []
        for _, r in df.sort_values("cnt", ascending=False).iterrows():
            a = art_n[pos[r["mbid"]]]
            if a in used_art or not title[pos[r["mbid"]]]: continue
            used_art.add(a); out.append(r["mbid"])
            if len(out) == n: break
        return out
    foreign = br[~br["is_korean"]]
    plan = [("발라드", 3), ("댄스", 3), ("락", 2), ("힙합", 2), ("R&B", 2), ("재즈", 2), ("클래식", 2), ("OST", 1)]
    for bk, n in plan:
        for m in pick(foreign[foreign["gcode"].isin(BUCKETS[bk])], n): chosen.append((m, bk))
    for m in pick(br[br["is_korean"]], 3): chosen.append((m, "한국 곡"))
    q_idx = np.array([pos[m] for m, _ in chosen]); print("쿼리 {}곡".format(len(chosen)), flush=True)

    # ---- clickable 200 = 쿼리 20 + 인기 브릿지 180 ----
    extra = [m for m in br.sort_values("cnt", ascending=False)["mbid"] if m not in set(x for x, _ in chosen) and title[pos[m]]][:180]
    click_idx = np.concatenate([q_idx, np.array([pos[m] for m in extra])])
    D, I = topk_full(X[click_idx], X, sq, click_idx)
    print("kNN 200 완료 ({:.1f}m)".format((time.time() - t0) / 60), flush=True)

    rules = json.load(io.open(os.path.join(SERV, "postprocess_rules.json"), encoding="utf-8"))
    rules["hub_penalty"]["expected"] = 1.0; cnt_hub = np.zeros(N, np.int32)
    meta_arr = (canon, art_n, tit_n, length, cnt_hub)
    def row(i, d=None, q=None):
        r = {"mbid": mb[i], "artist": artist[i][:60], "title": title[i][:80], "leaf": leaf[i], "node_d2": d2[i], "length_s": None if np.isnan(length[i]) else round(float(length[i]), 1),
             "genre": GN.get(gcode_of.get(mb[i], ""), ""), "youtube": yt(artist[i], title[i])}
        if d is not None: r["dist"] = round(float(d), 2)
        if q is not None: r["partner"] = bool(mb[i] in partners.get(mb[q], set()))
        return r

    clickable = {}
    for k, qi in enumerate(click_idx):
        after = apply_rules(I[k], D[k], qi, meta_arr, rules)
        dmap = dict(zip(I[k].tolist(), D[k].tolist()))
        clickable[str(k)] = {"query": row(qi), "neighbors": [row(i, dmap[i], qi) for i in after]}
    json.dump(clickable, io.open(os.path.join(Q, "clickable.json"), "w", encoding="utf-8"), ensure_ascii=False)

    queries = []
    for k, (m, bk) in enumerate(chosen):
        qi = q_idx[k]; after = apply_rules(I[k], D[k], qi, meta_arr, rules); dmap = dict(zip(I[k].tolist(), D[k].tolist()))
        queries.append({"bucket": bk, "query": row(qi), "cnt": int(br.set_index("mbid").loc[m, "cnt"]),
                        "top10_post": [row(i, dmap[i], qi) for i in after],
                        "top10_raw": [row(i, D[k][j], qi) for j, i in enumerate(I[k][:10])],
                        "n_partners_in_map": len(partners.get(m, set()))})
    json.dump(queries, io.open(os.path.join(Q, "qual_queries.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # ---- 역방향: 정답쌍인데 거리 > 14 ----
    pa = lab["song_a"].map(m2m); pb = lab["song_b"].map(m2m); ok = pa.notna() & pb.notna()
    ia = pos.reindex(pa[ok]).to_numpy(); ib = pos.reindex(pb[ok]).to_numpy(); v = np.isfinite(ia) & np.isfinite(ib)
    ia = ia[v].astype(int); ib = ib[v].astype(int); dd = np.linalg.norm(X[ia] - X[ib], axis=1)
    sa = lab["song_a"][ok].to_numpy()[v]; sb = lab["song_b"][ok].to_numpy()[v]; co_v = lab["co_count"][ok].to_numpy()[v]
    far = np.flatnonzero(dd > 14.0)
    popsum = np.array([cnt.get(a, 0) + cnt.get(b, 0) for a, b in zip(sa[far], sb[far])])
    order = far[np.argsort(-popsum)]
    rev = []; seen = set()
    for j in order:
        a, b = ia[j], ib[j]
        if art_n[a] in seen or art_n[b] in seen: continue
        seen.update([art_n[a], art_n[b]])
        rev.append({"a": row(a), "b": row(b), "dist": round(float(dd[j]), 2), "co_count": int(co_v[j])})
        if len(rev) == 3: break
    json.dump({"n_pairs_in_map": int(v.sum()), "n_far_gt14": int(len(far)), "share_far": float(len(far) / max(v.sum(), 1)), "pairs": rev},
              io.open(os.path.join(Q, "reverse_pairs.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # ---- journey 2개 ----
    def journey(a, b, n=10):
        used_c = {canon[a], canon[b]}; art_ct = {}; st = []; prev = a
        for k in range(1, n + 1):
            t = k / (n + 1); p = (1 - t) * X[a] + t * X[b]
            dvec = np.sqrt(np.maximum(sq - 2.0 * (X @ p) + (p ** 2).sum(), 0))
            for i in np.argsort(dvec)[:400]:
                if canon[i] in used_c or not title[i] or art_ct.get(art_n[i], 0) >= 2: continue
                if not (30 <= length[i] <= 1200) and np.isfinite(length[i]): continue
                used_c.add(canon[i]); art_ct[art_n[i]] = art_ct.get(art_n[i], 0) + 1
                r = row(i); r["dist_from_prev"] = round(float(np.linalg.norm(X[i] - X[prev])), 2); r["dist_to_line_pt"] = round(float(dvec[i]), 2)
                st.append(r); prev = i; break
        return {"from": row(a), "to": row(b), "endpoint_dist": round(float(np.linalg.norm(X[a] - X[b])), 2), "stations": st,
                "last_to_end": round(float(np.linalg.norm(X[prev] - X[b])), 2)}
    bk_idx = {}
    for k, (m, bk) in enumerate(chosen): bk_idx.setdefault(bk, []).append(q_idx[k])
    J = [{"name": "발라드 → 댄스", **journey(bk_idx["발라드"][0], bk_idx["댄스"][0])},
         {"name": "한국 곡 → 해외 곡(힙합)", **journey(bk_idx["한국 곡"][0], bk_idx["힙합"][0])}]
    json.dump(J, io.open(os.path.join(Q, "journeys.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("쿼리·역방향·journey 완료 ({:.1f}m)".format((time.time() - t0) / 60), flush=True)

    # ---- 리프 중심 ----
    lf = pd.DataFrame({"leaf": leaf, "pc1": X[:, 0], "pc2": X[:, 1]})
    cent = lf.groupby("leaf").agg(pc1=("pc1", "mean"), pc2=("pc2", "mean"), n=("pc1", "size")).reset_index()
    isbr = pd.Series(mb).isin(set(br["mbid"])).to_numpy()
    bg = pd.DataFrame({"leaf": leaf[isbr], "g": pd.Series(mb[isbr]).map(gcode_of).fillna("").to_numpy()})
    bg = bg[bg["g"] != ""]; topg = bg.groupby("leaf")["g"].agg(lambda s: s.value_counts().index[0]); nb = bg.groupby("leaf").size()
    cent["top_genre_code"] = cent["leaf"].map(topg).fillna(""); cent["top_genre"] = cent["top_genre_code"].map(GN).fillna("")
    cent["n_bridge"] = cent["leaf"].map(nb).fillna(0).astype(int)
    cent.to_parquet(os.path.join(Q, "leaf_centroids.parquet"), index=False)

    # ---- 2D 표본 (v2.1 에 남은 곡만) ----
    vs = pd.read_parquet(os.path.join(WORK, "viz_sample.parquet")); vs["mbid"] = vs["mbid"].astype(str).str.lower()
    vs = vs[vs["mbid"].isin(set(mb))].copy()
    vi = pos.reindex(vs["mbid"]).to_numpy().astype(int)
    vs["label"] = [("{} — {}".format(artist[i][:40], title[i][:50])).strip(" —") for i in vi]
    vs["genre_name"] = vs["genre_top"].map(GN).fillna("")
    click_pos = {int(i): k for k, i in enumerate(click_idx)}
    vs["clickable_id"] = [click_pos.get(int(i), -1) for i in vi]
    # clickable 200 이 표본에 없으면 추가
    missing = [k for k, i in enumerate(click_idx) if int(i) not in set(vi.tolist())]
    if missing:
        add = pd.DataFrame({"mbid": mb[click_idx[missing]], "pc1": X[click_idx[missing], 0], "pc2": X[click_idx[missing], 1],
                            "node_d1": d1[click_idx[missing]], "node_d2": d2[click_idx[missing]], "leaf_id": leaf[click_idx[missing]],
                            "is_bridge": True, "is_korean": cat["is_korean"].to_numpy()[click_idx[missing]],
                            "gnr": [gcode_of.get(m, "") for m in mb[click_idx[missing]]], "artist_norm": "", "title_norm": "",
                            "genre_top": [gcode_of.get(m, "") for m in mb[click_idx[missing]]],
                            "label": ["{} — {}".format(artist[i][:40], title[i][:50]) for i in click_idx[missing]],
                            "genre_name": [GN.get(gcode_of.get(m, ""), "") for m in mb[click_idx[missing]]], "clickable_id": missing})
        vs = pd.concat([vs, add], ignore_index=True)
    vs.to_parquet(os.path.join(Q, "viz_points.parquet"), compression="zstd", index=False)
    json.dump({"n_points": int(len(vs)), "n_bridge": int(vs["is_bridge"].sum()), "n_korean": int(vs["is_korean"].sum()), "n_leaves": int(len(cent)),
               "genre_codes": GN, "elapsed_min": (time.time() - t0) / 60}, io.open(os.path.join(Q, "meta.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("완료 {:.1f}m — viz {:,} 점 / 리프 {:,}".format((time.time() - t0) / 60, len(vs), len(cent)))


if __name__ == "__main__":
    main()
