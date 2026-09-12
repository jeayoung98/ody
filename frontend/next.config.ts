import type { NextConfig } from "next";
import { LIVE_API_PATHS } from "./src/constants/live-api-paths";

/**
 * 배포된 백엔드 주소. `j15a405a` (a 붙음) 는 Jenkins·Grafana 가 있는 master-node 라 API 가 없다.
 * 앱 노드는 `j15a405` 다.
 */
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "https://j15a405.p.ssafy.io";

const nextConfig: NextConfig = {
  /**
   * 배포는 **Node 프로세스**로 돈다 (포트 3000, nginx 가 `/bff/` 와 `/` 를 여기로 보낸다).
   * 정적 export 로는 `src/app/bff/` 라우트 핸들러가 산출물에 없어서 모든 데이터 화면이 죽는다 —
   * 실제로 그랬다 (S15P21A405-273). standalone 은 `.next/standalone/server.js` 하나로 뜬다.
   */
  output: "standalone",
  /**
   * 브라우저가 백엔드를 직접 부르지 않고 Next 서버를 거치게 한다.
   *
   * 직접 부를 수 없는 이유가 두 가지다.
   * 1. 배포 백엔드가 `Origin` 이 붙은 요청을 전부 `403 Invalid CORS request` 로 막는다
   *    (자기 자신 오리진을 넣어도 막힌다 — 서버의 CORS_ALLOWED_ORIGINS 설정 문제).
   * 2. refresh 토큰 쿠키가 `Secure; SameSite=Lax` 라 크로스 사이트 요청에는 애초에 실리지 않는다.
   *
   * 프록시를 태우면 브라우저 입장에서는 same-origin 이라 둘 다 사라진다. 배포 환경에서도
   * nginx 가 같은 오리진에서 `/api/` 를 백엔드로 넘기므로 프론트 코드는 양쪽에서 동일하다.
   *
   * `beforeFiles` 여야 한다 — 기본값(`afterFiles`)이면 같은 경로의 목 라우트가 먼저 잡아버린다.
   */
  async rewrites() {
    return {
      beforeFiles: LIVE_API_PATHS.map((path) => ({
        source: path,
        destination: `${BACKEND_ORIGIN}${path}`,
      })),
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
