import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || 'https://j15a405.p.ssafy.io').replace(/\/$/, '');

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || '2m',
  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate==0'],
  },
};

export default function () {
  const root = http.get(`${baseUrl}/`, { tags: { endpoint: 'frontend-root' } });
  check(root, {
    'frontend root is 200': (response) => response.status === 200,
  });

  const assetMatch = root.body && root.body.match(/(?:src|href)="(\/assets\/[^"?#]+)"/);
  check(assetMatch, {
    'frontend references a built asset': (match) => Boolean(match),
  });
  if (assetMatch) {
    const asset = http.get(`${baseUrl}${assetMatch[1]}`, { tags: { endpoint: 'frontend-asset' } });
    check(asset, {
      'frontend asset is 200': (response) => response.status === 200,
    });
  }

  const marker = http.get(`${baseUrl}/build-id.txt`, { tags: { endpoint: 'frontend-marker' } });
  check(marker, {
    'build marker is 200': (response) => response.status === 200,
    'build marker is not empty': (response) => response.body.trim().length > 0,
  });

  const api = http.get(`${baseUrl}/api/hello`, { tags: { endpoint: 'backend-api' } });
  check(api, {
    'backend API remains 200': (response) => response.status === 200,
  });

  sleep(0.2);
}
