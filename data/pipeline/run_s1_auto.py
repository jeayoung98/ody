# -*- coding: utf-8 -*-
"""사용자 조건부 사전 승인(2026-09-06) 실행기.

1) 규칙 JSON v3 반영 (R2: 'spoken word','field recording' 제외→flag)  2) dry-run
3) 조건 검사 — 전부 만족 시에만 s1_apply, 하나라도 벗어나면 멈추고 보고:
   - 총 제외 10.0% ~ 10.7%
   - R2 이외 규칙 적중 불변: R1 113,841 / R3 10,976 / R5 241,660 / R6 407,026 / R8 116
   - R2 적중 8,000 ~ 11,000
결과: output/s1_auto_decision.json
"""
import io, json, os, shutil, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); OUT = os.path.join(ROOT, "output")
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, "scripts"))

EXPECT = {"R1_length": 113841, "R3_no_key": 10976, "R5_dup_canonical": 241660, "R6_dup_version": 407026, "R8_silence": 116}
TOTAL_RANGE = (0.100, 0.107); R2_RANGE = (8000, 11000)


def update_rules():
    p = os.path.join(HERE, "exclusion_rules.json"); R = json.load(io.open(p, encoding="utf-8"))
    R["version"] = "exclusion_rules_v3"
    R["status"] = "v3 — 사용자 결정(2026-09-06 #2): R2 에서 'spoken word','field recording' 제거→flag_spoken/flag_fieldrec. 조건부 사전 승인으로 dry-run 조건 통과 시 적용."
    for r in R["rules"]:
        if r["id"] == "R2_nonmusic":
            r["params"] = {"keywords": ["speech", "audiobook", "podcast", "interview", "sound effect", "lecture", "asmr", "sermon", "white noise"],
                           "flag_columns": {"flag_comedy": ["comedy"], "flag_spoken": ["spoken word"], "flag_fieldrec": ["field recording"]}}
            r["basis"] = ("A5: 12개 키워드 적중 합집합 35,901. comedy(20,876)·spoken word(단독 5,376)·field recording(단독 1,083)은 dry-run 표본에서 음악 오적중"
                          "(Hobart Smith, Biosphere, The Streets 등 — 두 태그는 음악 장르 표기로도 쓰임) → 제외에서 빼고 flag 컬럼(사용자 결정). 나머지 9개 유지.")
    json.dump(R, io.open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)


def patch_apply():
    p = os.path.join(HERE, "exclusion_apply.py"); s = io.open(p, encoding="utf-8").read()
    old = '''    allhits = pd.read_parquet(os.path.join(WORK, "audit_A5_hits.parquet"))
    fk = allhits[allhits["keyword"].isin(r["params"].get("flag_keywords", []))]
    extra["flag_comedy"] = meta["mbid"].isin(set(fk["mbid"])).to_numpy()'''
    new = '''    allhits = pd.read_parquet(os.path.join(WORK, "audit_A5_hits.parquet"))
    extra["flag_cols"] = {}
    for col, kws in r["params"].get("flag_columns", {"flag_comedy": r["params"].get("flag_keywords", [])}).items():
        fk = allhits[allhits["keyword"].isin(kws)]
        extra["flag_cols"][col] = meta["mbid"].isin(set(fk["mbid"])).to_numpy()'''
    if old in s: s = s.replace(old, new)
    old2 = '''    cat["flag_comedy"] = extra["flag_comedy"]; cat["flag_clipped"] = extra["flag_clipped"]'''
    new2 = '''    for col, arr in extra["flag_cols"].items(): cat[col] = arr
    cat["flag_clipped"] = extra["flag_clipped"]'''
    if old2 in s: s = s.replace(old2, new2)
    # extra 에 dict 가 들어가므로 JSON 직렬화 필터에 dict 도 제외
    s = s.replace('''"extra": {k: v for k, v in extra.items() if not isinstance(v, (np.ndarray, pd.DataFrame, pd.Series))}''',
                  '''"extra": {k: v for k, v in extra.items() if not isinstance(v, (np.ndarray, pd.DataFrame, pd.Series, dict))}''')
    io.open(p, "w", encoding="utf-8").write(s)


def main():
    update_rules(); patch_apply()
    import exclusion_apply
    for ext in ("md", "json"):
        src = os.path.join(OUT, "exclusion_dryrun." + ext)
        if os.path.exists(src): shutil.copy(src, os.path.join(OUT, "exclusion_dryrun_v2." + ext))
    print("=== dry-run v3 ===", flush=True)
    exclusion_apply.main(dry_run=True)
    S = json.load(io.open(os.path.join(OUT, "exclusion_dryrun.json"), encoding="utf-8"))
    checks = {"total_in_range": TOTAL_RANGE[0] <= S["total_share"] <= TOTAL_RANGE[1],
              "r2_in_range": R2_RANGE[0] <= S["per_rule"]["R2_nonmusic"]["hits"] <= R2_RANGE[1]}
    for k, v in EXPECT.items():
        checks["{}_unchanged".format(k)] = (S["per_rule"][k]["hits"] == v)
    dec = {"conditions": checks, "observed": {"total_share": S["total_share"], "R2_hits": S["per_rule"]["R2_nonmusic"]["hits"],
                                              **{k: S["per_rule"][k]["hits"] for k in EXPECT}},
           "expected": {"total_range": TOTAL_RANGE, "R2_range": R2_RANGE, **EXPECT},
           "all_pass": all(checks.values()), "approval": "사용자 조건부 사전 승인 (2026-09-06) — 조건 전부 만족 시 apply",
           "checked_at": time.strftime("%Y-%m-%d %H:%M:%S")}
    print("조건 검사:", {k: v for k, v in checks.items()}, "→", "APPLY" if dec["all_pass"] else "STOP", flush=True)
    if dec["all_pass"]:
        print("=== s1_apply ===", flush=True)
        exclusion_apply.main(dry_run=False)
        dec["applied"] = True
    else:
        dec["applied"] = False
    json.dump(dec, io.open(os.path.join(OUT, "s1_auto_decision.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False, default=float)
    print("결정 기록: output/s1_auto_decision.json | applied =", dec["applied"])


if __name__ == "__main__":
    main()
