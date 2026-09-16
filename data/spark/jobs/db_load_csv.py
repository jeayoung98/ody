# -*- coding: utf-8 -*-
"""S7 적재 CSV 생성 — HDFS 에서 읽어 HDFS 에 쓴다 (스펙 18, Jira S15P21A405-385).

    hdfs:///ody/data/catalog (excluded=false) + coords + v2_meta + feats + song_meta
      →  hdfs:///ody/data/ingest_csv/{music,genre,music_genre,neo4j_music}/

`ingest/build_csv.py` 가 로컬에서 하던 일을 클러스터로 옮긴 것이다. 그 다음 단계(파일을 받아
`COPY`)는 `ingest/run_db_load.sh` 가 잇는다.

## 왜 JDBC 로 바로 INSERT 하지 않나
1. PostgreSQL 5432 는 host port 가 없고 `ody-internal` 도커 네트워크에만 열려 있다
   (`docs/infra/SECURITY.md`). YARN executor 가 붙을 경로가 없다.
2. `COPY` 는 662만행 **66초** 실측이다. JDBC 배치는 분 단위다.
파일로 내보내고 서버가 빨아들이는 것이 이 규모의 정석이다(Redshift COPY, Snowflake COPY INTO).

## 값 형식은 `ingest/build_csv.py` 가 정한다
이 파일에 자르는 길이·소수 자리·벡터 표기를 다시 적지 않는다. `music_row` 를 그대로 부르고
`csv.writer` 로 같은 따옴표 규칙을 쓴다. 그래서 두 경로의 산출이 **글자 단위로 같다**
(`tests/test_db_load_csv.py` 가 검사한다).

## id 는 mbid 오름차순 1..N (D13)
`row_number()` 는 전역 정렬을 한 파티션에 모은다. 469만 행이면 executor 하나가 다 짊어진다.
대신 `sortBy(mbid)` 뒤 `zipWithIndex()` 를 쓴다 — 분산된 채로 같은 번호가 나온다.

## 헤더는 붙이지 않는다
파트 파일마다 헤더가 들어가면 `COPY` 가 그 줄을 데이터로 읽는다. 헤더는 `run_db_load.sh` 가
`getmerge` 뒤에 한 번 붙이고, `COPY` 는 `HEADER true` 로 읽는다.

## 제출
    /opt/spark/bin/spark-submit --master yarn --deploy-mode client \
      --num-executors 2 --executor-memory 4g --executor-cores 2 --driver-memory 2g \
      --py-files ingest/build_csv.py \
      --name ody-S7-ingest-csv spark/jobs/db_load_csv.py \
      --catalog hdfs:///ody/data/catalog --coords hdfs:///ody/data/coords \
      --meta hdfs:///ody/data/v2_meta --feats hdfs:///ody/data/v2_feats \
      --song-meta hdfs:///ody/data/v2_song_meta \
      --out hdfs:///ody/data/ingest_csv --expect-rows 4694202
"""
import argparse
import csv
import io
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
for sub in (os.path.join(ROOT, "ingest"), HERE):
    if sub not in sys.path:
        sys.path.insert(0, sub)

from build_csv import (EMPTY_META, GENRE_COLUMNS, MUSIC_COLUMNS, MUSIC_GENRE_COLUMNS,  # noqa: E402
                       NEO4J_COLUMNS, NEO4J_SEPARATOR, PC_COLUMNS, format_album_mbid,
                       format_vector, music_row, split_genres)

TABLES = ("music", "genre", "music_genre", "neo4j_music")


def csv_line(values):
    """`ingest/build_csv.py` 의 `write_csv` 와 같은 따옴표·줄바꿈 규칙."""
    buffer = io.StringIO()
    csv.writer(buffer, lineterminator="").writerow(values)
    return buffer.getvalue()


def music_csv_line(song_id, row, genre_ids):
    """(music 한 줄, neo4j 한 줄, 장르 코드 목록). row 는 조인된 Row 다."""
    values, _title_cut, _artist_cut, _album_cut = music_row(
        song_id, row["mbid"], row["title_raw"], row["artist_raw"], row["bpm"], row["length"],
        [row[pc] for pc in PC_COLUMNS],
        (row["album"], row["release_year"], row["albumid"]))
    codes = split_genres(row["gnr"])
    neo4j = csv_line([song_id, row["mbid"],
                      NEO4J_SEPARATOR.join(str(v) for v in [row[pc] for pc in PC_COLUMNS]),
                      NEO4J_SEPARATOR.join(codes)])
    return csv_line(values), neo4j, codes


def build(spark, args):
    from pyspark.sql import functions as F

    catalog = (spark.read.parquet(args.catalog)
               .filter(~F.col("excluded"))
               .select(F.lower(F.col("mbid")).alias("mbid"), "title_raw", "artist_raw", "length"))
    coords = spark.read.parquet(args.coords).select(
        F.lower(F.col("mbid")).alias("mbid"), *PC_COLUMNS)
    joined = catalog.join(coords, "mbid", "inner")

    # album·release_year·album_mbid (D17 재패스). 없으면 빈 값으로 나간다.
    if args.meta:
        meta = spark.read.parquet(args.meta).select(
            F.lower(F.col("mbid")).alias("mbid"), "album", "release_year", "albumid")
        joined = joined.join(meta, "mbid", "left")
    else:
        joined = (joined.withColumn("album", F.lit(None).cast("string"))
                  .withColumn("release_year", F.lit(None).cast("double"))
                  .withColumn("albumid", F.lit(None).cast("string")))

    # bpm 은 270 특징의 rhythm.bpm. 두 디렉터리를 모두 읽어야 한다(D16).
    feats = spark.read.parquet(*args.feats).select(
        F.lower(F.col("mbid")).alias("mbid"), F.col("`rhythm.bpm`").alias("bpm"))
    joined = joined.join(feats, "mbid", "left")

    # 장르 코드 문자열(`GN1400|GN1000`)
    if args.song_meta:
        song_meta = spark.read.parquet(args.song_meta).select(
            F.lower(F.col("mbid")).alias("mbid"), F.col("gnr"))
        joined = joined.join(song_meta, "mbid", "left")
    else:
        joined = joined.withColumn("gnr", F.lit(None).cast("string"))

    # id = mbid 오름차순 1..N. zipWithIndex 는 파티션 순서를 지키므로 정렬 뒤에 부른다.
    ordered = joined.orderBy("mbid").rdd.zipWithIndex()
    ordered.persist()

    # genre.csv — 코드 하나가 행 하나. 이름 오름차순으로 id 를 준다(build_csv 와 같은 규칙).
    codes = sorted(set(ordered.flatMap(lambda pair: split_genres(pair[0]["gnr"])).distinct().collect()))
    genre_ids = {code: index + 1 for index, code in enumerate(codes)}

    def emit(pair):
        row, index = pair
        song_id = index + 1
        music, neo4j, song_codes = music_csv_line(song_id, row, genre_ids)
        return song_id, music, neo4j, song_codes

    emitted = ordered.map(emit)
    emitted.persist()
    emitted.map(lambda item: item[1]).saveAsTextFile(os.path.join(args.out, "music"))
    emitted.map(lambda item: item[2]).saveAsTextFile(os.path.join(args.out, "neo4j_music"))

    # music_genre.csv — 링크 id 도 1..M 연속. 곡 순서 안에서 코드 정렬 순이다.
    links = (emitted.flatMap(lambda item: [(item[0], genre_ids[code]) for code in item[3]])
             .sortBy(lambda pair: pair)
             .zipWithIndex()
             .map(lambda pair: csv_line([pair[1] + 1, pair[0][0], pair[0][1]])))
    links.persist()
    links.saveAsTextFile(os.path.join(args.out, "music_genre"))

    # genre.csv 는 29행이라 드라이버에서 쓴다.
    genre_rdd = spark.sparkContext.parallelize(
        [csv_line([genre_ids[code], code]) for code in codes], 1)
    genre_rdd.saveAsTextFile(os.path.join(args.out, "genre"))

    report = {"stage": "S7", "out": args.out,
              "music_rows": emitted.count(), "genre_rows": len(codes),
              "music_genre_rows": links.count(),
              "headers": {"music": csv_line(MUSIC_COLUMNS), "genre": csv_line(GENRE_COLUMNS),
                          "music_genre": csv_line(MUSIC_GENRE_COLUMNS),
                          "neo4j_music": csv_line(NEO4J_COLUMNS)}}
    emitted.unpersist(); ordered.unpersist(); links.unpersist()
    return report


def main():
    parser = argparse.ArgumentParser(description="S7 적재 CSV 생성 (HDFS → HDFS)")
    parser.add_argument("--catalog", required=True, help="S5 산출. excluded=false 만 쓴다")
    parser.add_argument("--coords", required=True, help="S3 산출. mbid + pc1..pc16")
    parser.add_argument("--meta", help="work/v2_meta.parquet 을 올린 경로. 없으면 album·연도를 비운다")
    parser.add_argument("--feats", nargs="+", required=True, help="v2_feats·v2_feats_pilot 둘 다 준다(D16)")
    parser.add_argument("--song-meta", dest="song_meta", help="v2_song_meta. 장르 코드(gnr)")
    parser.add_argument("--out", required=True, help="hdfs:///ody/data/ingest_csv")
    parser.add_argument("--expect-rows", type=int, help="music 행 수. 다르면 실패시킨다")
    parser.add_argument("--report", help="실행 증거 json 경로(로컬)")
    args = parser.parse_args()

    from pyspark.sql import SparkSession
    spark = SparkSession.builder.appName("ody-S7-ingest-csv").getOrCreate()
    started = time.time()
    try:
        report = build(spark, args)
    finally:
        spark.stop()
    report["duration_s"] = round(time.time() - started, 1)

    if args.expect_rows is not None and report["music_rows"] != args.expect_rows:
        raise SystemExit("music 행 수 {} != 기대 {}".format(report["music_rows"], args.expect_rows))
    text = json.dumps(report, ensure_ascii=False, indent=1)
    print(text)
    if args.report:
        io.open(args.report, "w", encoding="utf-8").write(text + "\n")


if __name__ == "__main__":
    main()
