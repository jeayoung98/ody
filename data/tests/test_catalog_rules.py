# -*- coding: utf-8 -*-
"""S5 카탈로그 제외 규칙 패리티 (spec 20, Jira S15P21A405-128).

    S1 대표행 7,404,506  →  규칙 R1~R9  →  제외 780,107  →  남는 곡 6,624,399   (v4 카탈로그)
    그 위에 v5(R10~R17 + R1·R5~R9 강화)  →  남는 곡 4,688,786

기준은 `work/catalog_v2.parquet` 이다. **그 파일을 만든 규칙 버전에서만 대조가 성립한다** —
`rules_hash` 가 현재 `exclusion_rules.json` 과 다르면 패리티 검사는 skip 한다(v5 를 적용해도
카탈로그를 다시 만들기 전까지는 판정이 다른 게 정상이기 때문이다). 원본 numpy 파이프라인(`pipeline/exclusion_apply.py`)이
실제로 만든 판정이 거기 `excluded`·`excluded_reason[]` 로 들어 있고, 이 테스트는 이식 구현이
같은 판정을 내는지 대조한다. 대용량이 없는 머신에서는 skip 한다.

무엇을 어떻게 검증하는가
- 행 단위 규칙(R2·R3·R4·R7·R9, R1 짧은 곡): 표본 8,000행 전수 비교
- R1 긴 곡: 실제 태그(`genres_raw`)를 읽어 20분·30분 상한과 예외 태그를 비교
- R8: 실제 특징 파일의 3개 컬럼으로 재계산. 분위값은 원본이 기록한 값을 넣는다(아래 참조)
- R5: canonical 묶음 200개에서 대표가 접히지 않고, 보호된 멤버는 좌표 거리가 임계 초과
- R6: 묶음 200개에서 묶음 분할과 대표 선정이 기준과 완전히 같음

## R8 분위값도 직접 계산해 대조한다 (2026-09-11 정정)
전에는 기록값을 주입했다. `work/v2_feats` 만 읽어 28파트(6,617,603행)로 계산하니 8.011e-05 가
나왔고 원본 기록 8.517e-05 와 달랐기 때문이다. **파트가 빠진 게 아니라 디렉터리를 하나 덜 읽은
것이었다.** part10·part24 는 `work/v2_feats_pilot` 에 있다(원본 `exclusion_apply.py` 도 두
디렉터리를 순회한다). 30파트 7,404,506행으로 계산하면 **8.517061680322513e-05** 로 원본과
정확히 같다. 이제 주입 없이 대조한다.
"""
import collections
import os
import sys

import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "spark", "jobs"))
sys.path.insert(0, os.path.join(ROOT, "pipeline"))

import catalog_rules as S5  # noqa: E402

# 기준 카탈로그는 **v5 를 v2.1 번들 위에 올린 2단계 산출물**이다(D18, AGENTS.md 규칙 2 단서).
# 그래서 행 수가 manifest 7,404,506 이 아니라 v3 를 지난 6,624,399 다. v3 카탈로그는
# work/catalog_v2_v3_2026-09-16.parquet 에 남아 있다.
CATALOG_ROWS = 6_624_399
TOTAL_EXCLUDED = 1_930_196         # output/exclusion_report.json (2026-09-16, v5)
R6_GROUPS_MULTI = 208_508          # v5: R5 가 전부 접은 뒤 남은 다중 묶음
R1_LONG_ROWS = 914_728             # v5: 6분(360s) 초과. 예외 태그 없음
R8_LOUDNESS_QUANTILE = 8.70464301406173e-05   # 모집단이 662만이라 v3 의 8.517e-05 와 다르다
R8_HITS = 6_625                    # v5 R8 적중(무조건 분기 포함)
FEATURE_DIRS = ("v2_feats", "v2_feats_pilot")          # 파일럿에 part10·part24 가 있다
SAMPLE_ROWS = 8000
SAMPLE_GROUPS = 200
FEATURE_COLUMNS = ("lowlevel.average_loudness", "lowlevel.dynamic_complexity",
                   "lowlevel.silence_rate_60dB.mean")


@pytest.fixture(scope="module")
def rules_pair():
    return S5.load_rules()


# --- 설정만 필요한 검사 ------------------------------------------------------

def test_rules_come_from_json_only(rules_pair):
    """임계값은 JSON 에서만 온다. 잡 소스에 숫자를 적지 않는다(규칙 9)."""
    rules, digest = rules_pair
    assert list(rules) == ["R1_length", "R2_nonmusic", "R3_no_key", "R4_cohort", "R5_dup_canonical",
                           "R6_dup_version", "R7_samplerate", "R8_silence", "R9_corrupt",
                           "R10_title_noise", "R11_test_signal", "R12_spoken_nonmusic",
                           "R13_audiobook", "R15_static", "R16_title_nonmusic", "R17_artist_unknown"]
    assert rules["R10_title_noise"]["enabled"] is True
    assert len(rules["R10_title_noise"]["params"]["patterns"]) == 5
    assert rules["R7_samplerate"]["enabled"] is True, "v5 에서 제외로 전환"
    assert rules["R9_corrupt"]["enabled"] is True, "v5 에서 제외로 전환"
    assert rules["R5_dup_canonical"]["params"]["protect_dist"] is None, "v5: 중복 전부 접기"
    assert rules["R6_dup_version"]["params"]["protect_dist"] is None, "v5: 중복 전부 접기"
    assert len(digest) == 16

    source = open(os.path.join(ROOT, "spark", "jobs", "catalog_rules.py"), encoding="utf-8").read()
    body = source.split('"""', 2)[2]                     # 모듈 docstring 의 설명 수치는 제외
    for literal in ("1200", "1800", "44100", "4.0", "0.9"):
        assert literal not in body, "임계값 {} 가 코드에 하드코딩돼 있다".format(literal)


def test_low_quality_rules_exclude_and_flag(rules_pair):
    """v5: R7·R9 는 제외하면서 flag 컬럼도 계속 만든다(규칙 2 의 표시는 유지)."""
    rules, _ = rules_pair
    row = {"sample_rate": 22050.0, "n_clipped_features": 9, "title_raw": "t", "artist_raw": "a",
           "fingerprint": 74, "length": 200.0}
    masks = S5.row_masks(row, rules)
    assert masks["R7_samplerate"] is True
    assert masks["R9_corrupt"] is True
    flags = S5.row_flags(row, rules)
    assert flags["flag_low_sr"] is True
    assert flags["flag_clipped"] is True


def test_fold_group_protects_far_members(rules_pair):
    """protect_dist 가 있으면 먼 멤버를 보호하고, None(v5)이면 전부 접는다."""
    rules, _ = rules_pair
    protect = 4.0                       # 이 검사만의 값. JSON 의 v5 값은 None 이라 아래에서 따로 본다
    zero = [0.0] * 16
    near, far = list(zero), list(zero)
    near[0] = protect - 0.5
    far[0] = protect + 0.5
    rows = [{"i": 0, "coords": zero, "lossless": True, "part": 0, "offset": 0},
            {"i": 1, "coords": near, "lossless": True, "part": 1, "offset": 0},
            {"i": 2, "coords": far, "lossless": True, "part": 2, "offset": 0}]
    rep, folded = S5.fold_group(rows, S5.r5_order_key, protect)
    assert rep == 0
    assert folded == {1}
    rep, folded = S5.fold_group(rows, S5.r5_order_key, rules["R6_dup_version"]["params"]["protect_dist"])
    assert rep == 0
    assert folded == {1, 2}, "v5 는 거리 보호 없이 전부 접는다"


def test_representative_order_keys():
    """대표 순서: R5 는 lossless→part→offset, R6 는 수식어 없음→lossless→제출본→part→offset."""
    base = {"lossless": True, "part": 0, "offset": 0, "n_submissions": 1, "no_modifier": True}
    def r5(**kw): return S5.r5_order_key(dict(base, **kw))
    assert r5() < r5(lossless=False)
    assert r5() < r5(part=1)
    assert r5() < r5(offset=1)
    def r6(**kw): return S5.r6_order_key(dict(base, **kw))
    assert r6() < r6(no_modifier=False)
    assert r6() < r6(lossless=False)
    assert r6(n_submissions=9) < r6(n_submissions=2), "제출본 많은 쪽이 대표"


def test_group_key_is_empty_without_artist_or_title():
    assert S5.r6_group_key("", "Song") == ""
    assert S5.r6_group_key("artist", "") == ""
    assert S5.r6_group_key("artist", "!!!") == "", "정규화 후 남는 글자가 없으면 묶지 않는다"
    assert S5.r6_group_key("artist", "Song (2011 Remaster)") == "artist||song"


R10_HITS = [None, "[untitled]", "untitled", "Untitled 3", "Untitled #12", "", "  ", "...", "$",
            "Track 01", "Track 7", "Pista 3", "Titel 08", "Intro", "Outro (Prod. 8Cee)", "Interlude",
            "Skit 2", "Unknown", "Unknown Track", "Sans Titre", "無題", "제목 없음"]
R10_KEEP = ["Untitled Love Song", "Untitled (How Does It Feel)", "Introspection", "Track of Time",
            "Unknown Soldier", "Unknown Pleasures", "1999", "22", "7", "Intro to the Blues",
            "Skit Skat", "夏", "Us", "Time"]


def test_r10_title_noise_samples(rules_pair):
    """R10 은 제목이 곡을 식별하지 못하는 행만 잡는다. 진짜 곡 제목은 통과한다."""
    rules, _ = rules_pair
    for title in R10_HITS:
        assert S5.row_masks({"title_raw": title}, rules)["R10_title_noise"], title
    for title in R10_KEEP:
        assert not S5.row_masks({"title_raw": title}, rules)["R10_title_noise"], title


R11_HITS = ["1000 Hz Test Tone", "Test Signal", "Frequency Sweep", "440 Hz", "20 kHz"]
# v5 실측(2026-09-16): sine wave·white noise 패턴은 실제 곡을 집어서 뺐다. 이 제목들은 통과해야 한다.
R11_KEEP = ["Sine of the Times", "Noise Pollution", "Test Drive", "Sweep the Leg",
            "White Noise", "Sine Wave", "Clouds In The White Noise"]
R16_HITS = ["Intro", "The Best Intro Ever", "Band Interview 1998", "Guided Meditation",
            "DJ Mix Vol. 3", "Full Album", "Station ID", "Silence"]
R16_KEEP = ["Introduction to Love", "Interviewer", "Mixtapes and Memories".replace("Mixtape", "Tape"),
            "Silent Night", "Testify"]
R13_HITS = [{"title_raw": "Chapter 12"}, {"title_raw": "Hoerbuch Teil 3"},
            {"title_raw": "Moby Dick (Unabridged)"}, {"artist_raw": "read by Stephen Fry"},
            {"a5_keywords": ["audiobook"]}]
R13_KEEP = [{"title_raw": "Chapter of Life"}, {"artist_raw": "Reader"}, {"title_raw": "Teil"}]
R17_HITS = ["", "Unknown", "[unknown]", "Various Artists", "(traditional)", "Anonymous", "?"]
R17_KEEP = ["Unknown Mortal Orchestra", "Various Cruelties", "Tradition", "The Anonymous Choir"]


def test_r11_test_signal_samples(rules_pair):
    rules, _ = rules_pair
    for title in R11_HITS:
        assert S5.row_masks({"title_raw": title}, rules)["R11_test_signal"], title
    for title in R11_KEEP:
        assert not S5.row_masks({"title_raw": title}, rules)["R11_test_signal"], title


def test_r16_title_keywords_need_word_boundary(rules_pair):
    rules, _ = rules_pair
    for title in R16_HITS:
        assert S5.row_masks({"title_raw": title}, rules)["R16_title_nonmusic"], title
    for title in R16_KEEP:
        assert not S5.row_masks({"title_raw": title}, rules)["R16_title_nonmusic"], title


def test_r13_audiobook_samples(rules_pair):
    rules, _ = rules_pair
    for row in R13_HITS:
        assert S5.row_masks(row, rules)["R13_audiobook"], row
    for row in R13_KEEP:
        assert not S5.row_masks(row, rules)["R13_audiobook"], row


def test_r17_artist_unknown_samples(rules_pair):
    rules, _ = rules_pair
    for artist in R17_HITS:
        assert S5.row_masks({"artist_raw": artist}, rules)["R17_artist_unknown"], artist
    for artist in R17_KEEP:
        assert not S5.row_masks({"artist_raw": artist}, rules)["R17_artist_unknown"], artist


def test_r12_spoken_tags_now_exclude(rules_pair):
    """v3 에서 flag 로 돌렸던 세 태그가 v5 에서는 제외다. flag 컬럼도 그대로 남는다."""
    rules, _ = rules_pair
    row = {"a5_keywords": ["spoken word"], "title_raw": "t", "artist_raw": "a"}
    assert S5.row_masks(row, rules)["R12_spoken_nonmusic"] is True
    assert S5.row_flags(row, rules)["flag_spoken"] is True


def test_r15_static_uses_quantiles(rules_pair):
    """R15 는 분위값이 없으면 판정하지 않고, 있으면 하위 1% 전부 또는 하위 2%+느린 onset 을 잡는다."""
    rules, _ = rules_pair
    p = rules["R15_static"]["params"]
    quantiles = {name: (0.1, 0.2) for name in p["features"]}
    quantiles[p["onset_feature"]] = 0.5
    low = {name: 0.05 for name in p["features"]}
    mid = {name: 0.15 for name in p["features"]}
    assert S5.row_masks(dict(low), rules, quantiles=quantiles)["R15_static"] is True
    assert S5.row_masks(dict(mid, **{p["onset_feature"]: 0.4}), rules, quantiles=quantiles)["R15_static"] is True
    assert S5.row_masks(dict(mid, **{p["onset_feature"]: 9.0}), rules, quantiles=quantiles)["R15_static"] is False
    assert S5.row_masks(dict(low), rules)["R15_static"] is False, "분위값 없으면 판정 없음"


def test_job_imports_without_pyspark():
    assert S5.PC[0] == "pc1" and len(S5.PC) == 16
    assert "flag_low_sr" in S5.FLAG_COLUMNS


# --- 실제 데이터 ------------------------------------------------------------

@pytest.fixture(scope="module")
def work(root):
    path = os.environ.get("ODY_WORK") or os.path.join(root, "work")
    if not os.path.exists(os.path.join(path, "catalog_v2.parquet")):
        pytest.skip("work/catalog_v2.parquet 없음")
    return path


def numpy_rules_hash():
    """`pipeline/exclusion_apply.py` 가 카탈로그에 적는 해시. 파일 바이트의 sha256 앞 16자다."""
    import hashlib
    path = os.path.join(ROOT, "pipeline", "exclusion_rules.json")
    return hashlib.sha256(open(path, "rb").read()).hexdigest()[:16]


@pytest.fixture(scope="module")
def catalog(work):
    import pyarrow.parquet as pq
    parquet = pq.ParquetFile(os.path.join(work, "catalog_v2.parquet"))
    if "rules_hash" in parquet.schema_arrow.names:
        written = parquet.read_row_group(0, columns=["rules_hash"]).column("rules_hash")[0].as_py()
        if written != numpy_rules_hash():
            pytest.skip("catalog_v2 는 규칙 {} 산출물이고 현재 규칙은 {} 다. "
                        "s1_apply 로 카탈로그를 다시 만든 뒤 대조한다".format(written, numpy_rules_hash()))
    return parquet


@pytest.fixture(scope="module")
def audit(work):
    """A5 키워드 적중과 A4 클리핑 수. 둘 다 작은 파일이라 전부 읽는다."""
    import pyarrow.parquet as pq
    keywords = collections.defaultdict(set)
    for row in pq.read_table(os.path.join(work, "audit_A5_hits.parquet")).to_pylist():
        keywords[row["mbid"].lower()].add(row["keyword"])
    clipped = {row["mbid"].lower(): int(row["n_clipped_features"])
               for row in pq.read_table(os.path.join(work, "audit_A4_clipped.parquet")).to_pylist()}
    return keywords, clipped


def _gather(catalog, indices, columns):
    """전역 행 번호로 카탈로그 행을 모은다. 행 그룹별로 필요한 것만 읽는다."""
    rows, start = [], 0
    indices = np.asarray(indices)
    for rg in range(catalog.metadata.num_row_groups):
        count = catalog.metadata.row_group(rg).num_rows
        local = indices[(indices >= start) & (indices < start + count)] - start
        if len(local):
            rows.extend(catalog.read_row_group(rg, columns=columns).take(local).to_pylist())
        start += count
    return rows


def _artist_norm(work, wanted):
    """v2_song_meta 에서 필요한 mbid 의 artist_norm 만 뽑는다. R6 묶음 키의 절반이다."""
    import pyarrow.parquet as pq
    out = {}
    meta = pq.ParquetFile(os.path.join(work, "v2_song_meta.parquet"))
    for rg in range(meta.metadata.num_row_groups):
        table = meta.read_row_group(rg, columns=["mbid", "artist_norm"])
        for mbid, artist in zip(table.column("mbid").to_pylist(), table.column("artist_norm").to_pylist()):
            mbid = mbid.lower()
            if mbid in wanted:
                out[mbid] = artist
    return out


R10_HITS_TOTAL = 33_646            # v5 카탈로그(base 6,624,399) 실측 2026-09-16


def test_r10_counts_match_basis(catalog, rules_pair):
    """R10 적중 수가 기준 카탈로그와 같고, 적중한 행은 전부 R10 사유로 제외돼 있다."""
    rules, _ = rules_pair
    rule = rules["R10_title_noise"]
    total = tagged = 0
    for rg in range(catalog.metadata.num_row_groups):
        table = catalog.read_row_group(rg, columns=["title_raw", "excluded_reason"])
        for title, reasons in zip(table.column("title_raw").to_pylist(),
                                  table.column("excluded_reason").to_pylist()):
            if S5.is_title_noise(title, rule):
                total += 1
                tagged += "R10_title_noise" in set(reasons or ())
    assert total == R10_HITS_TOTAL
    assert tagged == total, "R10 적중인데 사유에 R10 이 없는 행이 있다"
    assert TOTAL_EXCLUDED / CATALOG_ROWS < rules_json_stop_threshold()


def rules_json_stop_threshold():
    """중단 임계도 JSON 에서만 읽는다. v5 는 0.40 이다(D18)."""
    import json
    return json.load(open(os.path.join(ROOT, "pipeline", "exclusion_rules.json"),
                          encoding="utf-8"))["stop_if_total_excluded_share"]


def test_catalog_row_count(catalog):
    assert catalog.metadata.num_rows == CATALOG_ROWS


def _catalog_audit():
    """pipeline/catalog_audit.py 를 r6_key 하나 때문에 불러온다.

    그 모듈은 상단에서 `korean_common` 을 불러오고 그쪽이 다시 `feature_spec` 과 서빙 번들을
    요구한다. r6_key 는 둘 다 쓰지 않으므로 import 가 막히면 빈 스텁을 끼워 넣는다.
    """
    try:
        import catalog_audit
    except (ImportError, OSError, KeyError):
        import types
        stub = types.ModuleType("korean_common")
        stub.KEPT, stub.apply_skew = [], None
        sys.modules.setdefault("korean_common", stub)
        import catalog_audit
    return catalog_audit


def test_r6_key_matches_catalog_audit(catalog):
    """제목 정규화가 pipeline/catalog_audit.py 의 r6_key 와 실제 제목에서 완전히 같아야 한다.

    잡은 실행기에서 pandas import 를 피하려고 정규식을 복제한다. 이 검사가 그 복제를 묶는다.
    """
    catalog_audit = _catalog_audit()
    assert S5.DROP_MODS == catalog_audit.DROP_MODS
    assert S5.DISTINCT_MODS == catalog_audit.DISTINCT_MODS
    titles = catalog.read_row_group(0, columns=["title_raw"]).column("title_raw").to_pylist()
    rng = np.random.default_rng(21)
    for i in rng.choice(len(titles), 5000, replace=False):
        title = titles[int(i)]
        assert S5.r6_key(title) == catalog_audit.r6_key(title), title


def test_row_rules_match_catalog(catalog, audit, rules_pair):
    """행 단위 규칙 판정이 기준 카탈로그의 excluded_reason 과 같다."""
    rules, _ = rules_pair
    keywords, clipped = audit
    columns = ["mbid", "title_raw", "artist_raw", "length", "sample_rate", "fingerprint",
               "excluded", "excluded_reason"]
    table = catalog.read_row_group(0, columns=columns)
    rng = np.random.default_rng(11)
    rows = table.take(rng.choice(table.num_rows, SAMPLE_ROWS, replace=False)).to_pylist()
    del table

    checked = 0
    for row in rows:
        row["a5_keywords"] = keywords.get(row["mbid"], ())
        row["n_clipped_features"] = clipped.get(row["mbid"], 0)
        masks = S5.row_masks(row, rules)
        reasons = set(row["excluded_reason"] or ())
        for rid in ("R2_nonmusic", "R3_no_key", "R4_cohort", "R7_samplerate", "R9_corrupt"):
            assert masks[rid] == (rid in reasons), (rid, row["mbid"])
        if row["length"] is not None and row["length"] < rules["R1_length"]["params"]["min_s"]:
            assert masks["R1_length"] and "R1_length" in reasons, row["mbid"]
        checked += 1
    assert checked == SAMPLE_ROWS


def test_r1_long_songs_use_real_tags(catalog, work, rules_pair):
    """v5: 상한(6분)을 넘으면 태그와 무관하게 전부 제외다. 예외 태그 목록이 비어 있음을 함께 본다."""
    import pyarrow.parquet as pq
    rules, _ = rules_pair
    params = rules["R1_length"]["params"]
    long_rows = []
    for rg in range(catalog.metadata.num_row_groups):
        table = catalog.read_row_group(rg, columns=["mbid", "length", "excluded_reason"])
        length = table.column("length").to_numpy(zero_copy_only=False)
        hit = np.flatnonzero(np.isfinite(length) & (length > params["max_s"]))
        if len(hit):
            long_rows.extend(table.take(hit).to_pylist())
    assert len(long_rows) == R1_LONG_ROWS

    rng = np.random.default_rng(5)
    picked = [long_rows[int(i)] for i in rng.choice(len(long_rows), 150, replace=False)]
    wanted = {row["mbid"] for row in picked}
    tags = collections.defaultdict(set)
    genres = pq.ParquetFile(os.path.join(work, "genres_raw.parquet"))
    for rg in range(genres.metadata.num_row_groups):
        table = genres.read_row_group(rg, columns=["mbid", "genre"])
        for mbid, genre in zip(table.column("mbid").to_pylist(), table.column("genre").to_pylist()):
            mbid = mbid.lower()
            if mbid in wanted:
                tags[mbid].update(str(g).lower() for g in (genre or ()))

    for row in picked:
        got = S5.r1_length({"length": row["length"]}, rules["R1_length"], tags.get(row["mbid"], ()))
        assert got is True, (row["mbid"], row["length"])          # v5 는 예외가 없다
        assert "R1_length" in set(row["excluded_reason"] or ()), (row["mbid"], row["length"])
    assert not params.get("long_exempt_tags"), "v5 는 예외 태그를 두지 않는다(D18)"
    assert any(tags.values()), "표본에 태그 있는 곡이 하나도 없으면 태그 경로를 못 본 것이다"


def test_r8_silence_matches_catalog(catalog, work, rules_pair):
    """R8 판정이 기준과 완전히 같다. 분위값도 30파트로 직접 계산해 대조한다."""
    import pyarrow.parquet as pq
    rules, _ = rules_pair
    dirs = [os.path.join(work, name) for name in FEATURE_DIRS]
    if not any(os.path.isdir(d) for d in dirs):
        pytest.skip("특징 디렉터리 없음")
    features = {}
    loudness = []
    for feats_dir in dirs:
        if not os.path.isdir(feats_dir):
            continue
        for name in sorted(os.listdir(feats_dir)):
            if not name.endswith(".parquet"):
                continue
            table = pq.read_table(os.path.join(feats_dir, name),
                                  columns=["mbid"] + list(FEATURE_COLUMNS))
            columns = [table.column(c).to_numpy(zero_copy_only=False) for c in FEATURE_COLUMNS]
            loudness.append(np.asarray(columns[0], dtype=np.float64))
            for mbid, loud, dyn, sil in zip(table.column("mbid").to_pylist(), *columns):
                features[mbid.lower()] = (float(loud), float(dyn), float(sil))

    # 분위값을 직접 계산해 기록과 대조한다(주입하지 않는다).
    # 모집단은 **기준 카탈로그의 곡**이다. 특징 파일에는 이전 단계가 자른 곡도 들어 있어서
    # 전부 넣으면 v3 값(8.517e-05)이 나온다. 2단계 산출물의 분위는 base 곡으로만 잰다(D18).
    params = rules["R8_silence"]["params"]
    catalog_mbids = set()
    for rg in range(catalog.metadata.num_row_groups):
        catalog_mbids.update(m.lower() for m in catalog.read_row_group(rg, columns=["mbid"]).column("mbid").to_pylist())
    population = np.array([features[m][0] for m in catalog_mbids if m in features], dtype=np.float64)
    quantile = float(np.nanpercentile(population, params["loudness_bottom_pct"]))
    assert quantile == R8_LOUDNESS_QUANTILE,         "30파트 분위값 {} 가 원본 기록과 다르다. 디렉터리를 다 읽었는지 보라".format(quantile)

    # v5 는 음량 하위 hard_loudness_bottom_pct 를 조건 없이 자른다. 그 분위도 직접 계산한다.
    hard_pct = params.get("hard_loudness_bottom_pct")
    hard_q = None if hard_pct is None else float(np.nanpercentile(population, hard_pct))
    recomputed = {mbid for mbid, (loud, dyn, sil) in features.items()
                  if mbid in catalog_mbids
                  and S5._r8({"loudness": loud, "dyn_complexity": dyn, "silence60": sil},
                             params, quantile, hard_q)}
    truth = set()
    for rg in range(catalog.metadata.num_row_groups):
        table = catalog.read_row_group(rg, columns=["mbid", "excluded_reason"])
        for mbid, reasons in zip(table.column("mbid").to_pylist(),
                                 table.column("excluded_reason").to_pylist()):
            if reasons and "R8_silence" in reasons:
                truth.add(mbid.lower())

    assert recomputed == truth, "R8 판정이 기준 카탈로그와 완전히 같아야 한다"
    assert len(recomputed) == R8_HITS, "output/exclusion_report.json 의 R8 적중 수"


def test_r5_representative_is_never_folded(catalog, rules_pair):
    """canonical 묶음의 대표는 접히지 않는다. v5 는 거리 보호가 없어 나머지 멤버는 전부 접힌다."""
    import pyarrow.parquet as pq
    rules, _ = rules_pair
    protect = rules["R5_dup_canonical"]["params"].get("protect_dist")
    canonical = []
    for rg in range(catalog.metadata.num_row_groups):
        canonical.extend(catalog.read_row_group(rg, columns=["canonical"]).column("canonical").to_pylist())
    counts = collections.Counter(canonical)
    multi = [key for key, n in counts.items() if n >= 2]
    rng = np.random.default_rng(4)
    picked = {multi[int(i)] for i in rng.choice(len(multi), SAMPLE_GROUPS, replace=False)}
    indices = [i for i, key in enumerate(canonical) if key in picked]
    del canonical, counts

    rows = _gather(catalog, indices, ["mbid", "canonical", "lossless", "part", "offset", "excluded_reason"])
    groups = collections.defaultdict(list)
    for row in rows:
        groups[row["canonical"]].append(row)

    protected = []
    for members in groups.values():
        rep = sorted(members, key=S5.r5_order_key)[0]
        assert "R5_dup_canonical" not in set(rep["excluded_reason"] or ()), rep["mbid"]
        for row in members:
            if row["mbid"] != rep["mbid"] and "R5_dup_canonical" not in set(row["excluded_reason"] or ()):
                protected.append((rep["mbid"], row["mbid"]))
    assert len(groups) == SAMPLE_GROUPS

    if protect is None:
        # v5(D18): 거리 보호를 없앴다. 대표가 아닌 멤버는 좌표 거리와 무관하게 전부 접힌다.
        assert protected == [], "protect_dist 가 None 인데 접히지 않은 멤버가 있다"
        return

    # protect_dist 가 있을 때만 거리로 확인한다. 접힌 멤버는 서빙 좌표에서 빠져 다시 볼 수 없다.
    wanted = {mbid for pair in protected for mbid in pair}
    coords = {}
    bundle = os.path.join(ROOT, "serving", "v2.1-pca16", "coords_v2.parquet")
    if not os.path.exists(bundle):
        pytest.skip("좌표 번들 없음")
    coord_file = pq.ParquetFile(bundle)
    for rg in range(coord_file.metadata.num_row_groups):
        table = coord_file.read_row_group(rg, columns=["mbid"] + S5.PC)
        mbids = table.column("mbid").to_pylist()
        hit = [i for i, mbid in enumerate(mbids) if mbid.lower() in wanted]
        if hit:
            matrix = np.column_stack([table.column(pc).to_numpy(zero_copy_only=False) for pc in S5.PC])
            for i in hit:
                coords[mbids[i].lower()] = matrix[i]

    checked = 0
    for rep, member in protected:
        if rep in coords and member in coords:
            assert S5.dist(coords[rep], coords[member]) > protect, (rep, member)
            checked += 1
    assert checked > 50, "보호된 멤버 쌍을 {}개만 확인했다".format(checked)


def test_r6_groups_and_representative_match_catalog(catalog, work):
    """R6 묶음 분할과 대표 선정이 기준과 완전히 같다.

    `dup_group_id` 의 정수 값은 비교하지 않는다. 원본은 pandas.factorize 등장 순서 코드이고
    잡은 묶음 키의 xxhash64 를 쓴다. 같아야 하는 것은 **묶음 분할**이다.
    """
    group_ids = []
    for rg in range(catalog.metadata.num_row_groups):
        group_ids.append(catalog.read_row_group(rg, columns=["dup_group_id"]).column("dup_group_id").to_numpy())
    group_ids = np.concatenate(group_ids)
    values, counts = np.unique(group_ids[group_ids >= 0], return_counts=True)
    multi = values[counts >= 2]
    assert len(multi) == R6_GROUPS_MULTI

    rng = np.random.default_rng(3)
    picked = multi[rng.choice(len(multi), SAMPLE_GROUPS, replace=False)]
    indices = np.flatnonzero(np.isin(group_ids, picked))
    rows = _gather(catalog, indices, ["mbid", "title_raw", "lossless", "part", "offset",
                                      "n_submissions", "dup_group_id", "is_representative"])
    artists = _artist_norm(work, {row["mbid"] for row in rows})

    mine, truth = collections.defaultdict(set), collections.defaultdict(set)
    for row in rows:
        key = S5.r6_group_key(artists.get(row["mbid"]), row["title_raw"])
        assert key, row["mbid"]                          # 묶음에 들어간 행은 키가 있어야 한다
        mine[key].add(row["mbid"])
        truth[row["dup_group_id"]].add(row["mbid"])
    assert {frozenset(v) for v in mine.values()} == {frozenset(v) for v in truth.values()}

    by_group = collections.defaultdict(list)
    for row in rows:
        row["no_modifier"] = S5.has_no_modifier(row["title_raw"])
        by_group[row["dup_group_id"]].append(row)
    for members in by_group.values():
        rep = sorted(members, key=S5.r6_order_key)[0]
        recorded = [row["mbid"] for row in members if row["is_representative"]]
        assert recorded == [rep["mbid"]], (recorded, rep["mbid"])
