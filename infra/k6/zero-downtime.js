import http from 'k6/http';
import { check } from 'k6';

const baseUrl = (__ENV.BASE_URL || 'https://j15a405.p.ssafy.io').replace(/\/$/, '');

export const options = {
  summaryTrendStats: ['avg', 'med', 'p(50)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    deployment_window: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.REQUEST_RATE || 10),
      timeUnit: '1s',
      duration: __ENV.DURATION || '5m',
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_failed: ['rate==0'],
    dropped_iterations: ['count==0'],
    http_req_duration: ['p(95)<1000', 'p(99)<1500'],
    checks: ['rate==1'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}${__ENV.API_PATH || '/api/hello'}`, { tags: { endpoint: 'representative', purpose: 'blue-green' } });
  check(response, {
    'request succeeds during deployment': (res) => res.status === 200,
    'response body remains valid': (res) => __ENV.API_PATH ? res.status === 200 : res.status === 200 && res.json('message') === 'hello',
  });
}
