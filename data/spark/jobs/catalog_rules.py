# -*- coding: utf-8 -*-
"""S5 카탈로그 제외 규칙 (spec 20, Jira S15P21A405-128).

    S1 대표행 7,404,506  →  규칙 R1~R9  →  제외 780,107  →  남는 곡 6,624,399

곡 수를 줄이는 두 번째이자 마지막 단계다. 첫 번째는 S1(`manifest_rows.py`).
**삭제가 아니라 표시다**(규칙 2). 모든 행을 그대로 내고 `excluded`, `excluded_reason[]`,
`flag_*` 컬럼으로 판정을 싣는다. 곡을 개별로 제외하지 않고 규칙으로만 제외한다.

numpy 기준 구현은 `pipeline/exclusion_apply.py`, 임계값은 `pipeline/exclusion_rules.json`
에서만 읽는다(규칙 9). 이 파일에 숫자를 적지 않는다.

## 규칙 요약 (값은 전부 JSON 에서 온다)

    R1 length      짧거나 긴 곡. 태그 있는 비예외는 max_s, 미태그는 max_s_untagged 상한,
                   long_exempt_tags(클래식·오페라·앰비언트) 는 길어도 유지
    R2 nonmusic    비음악 키워드 적중 제외 + flag_comedy/flag_spoken/flag_fieldrec 표시
    R3 no_key      제목과 아티스트 원문이 모두 빈 곡
    R4 cohort      코호트 밖 지문. S1 이 이미 걸러서 적중 0 이 정상(명시용)
    R5 dup_canon   같은 canonical 여러 mbid → 대표 1행. 좌표 거리 protect_dist 초과는 보호
    R6 dup_version 제목 정규화 키 + artist_norm 묶음 → 대표 1행. 같은 거리 보호
    R7 samplerate  enabled=false. flag_low_sr 만 만든다
    R8 silence     average_loudness 하위 분위 + (dynamic_complexity 낮음 or 무음률 높음)
    R9 corrupt     enabled=false. flag_clipped 만 만든다

## 이식하지 않는 것
dry-run 리포트, 브릿지 풀 Hit@10 재검증, 서빙 번들 내보내기. 앞의 둘은 fit·QA 산물이고
(규칙 3) 마지막은 S6 `artifact_export.py` 담당이다.

## 기준 출력과 다를 수 있는 두 값
1. `dup_group_id` — 원본은 `pandas.factorize` 의 등장 순서 코드다. 분산 환경에서 재현할 수
   없으므로 묶음 키의 `xxhash64` 를 쓴다. **묶음 자체(같은 묶음이면 같은 id)는 동일**하고
   정수 값만 다르다. 테스트는 묶음 분할을 비교한다.
2. `rules_hash` — 원본 7854e999ee3f14d1 은 CRLF 사본의 바이트 해시다. 저장소는 LF 라 같은
   내용이 다른 해시를 낸다. 그래서 정렬된 JSON 을 해시해 개행에 무관하게 만든다.
"""
import argparse
import hashlib
import io
import json
import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RULES_JSON = os.path.join(ROOT, "pipeline", "exclusion_rules.json")

PC = ["pc{}".format(i) for i in range(1, 17)]
FLAG_COLUMNS = ["flag_low_sr", "flag_comedy", "flag_spoken", "flag_fieldrec", "flag_clipped"]

# 제목 수식어 정규식. pipeline/catalog_audit.py 의 DROP_MODS·DISTINCT_MODS 와 같아야 한다.
# 실행기(executor)에서 pandas 를 끌고 오는 import 를 피하려고 여기 복제했고,
# tests/test_catalog_rules.py 가 실제 제목 표본에서 두 구현의 일치를 검사한다.
DROP_MODS = [r"re-?master(ed)?", r"\bmono\b", r"\bstereo\b", r"single version", r"album version",
             r"radio edit", r"\bedit\b", r"\bdeluxe\b", r"anniversary", r"bonus track", r"expanded",
             r"reissue", r"\b(19|20)\d{2}\b", r"\bversion\b", r"\bmix\b(?!.*remix)"]
DISTINCT_MODS = ["live", "acoustic", "remix", "instrumental", "unplugged", "demo", "karaoke", "cover"]

_BLOCK = re.compile(r"\(([^)]*)\)|\[([^\]]*)\]")
_YEAR_RM = re.compile(r"\b(19|20)\d{2}\s*(re-?master(ed)?)?\b")
_REMASTER_RM = re.compile(r"re-?master(ed)?")
_NON_WORD = re.compile(r"[^0-9a-z가-힣]+")


def load_rules(path=None):
    """(규칙 dict, 정렬 JSON 해시). 임계값은 여기서만 온다."""
    path = path or RULES_JSON
    doc = json.load(io.open(path, encoding="utf-8"))
    canonical = json.dumps(doc, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]
    return {r["id"]: r for r in doc["rules"]}, digest


# --------------------------------------------------------------------------
# 제목 정규화 — R6 묶음 키
# --------------------------------------------------------------------------
def base_norm(text):
    return _NON_WORD.sub("", (text or "").lower())


def r6_key(title):
    """(묶음 키, 유지태그, 제거태그, 미분류블록). catalog_audit.r6_key 와 같아야 한다."""
    t = (title or "").lower()
    blocks = [a or b for a, b in _BLOCK.findall(t)]
    main = _BLOCK.sub(" ", t)
    if " - " in main:                      # " - suffix" 도 수식어 블록으로 본다
        main, tail = main.split(" - ", 1)
        blocks.append(tail)
    keep, dropped, unknown = set(), [], []
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        hit = [m for m in DISTINCT_MODS if re.search(r"\b" + m + r"\b", block)]
        if hit:
            keep.update(hit)
        elif any(re.search(p, block) for p in DROP_MODS):
            dropped.append(block)
        else:
            unknown.append(block)
    main = _REMASTER_RM.sub(" ", _YEAR_RM.sub(" ", main))
    key = base_norm(main)
    if unknown:                            # 미분류 블록은 키에 남긴다. 접지 않는다(보수)
        key += "|" + base_norm(" ".join(sorted(unknown)))
    if keep:
        key += "|" + "+".join(sorted(keep))
    return key, sorted(keep), dropped, unknown


def has_no_modifier(title):
    """R6 대표 선정의 1순위. 제거 수식어도 미분류 블록도 없는 제목."""
    _key, _keep, dropped, unknown = r6_key(title)
    return not dropped and not unknown


def r6_group_key(artist_norm, title_raw):
    """묶음 키. 아티스트나 제목 키가 비면 묶지 않는다(빈 문자열 반환)."""
    artist = (artist_norm or "").strip()
    key = r6_key(title_raw)[0]
    if not artist or not key:
        return ""
    return artist + "||" + key


# --------------------------------------------------------------------------
# 행 단위 규칙 — 기준 구현. 테스트가 실제 카탈로그와 대조한다
# --------------------------------------------------------------------------
def _num(value):
    """None·NaN 을 None 으로 통일한다."""
    if value is None:
        return None
    value = float(value)
    return None if math.isnan(value) else value


def _tag_state(tags, exempt_keywords):
    """(태그 있음, 예외 태그 있음). 태그 문자열의 부분 문자열로 판정한다."""
    tags = [str(t).lower() for t in (tags or ())]
    return bool(tags), any(k in t for t in tags for k in exempt_keywords)


def r1_length(row, rule, tags):
    p = rule["params"]
    length = _num(row.get("length"))
    if length is None:
        return False
    if length < p["min_s"]:
        return True
    if length <= p["max_s"]:
        return False
    tagged, exempt = _tag_state(tags, p.get("long_exempt_tags", ()))
    if tagged:
        return not exempt                                   # 태그 있고 예외 아니면 제외
    return length > p.get("max_s_untagged", p["max_s"])      # 미태그는 더 넉넉한 상한


def _r8(row, p, loud_q):
    loud = _num(row.get("loudness"))
    if loud_q is None or loud is None or loud > loud_q:
        return False
    dyn, sil = _num(row.get("dyn_complexity")), _num(row.get("silence60"))
    return (dyn is not None and dyn < p["dyn_lt"]) or (sil is not None and sil > p["silence60_gt"])


def row_masks(row, rules, tags=(), loud_q=None):
    """행 하나로 판정되는 규칙들. R5·R6 은 묶음이 필요해서 여기 없다."""
    out = {}
    for rid, rule in rules.items():
        enabled = bool(rule.get("enabled"))
        p = rule["params"]
        if rid == "R1_length":
            hit = r1_length(row, rule, tags)
        elif rid == "R2_nonmusic":
            hit = bool(set(row.get("a5_keywords") or ()) & set(p["keywords"]))
        elif rid == "R3_no_key":
            hit = not (row.get("title_raw") or "") and not (row.get("artist_raw") or "")
        elif rid == "R4_cohort":
            hit = row.get("fingerprint") not in set(p["fingerprints"])
            enabled = True                     # 원본도 enabled 와 무관하게 적용한다(명시용)
        elif rid == "R7_samplerate":
            sr = _num(row.get("sample_rate"))
            hit = sr is not None and sr < p["min_sr"]
        elif rid == "R8_silence":
            hit = _r8(row, p, loud_q)
        elif rid == "R9_corrupt":
            hit = int(row.get("n_clipped_features") or 0) >= p["min_clipped_features"]
        else:
            continue                           # R5·R6 은 fold_group 이 판정한다
        out[rid] = bool(hit) and enabled
    return out


def row_flags(row, rules):
    """제외와 별개로 표시만 하는 컬럼들(규칙 2)."""
    hits = set(row.get("a5_keywords") or ())
    flags = {col: bool(hits & set(kws))
             for col, kws in rules["R2_nonmusic"]["params"].get("flag_columns", {}).items()}
    sr = _num(row.get("sample_rate"))
    flags["flag_low_sr"] = sr is not None and sr < rules["R7_samplerate"]["params"]["min_sr"]
    flags["flag_clipped"] = (int(row.get("n_clipped_features") or 0)
                             >= rules["R9_corrupt"]["params"]["min_clipped_features"])
    return flags


# --------------------------------------------------------------------------
# 묶음 단위 규칙 R5·R6 — 대표 1행 남기고 가까운 멤버만 접는다
# --------------------------------------------------------------------------
def fold_group(rows, order_key, protect_dist):
    """묶음 하나에서 (대표 index, 접히는 index 집합).

    rows 는 `{"i": index, "coords": [16개]}` 를 가진 dict 목록이다. 대표는 order_key 가
    가장 작은 행이고, 나머지 멤버는 대표와의 좌표 거리가 protect_dist 이내일 때만 접힌다.
    protect_dist 가 None 이면 거리 보호가 없다.
    """
    if not rows:
        return None, set()
    ordered = sorted(rows, key=order_key)
    rep = ordered[0]
    folded = {row["i"] for row in ordered[1:]
              if protect_dist is None or dist(row["coords"], rep["coords"]) <= protect_dist}
    return rep["i"], folded


def dist(a, b):
    return math.sqrt(sum((float(x) - float(y)) ** 2 for x, y in zip(a, b)))


def r5_order_key(row):
    """대표 = lossless > part > offset."""
    return (not bool(row["lossless"]), int(row["part"]), int(row["offset"]))


def r6_order_key(row):
    """대표 = 수식어 없는 제목 > lossless > 제출본 많은 순 > part > offset."""
    return (not bool(row["no_modifier"]), not bool(row["lossless"]),
            -int(row["n_submissions"]), int(row["part"]), int(row["offset"]))


# --------------------------------------------------------------------------
# Spark
# --------------------------------------------------------------------------
def tag_flags(genres_df, exempt_keywords):
    """genres_raw → mbid 당 (has_tag, has_exempt_tag). 제출본마다 행이 있어 합집합을 본다."""
    from pyspark.sql import functions as F
    tag = F.lower(F.col("_tag"))
    exempt = F.lit(False)
    for keyword in exempt_keywords:
        exempt = exempt | tag.contains(keyword.lower())
    return (genres_df
            .select(F.lower(F.col("mbid")).alias("mbid"), F.explode("genre").alias("_tag"))
            .select("mbid", exempt.alias("_e"))
            .groupBy("mbid").agg(F.lit(True).alias("has_tag"), F.max("_e").alias("has_exempt_tag")))


def _fold_columns(df, group_col, order_cols, protect_dist, prefix):
    """묶음 안에서 대표를 고르고 거리로 접힘을 정한다. 대표 좌표는 first() 로 가져온다."""
    from pyspark.sql import Window, functions as F
    window = Window.partitionBy(group_col).orderBy(*order_cols)
    frame = window.rowsBetween(Window.unboundedPreceding, Window.unboundedFollowing)
    squared = None
    for pc in PC:
        gap = F.col(pc) - F.first(F.col(pc)).over(frame)
        squared = gap * gap if squared is None else squared + gap * gap
    member = (F.col(group_col) != "") & (F.col(prefix + "_row") > 1)
    close = F.lit(True) if protect_dist is None else (F.col(prefix + "_dist") <= F.lit(float(protect_dist)))
    return (df
            .withColumn(prefix + "_row", F.row_number().over(window))
            .withColumn(prefix + "_dist", F.sqrt(squared))
            .withColumn(prefix + "_fold", member & close))


def apply_rules(df, rules, loud_q):
    """행 단위 + 묶음 단위 규칙을 모두 적용한다. 행은 하나도 버리지 않는다.

    df 에 필요한 컬럼: mbid, canonical, artist_norm, artist_raw, title_raw, length,
    sample_rate, lossless, part, offset, fingerprint, n_submissions, pc1..pc16,
    has_tag, has_exempt_tag, a5_keywords(array<string>), n_clipped_features,
    loudness, dyn_complexity, silence60.
    """
    from pyspark.sql import functions as F
    from pyspark.sql.types import BooleanType, StringType

    p1 = rules["R1_length"]["params"]
    p2 = rules["R2_nonmusic"]["params"]
    p8 = rules["R8_silence"]["params"]
    length, sr = F.col("length"), F.col("sample_rate")
    tagged = F.coalesce(F.col("has_tag"), F.lit(False))
    exempt = F.coalesce(F.col("has_exempt_tag"), F.lit(False))
    over_untagged = length > F.lit(float(p1.get("max_s_untagged", p1["max_s"])))
    masks = {
        "R1_length": ((length < F.lit(float(p1["min_s"])))
                      | ((length > F.lit(float(p1["max_s"])))
                         & F.when(tagged, ~exempt).otherwise(over_untagged))),
        "R2_nonmusic": F.arrays_overlap("a5_keywords", F.array(*[F.lit(k) for k in p2["keywords"]])),
        "R3_no_key": ((F.coalesce(F.col("title_raw"), F.lit("")) == "")
                      & (F.coalesce(F.col("artist_raw"), F.lit("")) == "")),
        "R4_cohort": ~F.col("fingerprint").isin(rules["R4_cohort"]["params"]["fingerprints"]),
        "R7_samplerate": sr < F.lit(float(rules["R7_samplerate"]["params"]["min_sr"])),
        "R8_silence": ((F.col("loudness") <= F.lit(float(loud_q)))
                       & ((F.col("dyn_complexity") < F.lit(float(p8["dyn_lt"])))
                          | (F.col("silence60") > F.lit(float(p8["silence60_gt"]))))),
        "R9_corrupt": (F.coalesce(F.col("n_clipped_features"), F.lit(0))
                       >= F.lit(rules["R9_corrupt"]["params"]["min_clipped_features"])),
    }
    out = df
    for rid, expr in masks.items():
        enabled = rules[rid].get("enabled") or rid == "R4_cohort"   # R4 는 명시용으로 항상 본다
        out = out.withColumn("_" + rid, F.coalesce(expr, F.lit(False)) if enabled else F.lit(False))
        if rid in ("R7_samplerate", "R9_corrupt"):                  # 끈 규칙도 flag 는 만든다
            out = out.withColumn("_flag_" + rid, F.coalesce(expr, F.lit(False)))

    # R5: canonical 묶음. 대표 = lossless > part > offset
    out = (out
           .withColumn("_nll", ~F.coalesce(F.col("lossless"), F.lit(False)))
           .withColumn("_g5", F.coalesce(F.col("canonical"), F.lit(""))))
    out = _fold_columns(out, "_g5", [F.col("_nll").asc(), F.col("part").asc(), F.col("offset").asc()],
                        rules["R5_dup_canonical"]["params"].get("protect_dist"), "_r5")
    out = out.withColumn("_R5_dup_canonical",
                         F.col("_r5_fold") if rules["R5_dup_canonical"].get("enabled") else F.lit(False))

    # R6: 제목 정규화 묶음. R5 로 접힌 행은 묶음에서 뺀다(원본과 같다)
    group_key = F.udf(r6_group_key, StringType())
    no_modifier = F.udf(has_no_modifier, BooleanType())
    out = (out
           .withColumn("_nomod", no_modifier(F.col("title_raw")))
           .withColumn("_g6", F.when(F.col("_R5_dup_canonical"), F.lit(""))
                       .otherwise(group_key(F.col("artist_norm"), F.col("title_raw"))))
           .withColumn("_nsub_desc", -F.coalesce(F.col("n_submissions"), F.lit(1))))
    out = _fold_columns(out, "_g6",
                        [(~F.col("_nomod")).asc(), F.col("_nll").asc(), F.col("_nsub_desc").asc(),
                         F.col("part").asc(), F.col("offset").asc()],
                        rules["R6_dup_version"]["params"]["protect_dist"], "_r6")
    out = out.withColumn("_R6_dup_version",
                         F.col("_r6_fold") if rules["R6_dup_version"].get("enabled") else F.lit(False))

    order = list(rules)
    excluded = None
    for rid in order:
        col = F.col("_" + rid)
        excluded = col if excluded is None else (excluded | col)
    reason = F.filter(F.array(*[F.when(F.col("_" + rid), F.lit(rid)) for rid in order]),
                      lambda x: x.isNotNull())
    flags = {col: F.coalesce(F.arrays_overlap("a5_keywords", F.array(*[F.lit(k) for k in kws])), F.lit(False))
             for col, kws in p2.get("flag_columns", {}).items()}
    flags["flag_low_sr"] = F.col("_flag_R7_samplerate")
    flags["flag_clipped"] = F.col("_flag_R9_corrupt")

    out = (out
           .withColumn("excluded", excluded)
           .withColumn("excluded_reason", reason)
           .withColumn("dup_group_id", F.when(F.col("_g6") == "", F.lit(-1))
                       .otherwise(F.xxhash64(F.col("_g6"))))
           .withColumn("is_representative", (F.col("_g6") != "") & (F.col("_r6_row") == 1)))
    for col, expr in flags.items():
        out = out.withColumn(col, expr)
    return out.drop(*[c for c in out.columns if c.startswith("_")])


def loudness_quantile(df, rules):
    """R8 분위값. 원본 numpy.nanpercentile(loudness, loudness_bottom_pct) 와 같다."""
    from pyspark.sql import functions as F
    pct = rules["R8_silence"]["params"]["loudness_bottom_pct"] / 100.0
    clean = df.filter(F.col("loudness").isNotNull() & ~F.isnan(F.col("loudness")))
    return float(clean.selectExpr("percentile(loudness, {}) AS q".format(pct)).first()["q"])


def run(spark, input_path, output_path, expect_excluded=None):
    from pyspark.sql import functions as F
    rules, digest = load_rules()
    df = spark.read.parquet(input_path)
    loud_q = loudness_quantile(df, rules)
    catalog = apply_rules(df, rules, loud_q).withColumn("rules_hash", F.lit(digest))
    catalog.write.mode("overwrite").parquet(output_path)
    written = spark.read.parquet(output_path)
    total = written.count()
    excluded = written.filter("excluded").count()
    report = {"stage": "S5", "input_path": input_path, "output_path": output_path,
              "rows": total, "excluded": excluded, "kept": total - excluded,
              "rules_hash": digest, "r8_loudness_quantile": loud_q,
              "dup_group_id": "xxhash64(묶음 키). 원본 factorize 코드와 값은 다르고 분할은 같다"}
    if expect_excluded:
        report["expected_excluded"] = int(expect_excluded)
        report["excluded_match"] = excluded == int(expect_excluded)
    return report


def main():
    ap = argparse.ArgumentParser(description="S5 카탈로그 제외 규칙")
    ap.add_argument("--in", dest="input_path", required=True, help="S1·S3·S4 조인 결과 (hdfs:///...)")
    ap.add_argument("--out", dest="output_path", required=True)
    ap.add_argument("--expect-excluded", type=int, default=0, help="기대 제외 수. 0 이면 검사하지 않는다")
    args = ap.parse_args()

    from pyspark.sql import SparkSession
    spark = SparkSession.builder.appName("ody-catalog-rules").getOrCreate()
    try:
        report = run(spark, args.input_path, args.output_path, args.expect_excluded or None)
        print(json.dumps(report, ensure_ascii=False))
        if report.get("excluded_match") is False:
            raise SystemExit("제외 수 불일치: {} != {}".format(report["excluded"], report["expected_excluded"]))
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
