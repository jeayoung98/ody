import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * 별자리 배치 API smoke (S15P21A405-265 · specs/006-constellation-layout SC-002).
 *
 * 목적은 두 가지다 — 30곡 요청이 살아 있는지, 그리고 응답이 1초 안에 오는지.
 * 1초는 요구사항 §6 의 "유사곡 검색 응답 1초" 를 준용한 **잠정 기준**이다. 배치 전용 목표가
 * 팀 문서에 없어 지어내지 않았다. 이 스크립트의 첫 실측값이 나오면 그 값을 근거로 spec 의
 * SC-002 를 확정 기준으로 바꾼다(그때 백분위·부하·측정 환경도 같이 못박는다).
 *
 * 배치 결과의 결정성(같은 곡 집합이면 항상 같은 좌표)은 단위 테스트가 본다
 * (PlanarProjectionTests). 여기서는 부하 아래 살아 있는지만 본다.
 */

const baseUrl = (__ENV.BASE_URL || 'https://j15a405.p.ssafy.io').replace(/\/$/, '');

/**
 * 30곡이 API 상한이다. **존재하는 id 여야 한다** — 하나라도 없거나 좌표가 NULL 이면
 * 404 로 전건 실패한다(부분 배치를 내지 않는 계약이다). 404 가 나오면 MUSIC_IDS 로 실제
 * 있는 id 를 넘긴다.
 */
const musicIds = (__ENV.MUSIC_IDS || Array.from({ length: 30 }, (_, i) => i + 1).join(','))
  .split(',')
  .map((value) => Number(value.trim()));

export const options = {
  summaryTrendStats: ['avg', 'med', 'p(50)', 'p(95)', 'p(99)', 'max'],
  vus: 1,
  duration: '15s',
  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<1000', 'p(99)<1500'],
  },
};

export default function () {
  const headers = { 'Content-Type': 'application/json' };
  // SecurityConfig 한시 해제(S15P21A405-243) 중에는 토큰이 없어도 된다. 원복되면 TOKEN 을 넘긴다.
  if (__ENV.TOKEN) {
    headers.Authorization = `Bearer ${__ENV.TOKEN}`;
  }

  const response = http.post(
    `${baseUrl}/api/constellations/layout`,
    JSON.stringify({ musicIds }),
    { headers, tags: { endpoint: 'constellation-layout' } },
  );

  check(response, {
    'layout returns 200': (res) => res.status === 200,
    // 요청한 곡 수와 응답 점 수가 같아야 한다 — 부분 배치가 없다는 계약의 확인이다.
    'one point per track': (res) =>
      res.status === 200 && res.json('data.points').length === musicIds.length,
    'coordinates within -1..1': (res) =>
      res.status === 200
      && res.json('data.points').every((point) => Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1),
  });

  sleep(1);
}
