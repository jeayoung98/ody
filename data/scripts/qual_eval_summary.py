# -*- coding: utf-8 -*-
"""정성 채점 집계 — output/qual_scores.csv (사람이 채운 것) → output/qual_eval_summary.md

점수 = O 개수 / (10 − nf) × 10. 묶음 평균·전체 평균·결함 빈도·역방향 판정·여정 끊김을 표로 만든다.
읽는 기준(qual_eval_form.md §3)에 비추어 '관찰'만 적는다 — 규칙·좌표 변경은 하지 않는다.
사용: python scripts/qual_eval_summary.py [csv 경로]
"""
import io, os, sys, time
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); OUT = os.path.join(ROOT, "output")


def main():
    p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(OUT, "qual_scores.csv")
    if not os.path.exists(p):
        print("채점 파일이 없다:", p, "— qual_scores_template.csv 를 복사해 qual_scores.csv 로 저장하고 ok/defect/note 를 채울 것"); return
    df = pd.read_csv(p, encoding="utf-8-sig", dtype=str).fillna("")
    df["ok"] = df["ok"].str.strip().str.upper(); df["defect"] = df["defect"].str.strip().str.lower()
    L = ["# 정성 채점 집계 (v2.1)\n", "집계 {} · 원본 `{}` · 이 문서는 관찰 요약이며 규칙·좌표 변경 결정은 별도.\n".format(time.strftime("%Y-%m-%d %H:%M"), os.path.relpath(p, ROOT))]

    q = df[df["section"] == "query"].copy()
    q["nf"] = q["defect"].str.contains("nf") | (q["ok"] == "")
    q["O"] = q["ok"] == "O"
    per = q.groupby(["id", "bucket", "query_artist", "query_title"], sort=False).agg(n=("ok", "size"), nf=("nf", "sum"), O=("O", "sum")).reset_index()
    per["score"] = (per["O"] / (per["n"] - per["nf"]).clip(lower=1) * 10).round(1)
    per["judged"] = per["n"] - per["nf"]
    filled = int((~q["nf"]).sum()); total = len(q)
    L.append("## 1. 쿼리 점수\n")
    L.append("판정된 이웃 {} / {} ({} 미판정·nf).\n".format(filled, total, total - filled))
    L.append("| # | 묶음 | 쿼리 | 판정 곡수 | O | 점수(/10) |\n|---|---|---|---|---|---|")
    for _, r in per.iterrows():
        L.append("| {} | {} | {} — {} | {} | {} | {} |".format(r["id"], r["bucket"], r["query_artist"], r["query_title"], r["judged"], r["O"], r["score"] if r["judged"] else "—"))
    ok = per[per["judged"] > 0]
    if len(ok):
        L.append("\n**전체 평균 {:.1f} / 10** (판정된 쿼리 {}개)\n".format(ok["score"].mean(), len(ok)))
        bk = ok.groupby("bucket", sort=False)["score"].agg(["mean", "size"]).reset_index()
        L.append("| 묶음 | 쿼리 수 | 평균 |\n|---|---|---|")
        for _, r in bk.iterrows(): L.append("| {} | {} | {:.1f} |".format(r["bucket"], r["size"], r["mean"]))
        m = ok["score"].mean()
        L.append("\n읽는 기준(사전 기재): ≥7 쓸 만함 · 5~7 묶음별 확인 · <5 좌표 문제 의심 → 현재 **{}**.\n".format("≥7" if m >= 7 else "5~7" if m >= 5 else "<5"))

    L.append("## 2. 결함 코드 빈도 (쿼리 이웃 {}곡 기준)\n".format(total))
    codes = ["dup", "spoken", "mood", "tempo", "meta", "nf"]
    L.append("| 코드 | 곡 수 | 비율 | 사전 기준 |\n|---|---|---|---|")
    thr = {"dup": "≥5% (10곡) → τ_dup 재검토 후보", "spoken": "≥3곡 → R2 키워드 재검토 후보", "mood": "특정 묶음 편중 → 노드 관찰", "tempo": "관찰", "meta": "표시 필터 관찰", "nf": "분모 제외"}
    for c in codes:
        n = int(q["defect"].str.contains(c).sum()); L.append("| `{}` | {} | {:.1f}% | {} |".format(c, n, 100 * n / max(total, 1), thr[c]))
    md = q[q["defect"].str.contains("mood")]
    if len(md):
        L.append("\n`mood` 묶음별: " + ", ".join("{} {}".format(b, n) for b, n in md.groupby("bucket").size().items()) + "\n")

    rv = df[df["section"] == "reverse"]
    L.append("\n## 3. 역방향 3쌍\n")
    L.append("| # | 곡 A | 곡 B | 거리 | 판정 | 이유 |\n|---|---|---|---|---|---|")
    for _, r in rv.iterrows():
        L.append("| {} | {} — {} | {} — {} | {} | {} | {} |".format(r["id"], r["query_artist"], r["query_title"], r["artist"], r["title"], r["dist"],
                                                                {"A": "A 소리 다름(지도 맞음)", "B": "B 소리 비슷(지도 결함 후보)", "C": "C 판단 불가"}.get(r["ok"], "미기입"), r["note"]))
    nB = int((rv["ok"] == "B").sum()); L.append("\n지도 결함 후보(B) {}쌍 / {}.\n".format(nB, len(rv)))

    jn = df[df["section"] == "journey"]
    L.append("## 4. 여정\n")
    for jid, g in jn.groupby("id", sort=False):
        broke = g[g["ok"] == "X"]["rank"].tolist(); judged = int((g["ok"] != "").sum())
        L.append("- **{} {}**: 판정 {} / {} · 끊긴 지점 {}개 {} · 메모: {}".format(jid, g["bucket"].iloc[0], judged, len(g), len(broke), broke if broke else "", " / ".join(x for x in g["note"] if x)))
    L.append("\n## 5. 다음 (월요일 결정 항목 — 여기서 실행하지 않음)\n")
    L.append("- 위 §1~§4 를 보고 (a) 후처리 규칙(τ_dup·artist cap·τ_far) 조정 여부 (b) R2 키워드 재검토 여부 (c) 역방향 B 쌍 정밀 진단 여부를 결정한다.\n")
    io.open(os.path.join(OUT, "qual_eval_summary.md"), "w", encoding="utf-8").write("\n".join(L))
    print("완료: output/qual_eval_summary.md")


if __name__ == "__main__":
    main()
