# -*- coding: utf-8 -*-
"""여정 벤치 (spec 11 AC1·AC4, Jira S15P21A405-118).

실제 번들이 있어야 한다. 팀 clone 에서는 돌지 않으므로 pytest 대상이 아니고 수동 실행이다.

    PYTHONUTF8=1 .venv/Scripts/python.exe tests/bench_journey.py --pairs 100

결과는 `output/bench_journey_<번들>.json`.
"""
import argparse
import io
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from retrieval import artifact, postprocess  # noqa: E402
from retrieval import journey as J           # noqa: E402

TAU_FAR_PAIR = 10.7      # D3


def summarize(values):
    if not values:
        return None
    a = np.asarray(values, dtype=float)
    return {"n": int(a.size), "p50": float(np.percentile(a, 50)),
            "p95": float(np.percentile(a, 95)), "max": float(a.max()),
            "mean": float(a.mean())}


def run(pairs=100, seed=42, n_stations=10):
    bundle = artifact.load()
    meta = postprocess.meta_from_bundle(bundle)
    rules = bundle.rules
    cap = rules["artist_cap"]["value"]
    lo, hi = rules["length_range_s"]["min"], rules["length_range_s"]["max"]

    rng = np.random.default_rng(seed)
    candidates = np.flatnonzero(bundle.boolean["is_bridge"] & bundle.serve_mask)
    report = {"bundle": bundle.version, "pairs": pairs, "seed": seed,
              "n_stations_requested": n_stations, "modes": {}}

    for mode in ("axis", "linear"):
        latency, step_median, violations, unreachable = [], [], 0, 0
        far_count, monotonic_fail = 0, 0
        for _ in range(pairs):
            a, b = (int(x) for x in rng.choice(candidates, 2, replace=False))
            started = time.perf_counter()
            out = J.journey(bundle, a, b, n=n_stations, mode=mode, meta=meta)
            latency.append(time.perf_counter() - started)
            if not out["reachable"]:
                unreachable += 1
                continue
            far_count += bool(out["far"])
            rows = [s["row"] for s in out["stations"]]
            steps = [s["dist_from_prev"] for s in out["stations"]]
            step_median.append(float(np.median(steps)))

            progress = [s["progress"] for s in out["stations"]]
            if progress != sorted(progress):
                monotonic_fail += 1
            # 규칙 검사: 제외 곡, 길이, canonical 중복, 아티스트 상한
            bad = not bundle.serve_mask[rows].all()
            length = bundle.numeric["length"][rows].astype(float)
            finite = np.isfinite(length)
            bad |= bool(((length[finite] < lo) | (length[finite] > hi)).any())
            canon = [int(meta.canonical[r]) for r in rows]
            bad |= len(canon) != len(set(canon))
            artists = [int(meta.artist[r]) for r in rows if int(meta.artist[r]) != postprocess.NULL]
            bad |= any(artists.count(x) > cap for x in set(artists))
            violations += bool(bad)

        report["modes"][mode] = {
            "latency_seconds": summarize(latency),
            "step_distance_median": summarize(step_median),
            "unreachable": unreachable,
            "rule_violations": violations,
            "progress_not_monotonic": monotonic_fail,
            "far_journeys": far_count,
        }

    axis = report["modes"]["axis"]["step_distance_median"]
    linear = report["modes"]["linear"]["step_distance_median"]
    report["ac4_axis_better_than_linear"] = bool(axis and linear and axis["mean"] < linear["mean"])
    report["ac1_axis_p95_under_2s"] = bool(report["modes"]["axis"]["latency_seconds"]["p95"] <= 2.0)
    report["source"] = ("Kakao Entertainment, melon (www.melon.com) · MLHD+ (MetaBrainz Foundation) "
                        "· MusicBrainz canonical dump 2026-08-17")
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pairs", type=int, default=100)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--stations", type=int, default=10)
    args = ap.parse_args()

    report = run(pairs=args.pairs, seed=args.seed, n_stations=args.stations)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_path = os.path.join(root, "output", "bench_journey_{}.json".format(report["bundle"]))
    with io.open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(json.dumps(report["modes"], ensure_ascii=False, indent=2))
    print("AC1 axis p95 ≤ 2s:", report["ac1_axis_p95_under_2s"])
    print("AC4 axis < linear:", report["ac4_axis_better_than_linear"])
    print("→", out_path)


if __name__ == "__main__":
    main()
