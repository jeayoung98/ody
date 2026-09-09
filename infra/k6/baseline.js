import http from 'k6/http';
import { check, sleep } from 'k6';
const base = (__ENV.BASE_URL || 'https://j15a405.p.ssafy.io').replace(/\/$/, '');
export const options = {
  vus: 2, duration: '30s',
  summaryTrendStats: ['avg', 'med', 'p(50)', 'p(95)', 'p(99)', 'max'],
  thresholds: { http_req_failed: ['rate==0'], checks: ['rate==1'] },
};
export default function () {
  const res = http.get(base + (__ENV.API_PATH || '/api/hello'), {tags: {endpoint: 'baseline'}});
  check(res, {'HTTP 200': r => r.status === 200});
  sleep(0.2);
}
