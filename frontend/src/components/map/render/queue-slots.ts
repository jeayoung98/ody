import { NO_GENRE_ID } from "@/constants";
import { seedOf } from "@/lib/avatar-seed";
import type { NearbyUser } from "@/types";

/**
 * 우주선 뒤에 매달리는 줄의 **자리 배치** (S15P21A405-676).
 *
 * - `me`: 내가 따라갈 때 맨 앞에 매달린 나. 내가 인솔자면 조종석에 있으니 `null` — 예전에는 늘 한 칸을 더해서
 *   한 명이 따라오는데 헬멧이 둘이었다.
 * - `riders`: 얼굴을 아는 동승자. `count` 가 그보다 크면(새로고침 뒤·사진 조회 전) 모자란 만큼 빈 헬멧을 세운다.
 *
 * 그리는 쪽(`drawQueue`)이 아니라 여기 둔 이유는 React·캔버스 없이 수를 검증하기 위해서다 (`tests/queue-slots.test.cjs`).
 */
export interface QueueInput {
  me: NearbyUser | null;
  riders: NearbyUser[];
  count: number;
}

export interface QueueSlot {
  user: NearbyUser;
  mine: boolean;
}

export function queueSlots({ me, riders, count }: QueueInput): QueueSlot[] {
  const out: QueueSlot[] = [];
  if (me) out.push({ user: me, mine: true });
  for (const r of riders) out.push({ user: r, mine: false });
  for (let i = riders.length; i < count; i++) out.push({ user: placeholderRider(i), mine: false });
  return out;
}

/** 누군지 모르는 동승자 — 얼굴만 절차적으로, 같은 자리는 같은 얼굴이게 */
function placeholderRider(i: number): NearbyUser {
  const email = `rider-${i}`;
  return {
    email,
    nickname: null,
    imageUrl: null,
    isOnline: true,
    musicId: 0,
    viewingMusicId: 0,
    genreId: NO_GENRE_ID,
    meetingCount: 0,
    riderCount: 0,
    followingNickname: null,
    avatarSeed: seedOf(email),
  };
}
