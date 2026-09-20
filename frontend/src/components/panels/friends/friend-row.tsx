"use client";

import UserRow from "@/components/common/user-row";
import { usePanelStore } from "@/stores/use-panel-store";
import type { NearbyPerson } from "@/types";

/**
 * 주변 사람 한 줄 — 프사 · 닉네임 · **지금 듣는 곡** (S15P21A405-482).
 *
 * **따라가기 버튼을 숨겼다.** 실시간 명세가 따라가기를 "아직 없는 것"으로 명시했고
 * `riderCount` 도 늘 0 이다. 누를 수 있게 두면 눌리는데 아무 일도 안 일어난다.
 *
 * 여기서 말하는 따라가기는 **탑승(ride)** 이다 (S15P21A405-489). 구독(follow)과 다르고,
 * 구독 쪽은 배포까지 끝나 프로필 화면에서 실연동으로 돈다. 탑승은 `POST /api/realtime/ride` 로
 * backend/dev 에 있지만 배포에 없고(realtime 프로파일 미활성) 선장의 곡·레이어 변경을 알리는
 * 소켓 이벤트도 아직 없다. 둘 다 생기면 되살린다.
 *
 * `isOnline` 자리도 뺐다 — 목록에 있다는 것이 곧 접속 중이라는 뜻이라(명세 §5.6) 늘 참이고,
 * 늘 참인 표시는 아무것도 말해 주지 않는다. 대신 그 자리에 듣는 곡을 적는다.
 */
export default function FriendRow({ person }: { person: NearbyPerson }) {
  const openFeed = usePanelStore((s) => s.openFeed);

  // 제목은 델타로 들어온 사람에게는 비어 있다 — 서버가 ENTER 에 곡 정보를 주지 않는다 (§6.2)
  const song = person.title ? [person.title, person.artist].filter(Boolean).join(" · ") : "듣는 곡을 불러오는 중";

  return (
    <UserRow
      nickname={person.nickname ?? "이름 없음"}
      imageUrl={person.imageUrl}
      caption={song}
      onClick={() => openFeed(person.email)}
      right={person.meetingCount > 0 ? <span className="num text-xs text-ink-3">{person.meetingCount}번째</span> : undefined}
    />
  );
}
