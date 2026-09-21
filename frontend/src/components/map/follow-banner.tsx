"use client";

import { useFollowStore } from "@/stores/use-follow-store";

/** #ticket — 따라가기 중 상단 배너 + 하차 버튼. 조작 제한 안내 (SOCIAL-08, SOCIAL-09) */
export default function FollowBanner() {
  const leaderEmail = useFollowStore((s) => s.leaderEmail);
  const leaderNickname = useFollowStore((s) => s.leaderNickname);
  const followerCount = useFollowStore((s) => s.followerCount);
  const stop = useFollowStore((s) => s.stop);

  if (!leaderEmail) return null;

  /**
 * 탑승(ride)은 **아직 서버에 보내지 않는다** (S15P21A405-489). 예전에는 팔로우 목 라우트를
 * 불렀는데, 그건 `{ok:true}` 만 주는 자리표시자였고 구독과 탑승을 같은 것으로 착각한 흔적이다.
 *
 * 진짜 탑승 API 는 `POST /api/realtime/ride` 로 backend/dev 에 있지만 **배포에 없고**
 * (realtime 프로파일 미활성) 선장의 곡·레이어 변경을 알리는 소켓 이벤트도 아직 없다. 그때까지는
 * 로컬 상태로만 둔다 — 없는 API 를 부르는 것보다 안 부르는 쪽이 정직하다.
 */
  const handleStop = () => stop();

  return (
    <div className="glass-liquid animate-tin pointer-events-auto absolute top-[72px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-pill! py-[9px] pr-2.5 pl-3.5">
      <span className="animate-pulse-dot h-2 w-2 shrink-0 rounded-pill bg-violet shadow-[0_0_12px_#a67cff]" />
      <div>
        <div className="text-sm">
          🚀 <b className="font-semibold">{leaderNickname ?? leaderEmail}</b>의 우주선 탑승 중
        </div>
        <div className="num text-[9.5px] tracking-[0.05em] text-ink-3">동승 {followerCount}명 · 지도 조작 잠김 · 하차하면 이 자리에서 이어갑니다</div>
      </div>
      <button
        type="button"
        onClick={handleStop}
        className="rounded-pill border border-bad/30 bg-bad/[.14] px-[13px] py-[7px] text-xs text-[#ffb3bd] transition-colors hover:bg-bad/25"
      >
        하차
      </button>
    </div>
  );
}
