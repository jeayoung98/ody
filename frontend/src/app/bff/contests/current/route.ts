import { ok } from "@/lib/api-response";
import { contestCaller, contestFail } from "@/lib/contest-bff";
import { currentContest } from "@/mocks/contest";

/**
 * ⚠ **목이다. 배포 API 에 이 기능이 없다** (S15P21A405-602, BACKEND-NOTES "별자리 콘테스트").
 * 지금 진행 중인 회차 + 내 출품·남은 표·남은 재출품. 진행 중인 회차가 없으면 `data: null`.
 */
export async function GET(req: Request) {
  try {
    return ok(await currentContest(contestCaller(req).email));
  } catch (e) {
    return contestFail(e);
  }
}
