import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";
import { LIVE_API_PATHS } from "./src/constants/live-api-paths";

/**
 * 이 컴퓨터의 LAN IPv4 주소들 (S15P21A405-476).
 *
 * **개발 서버를 폰으로 볼 때 필요하다.** Next dev 는 자기가 뜬 호스트(`localhost`)가 아닌
 * 곳에서 오는 `/_next/*` 요청을 **기본으로 막는다.** 폰이 `http://192.168.x.x:3000` 으로
 * 들어오면 HTML 은 받지만 청크와 HMR 이 차단돼서 **화면이 로딩 상태로 멈춘다** — 실제로
 * 아이폰에서 별이 안 뜨고 `LOADING STARS` 에 머물렀고, 서버 로그에 차단 경고가 찍혀 있었다.
 *
 * IP 를 손으로 적어 두면 망이 바뀔 때마다(핫스팟 ↔ 학교 Wi-Fi) 고쳐야 하므로 **뜰 때 읽는다.**
 * 주소가 바뀌면 dev 서버만 다시 띄우면 된다.
 *
 * `allowedDevOrigins` 는 **개발 모드에서만** 쓰인다. 배포(`output: "standalone"`)에는 영향이 없다.
 */
function lanOrigins(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => net!.address);
}

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
  /** 같은 망의 폰에서 개발 서버를 열 수 있게 한다 — 위 `lanOrigins` 주석 참고 */
  allowedDevOrigins: lanOrigins(),
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
