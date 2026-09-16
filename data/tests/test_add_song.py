# -*- coding: utf-8 -*-
"""단건 증분 적재 검증 (Jira S15P21A405-376). 번들(model_bundle.npz)이 없는 머신은 skip."""
import copy
import os
import sys

import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "ingest"))

COHORT_VERSION = {"essentia": "2.1-beta2", "essentia_git_sha": "v2.1_beta2",
                  "essentia_build_sha": "70f2e5ece6736b2c40cc944ad0e695b16b925413", "extractor": "music 1.0"}
MBID = "09228673-a1c5-4bf7-8f55-fc4212c4a406"


@pytest.fixture(scope="module")
def S():
    import json
    current = json.load(open(os.path.join(ROOT, "serving", "CURRENT.json"), encoding="utf-8"))
    if not os.path.exists(os.path.join(ROOT, "serving", current["bundle"], "model_bundle.npz")):
        pytest.skip("model_bundle.npz 없음")
    import add_song
    return add_song


@pytest.fixture
def doc():
    """특징이 거의 없는 합성 문서. 결측은 impute 가 채우므로 좌표는 나온다."""
    return {"metadata": {"version": dict(COHORT_VERSION),
                         "audio_properties": {"lossless": False, "length": 220.4},
                         "tags": {"musicbrainz_recordingid": [MBID], "title": ["O'Test"], "artist": ["A"]}},
            "lowlevel": {}, "rhythm": {"bpm": 120.5}, "tonal": {}}


def test_coords_match_reference_bitwise(S, doc):
    import korean_common as KC
    song = S.song_from_doc(doc)
    X = KC.extract_270(doc)[None, :]
    ref = KC.serving_transform(X, np.array([False]))["pca"][0].astype(np.float32)
    assert song["coords"].shape == (16,)
    assert np.array_equal(song["coords"].view(np.uint32), ref.view(np.uint32))
    assert song["bpm"] == 120.5 and song["mbid"] == MBID


def test_sql_is_idempotent_and_escaped(S, doc):
    sql = S.insert_sql(S.song_from_doc(doc))
    assert sql.startswith("INSERT INTO music (id, mbid, title")
    assert "COALESCE(MAX(id), 0) + 1" in sql
    assert "WHERE NOT EXISTS (SELECT 1 FROM music WHERE mbid = '{}')".format(MBID) in sql
    assert "'O''Test'" in sql and "'::vector" in sql and "120.5" in sql and " 220," in sql


def test_foreign_extractor_rejected(S, doc):
    bad = copy.deepcopy(doc)
    bad["metadata"]["version"]["essentia"] = "2.1-beta1"
    with pytest.raises(S.AddSongError):
        S.song_from_doc(bad)
    assert S.song_from_doc(bad, allow_foreign=True)["fingerprint"] is None


def test_empty_title_rejected(S, doc):
    doc["metadata"]["tags"].pop("title")
    with pytest.raises(S.AddSongError):
        S.song_from_doc(doc)
    assert S.song_from_doc(doc, title="T")["title"] == "T"
