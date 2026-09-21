#!/usr/bin/env python3
"""20명 선단이 주변곡 탭을 동시에 열 때의 비용을 한 번 재 본다 (FR-037 · SC-012).

주변곡 조회는 따라가기 상태를 읽지 않는 무상태 조회다. 그래서 선단을 실제로 만들지 않고
인솔자 1명 + 동승자 20명이 같은 순간에 같은 곡의 주변곡을 여는 것만 그대로 재현한다.

  pip install pyjwt requests
  python scripts/local/measure_nearby_fleet.py --music-id 1

SECRET 은 backend/run-local-backend.ps1 의 JWT_SECRET 과 같아야 한다.
"""

import argparse
import statistics
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import jwt
import requests

SECRET = "local-dev-jwt-secret-32bytes-or-longer!!"
TTL_SEC = 24 * 60 * 60

# 인솔자 1명 + 정원 20명.
FLEET_SIZE = 21

# 읽을 지표. 앞의 이름으로 시작하는 줄만 본다.
METRICS = [
    "ody_nearby_candidates_seconds",
    "ody_nearby_candidate_size",
    "hikaricp_connections_acquire_seconds",
    "hikaricp_connections_pending",
    "hikaricp_connections_active",
]


def make_token(email):
    now = int(time.time())
    return jwt.encode(
        {
            "sub": email,
            "jti": str(uuid.uuid4()),
            "tokenType": "access",
            "iat": now,
            "exp": now + TTL_SEC,
        },
        SECRET,
        algorithm="HS256",
    )


def call_nearby(base, token, music_id):
    """주변곡 한 번 조회하고 걸린 시간(ms)과 상태 코드를 돌려준다."""
    started = time.perf_counter()
    try:
        res = requests.get(
            f"{base}/api/music/nearby",
            params={"id": music_id},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        return (time.perf_counter() - started) * 1000, res.status_code
    except requests.RequestException as e:
        return (time.perf_counter() - started) * 1000, str(e)


def scrape(base):
    """지표를 한 번 긁어 관심 있는 줄만 남긴다."""
    res = requests.get(f"{base}/actuator/prometheus", timeout=10)
    res.raise_for_status()
    return [
        line
        for line in res.text.splitlines()
        if not line.startswith("#") and any(line.startswith(name) for name in METRICS)
    ]


def run(base, music_id, rounds):
    tokens = [make_token(f"fleet-{i}@test.local") for i in range(FLEET_SIZE)]

    # 1. 첫 요청은 클래스 로딩과 커넥션 확보가 섞여 유난히 느리다. 재는 값에서 뺀다.
    warm_ms, warm_status = call_nearby(base, tokens[0], music_id)
    print(f"워밍업 1회: {warm_ms:.1f}ms · {warm_status}")
    if warm_status != 200:
        print("워밍업이 200 이 아니다. 토큰이나 곡 번호를 확인해라.")
        return

    before = scrape(base)

    # 2. 21명이 같은 순간에 같은 곡의 주변곡을 연다.
    all_ms = []
    for round_no in range(1, rounds + 1):
        with ThreadPoolExecutor(max_workers=FLEET_SIZE) as pool:
            results = list(
                pool.map(
                    lambda token: call_nearby(base, token, music_id),
                    tokens,
                )
            )
        failed = [status for _, status in results if status != 200]
        times = sorted(ms for ms, _ in results)
        all_ms.extend(times)
        print(
            f"{round_no}회차 · 최소 {times[0]:.1f}ms"
            f" · 중앙 {statistics.median(times):.1f}ms"
            f" · 최대 {times[-1]:.1f}ms"
            + (f" · 실패 {len(failed)}건 {failed[:3]}" if failed else "")
        )
        time.sleep(0.5)

    all_ms.sort()
    print()
    print(f"클라이언트 기준 {len(all_ms)}건")
    print(f"  중앙  {statistics.median(all_ms):.1f}ms")
    print(f"  p95   {all_ms[int(len(all_ms) * 0.95) - 1]:.1f}ms")
    print(f"  최대  {all_ms[-1]:.1f}ms")

    print()
    print("=== 서버 지표 (요청 전) ===")
    for line in before:
        print("  " + line)
    print()
    print("=== 서버 지표 (요청 후) ===")
    for line in scrape(base):
        print("  " + line)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:8080")
    parser.add_argument("--music-id", type=int, default=1)
    parser.add_argument("--rounds", type=int, default=5,
                        help="같은 동시 요청을 몇 번 반복할지. p99 가 의미를 가지려면 표본이 필요하다")
    args = parser.parse_args()
    run(args.base, args.music_id, args.rounds)
