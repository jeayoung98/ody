# -*- coding: utf-8 -*-
"""신곡 증분 입력 준비 (Jira S15P21A405-600, D20). 번들(model_bundle.npz)이 없는 머신은 prepare 검사를 skip."""
import copy
import os
import sys
import uuid

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "spark"))

import prepare_new_songs as P  # noqa: E402

BETA2_NO_BUILD = {"essentia": "2.1-beta2", "essentia_git_sha": "v2.1_beta2-1-ge3940c0", "extractor": "music 1.0"}


@pytest.fixture(scope="module")
def fingerprints():
    return P.load_fingerprints()


def test_synthetic_mbid_is_deterministic_uuid5():
    a = P.synthetic_mbid("4617ab3b61818cd13b390f2e4ab3683c")
    assert a == P.synthetic_mbid("4617AB3B61818CD13B390F2E4AB3683C")
    assert P.UUID_RE.match(a) and uuid.UUID(a).version == 5
    assert a != P.synthetic_mbid("0" * 32)


def test_tagged_mbid_wins_over_synthetic():
    doc = {"metadata": {"tags": {"musicbrainz_recordingid": ["09228673-A1C5-4BF7-8F55-FC4212C4A406"]},
                        "audio_properties": {"md5_encoded": "ab"}}}
    assert P.song_mbid(doc) == ("09228673-a1c5-4bf7-8f55-fc4212c4a406", False)
    doc["metadata"]["tags"] = {}
    assert P.song_mbid(doc) == (P.synthetic_mbid("ab"), True)
    doc["metadata"]["audio_properties"] = {}
    with pytest.raises(P.NewSongError):
        P.song_mbid(doc)


def test_fingerprint_exact_match_keeps_non_cohort_number(fingerprints):
    """판정은 S5 R4 가 한다. 여기서는 번호만 찾는다 — 96 은 코호트 밖이지만 번호는 96 이다."""
    v96 = dict(zip(P.FP_KEY_COLUMNS, fingerprints[96]))
    assert P.resolve_fingerprint(v96, fingerprints, True) == (96, False)


def test_missing_build_sha_maps_to_first_cohort_fp_in_rank(fingerprints):
    # e3940c0 은 72·73(코호트)과 96(코호트 밖)이 공유한다. FP_RANK 순서상 72 가 먼저다.
    assert P.resolve_fingerprint(BETA2_NO_BUILD, fingerprints, True) == (72, True)
    assert P.resolve_fingerprint(BETA2_NO_BUILD, fingerprints, False) == (None, False)


def test_missing_build_sha_outside_cohort_stays_unresolved(fingerprints):
    beta1 = {"essentia": "2.1-beta1", "essentia_git_sha": "v2.1_beta1-28-g21ef5f4", "extractor": "music 1.0"}
    assert P.resolve_fingerprint(beta1, fingerprints, True) == (None, False)


def test_inferred_fingerprint_passes_r4_as_written():
    """D20 는 지문 해석만 넓힌다. R4 판정 목록은 그대로이고, 해석된 72 가 그 목록에 있어야 S5 를 지난다."""
    rules, _ = P.load_rules()
    assert P.ACCEPT_MISSING_BUILD_SHA is True
    assert "accept_missing_build_sha" not in rules["R4_cohort"]["params"]
    assert 72 in rules["R4_cohort"]["params"]["fingerprints"]


@pytest.fixture(scope="module")
def bundle():
    import json
    current = json.load(open(os.path.join(ROOT, "serving", "CURRENT.json"), encoding="utf-8"))
    if not os.path.exists(os.path.join(ROOT, "serving", current["bundle"], "model_bundle.npz")):
        pytest.skip("model_bundle.npz 없음")
    return P.S2.load_bundle()


@pytest.fixture
def doc():
    return {"metadata": {"version": dict(BETA2_NO_BUILD),
                         "audio_properties": {"lossless": 0, "length": 185.0, "sample_rate": 48000,
                                              "codec": "aac", "bit_rate": 413465, "md5_encoded": "abc"},
                         "tags": {}},
            "lowlevel": {}, "rhythm": {"bpm": 92.8}, "tonal": {}}


def test_prepare_rows_match_s5_schema(bundle, doc):
    rules, _ = P.load_rules()
    raw, row, report = P.prepare(doc, "Perk Up", "현서 (HYUN SEO)", rules=rules, bundle=bundle)
    assert raw["mbid"] == row["mbid"] == P.synthetic_mbid("abc")
    assert raw["fingerprint"] == row["fingerprint"] == 72 and report["fingerprint_without_build_sha"]
    assert raw["lossless"] is False and raw["lowlevel"] == {}          # 원본 문서는 그대로 싣는다
    assert set(P.RAW_META) <= set(raw)
    assert row["artist_norm"] == "현서" and row["canonical"] == row["mbid"]
    frame = P.meta_frame([row], rules)
    assert list(frame.columns) == [c for c in P.S5IN.required_columns(rules) if c not in P.S5IN.PC]
    table = P.meta_table(frame)
    assert str(table.schema.field("a5_keywords").type) == "list<item: string>"   # list<null> 이면 S5 배열 함수가 깨진다
    assert table.column("part").null_count == 1 and str(table.schema.field("fingerprint").type) == "int16"


def test_prepare_requires_title(bundle, doc):
    with pytest.raises(P.NewSongError):
        P.prepare(doc, "", "A", bundle=bundle)


def test_n_clipped_counts_like_a4(bundle):
    """A4 정의: clip 직전 |Z| > clip. skew 없는 특징 하나를 center 에서 clip+1 배 scale 만큼 밀면 정확히 하나 는다."""
    center = [float(c) for c in bundle["scaler_center"]]
    j = next(i for i, name in enumerate(bundle["kept"]) if not bundle["skew"].get(name))
    pushed = copy.copy(center)
    pushed[j] = center[j] + float(bundle["scaler_scale"][j]) * (bundle["clip"] + 1)
    assert P.n_clipped(pushed, True, bundle) == P.n_clipped(center, True, bundle) + 1


def test_album_table_matches_v2_meta_columns():
    """S7 은 --meta 에서 mbid·album·release_year·albumid 를 읽는다. 빈 앨범은 NULL."""
    table = P.album_table([{"mbid": "a", "album": " 2/4 "}, {"mbid": "b", "album": ""}])
    assert table.column_names == ["mbid", "album", "release_year", "albumid"]
    assert table.column("album").to_pylist() == ["2/4", None]
    assert table.column("release_year").null_count == 2
