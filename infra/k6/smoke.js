import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || 'https://j15a405.p.ssafy.io').replace(/\/$/, '');

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
  const response = http.get(`${baseUrl}${__ENV.API_PATH || '/api/hello'}`, { tags: { endpoint: 'representative' } });

  check(response, {
    'hello returns 200': (res) => res.status === 200,
    'response is valid': (res) => __ENV.API_PATH ? res.status === 200 : res.status === 200 && res.json('message') === 'hello',
  });

  sleep(1);
}
