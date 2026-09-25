/**
 * 패널 뒤로가기 스택 (S15P21A405-659). 순수 함수만 — `tests/panel-history.test.cjs` 가 묶는다.
 *
 * **타고 들어간 길을 되돌아간다.** 예전에는 `back` 한 칸이라 두 번 이상 들어가면 첫 자리로 못 돌아갔다.
 * 스택에 쌓는 것은 "패널 안에서 눌러 연 것" 뿐이고, 레일·탭·지도·플레이어바·검색·닫기는 스택을 비운다 —
 * 그건 새 출발이지 타고 들어간 것이 아니다.
 */

export type FollowType = "follower" | "following";

/** 돌아갈 자리 하나. 패널을 다시 세우는 데 필요한 것만 든다 */
export type PanelReturn =
  | { panel: "journey" }
  | { panel: "playlist"; playlistId: number }
  | { panel: "song"; musicId: number }
  | { panel: "friends" }
  | { panel: "chart" }
  /** `profileEmail` 이 `null` 이면 내 페이지. `follows` 가 있으면 그 사람의 팔로워·팔로잉 목록을 보던 중 */
  | { panel: "feed"; profileEmail: string | null; follows?: FollowType | null };

/** 스택 상한. 그 위로는 오래된 것부터 잊는다 — 무한히 쌓이면 되돌아가는 데 열 번 넘게 눌러야 한다 */
export const PANEL_HISTORY_MAX = 10;

interface PanelSnapshotSource {
  activePanel: string | null;
  musicId: number | null;
  playlistId: number | null;
  profileEmail: string | null;
  feedFollows: FollowType | null;
}

/** 지금 열린 패널을 돌아갈 자리로. 닫혀 있거나 다시 세울 수 없는 상태면 `null` */
export function snapshotOf(s: PanelSnapshotSource): PanelReturn | null {
  switch (s.activePanel) {
    case "song":
      return s.musicId != null ? { panel: "song", musicId: s.musicId } : null;
    case "playlist":
      return s.playlistId != null ? { panel: "playlist", playlistId: s.playlistId } : null;
    case "journey":
      return { panel: "journey" };
    case "friends":
      return { panel: "friends" };
    case "chart":
      return { panel: "chart" };
    case "feed":
      return { panel: "feed", profileEmail: s.profileEmail, follows: s.feedFollows };
    default:
      return null;
  }
}

/** 같은 자리인가 — 같은 곳을 연달아 쌓지 않으려는 것 (프로필에서 같은 프로필을 또 열었을 때 등) */
export function sameReturn(a: PanelReturn, b: PanelReturn): boolean {
  if (a.panel !== b.panel) return false;
  switch (a.panel) {
    case "song":
      return a.musicId === (b as typeof a).musicId;
    case "playlist":
      return a.playlistId === (b as typeof a).playlistId;
    case "feed":
      return a.profileEmail === (b as typeof a).profileEmail && (a.follows ?? null) === ((b as typeof a).follows ?? null);
    default:
      return true;
  }
}

/** 스택에 쌓는다. 쌓을 것이 없거나 지금 가는 곳과 같으면 그대로. 상한을 넘으면 오래된 것을 버린다 */
export function pushHistory(history: readonly PanelReturn[], current: PanelReturn | null, target: PanelReturn, max = PANEL_HISTORY_MAX): PanelReturn[] {
  if (!current || sameReturn(current, target)) return [...history];
  const next = [...history, current];
  return next.length > max ? next.slice(next.length - max) : next;
}
