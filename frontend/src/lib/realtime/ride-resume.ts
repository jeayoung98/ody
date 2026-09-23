"use client";

import { RIDE_RESUME, RIDE_RESUMING, STORAGE_KEYS } from "@/constants";
import { ApiError } from "@/lib/api";
import { readStorage } from "@/lib/storage";
import { isRiding } from "@/stores/use-follow-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { RideTarget } from "@/hooks/mutations/use-ride-mutation";

/**
 * 따라가기를 **다시 잇는다** (S15P21A405-615). 소켓이 새로 열렸을 때, 인솔자가 사라졌다는
 * 알림(`RIDE_ENDED · CAPTAIN_LEFT`)이 왔을 때 부른다.
 *
 * **내리는 것은 마지막 수단이다.** 연결이 흔들리는 동안(422 · 네트워크 · 인솔자 자리 비움 · 상태
 * 어긋남)은 간격을 늘리며 다시 탑승을 시도하고, 기다려도 달라지지 않는 사유(`finalCodes`)나
 * 재시도를 다 썼을 때만 `giveUp` 을 부른다. 그 사이 사용자가 직접 내렸으면(저장도 상태도 없음)
 * 조용히 멈춘다.
 *
 * 앱에 하나만 있으면 되는 재시도라 모듈 상태다 — 두 진입점이 같은 타이머를 봐야 한다.
 */
let timer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;

export function cancelResume(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  attempt = 0;
}

export function resumeRide(target: RideTarget, mount: (t: RideTarget) => Promise<unknown>, giveUp: (code: string) => void): void {
  if (timer) clearTimeout(timer);
  timer = null;
  mount(target).then(
    () => {
      attempt = 0;
    },
    (e: unknown) => {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      // 서버가 아직 나를 태우고 있다 — 다시 탈 게 없다. 들고 있던 상태 그대로 간다
      if (code === "RIDE_ALREADY_RIDING") {
        attempt = 0;
        return;
      }
      if ((RIDE_RESUME.finalCodes as readonly string[]).includes(code) || attempt >= RIDE_RESUME.backoffMs.length) {
        attempt = 0;
        giveUp(code);
        return;
      }
      if (attempt === 0) useToastStore.getState().show(RIDE_RESUMING);
      const wait = RIDE_RESUME.backoffMs[attempt++];
      timer = setTimeout(() => {
        timer = null;
        // 그 사이 직접 내렸으면 그만둔다
        if (!isRiding() && !readStorage(STORAGE_KEYS.rideLeader)) {
          attempt = 0;
          return;
        }
        resumeRide(target, mount, giveUp);
      }, wait);
    },
  );
}
