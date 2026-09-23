/**
 * **재생이 옮겨 가면 선택도 따라간다** (S15P21A405-578).
 *
 * 선택(`selectedMusicId`)은 사용자가 별을 누를 때만 바뀐다. 재생이 저 혼자 다음 곡으로 넘어가는
 * 길 — 플리·여정 순차 재생, 다음·이전 버튼, 곡이 끝나 자동으로 넘어갈 때 — 은 선택을 안 건드려서
 * **선택이 예전에 눌러 둔 별에 멈춰 있었다.**
 *
 * 그 낡은 값을 읽는 자리가 주변 탐색이다. 기준 곡을 "선택된 곡 > 재생 중인 곡" 순으로 고르므로,
 * 플리를 듣다가 주변 탐색을 열면 **지금 듣는 곡이 아니라 그 낡은 별이 고리 한가운데에 섰다.**
 * 플리는 비슷한 곡끼리 묶여 있어서 "유사곡 하나가 중앙에 온" 것으로 보인다.
 *
 * **같은 뿌리를 한 번 더 겪었다.** 따라가기에서 똑같은 일이 있었고(S15P21A405-557) 그때는 기준 곡
 * 줄 앞에 인솔자 곡을 하나 더 붙여 막았다. 같은 줄에 예외를 또 붙이는 대신 낡은 선택 자체를 거둔다 —
 * 그래야 이 값을 읽는 다음 자리가 같은 함정에 안 빠진다.
 */
export interface SelectionFollowInput {
  /** 방금 바뀐 재생 곡 */
  playingMusicId: number | null;
  /** 지금 선택돼 있는 곡 */
  selectedMusicId: number | null;
  /** 새로고침으로 되살린 값인가. 지금 막 재생한 것이 아니다 */
  restored: boolean;
  /** 남을 따라가는 중인가 */
  riding: boolean;
}

/**
 * 선택을 재생 곡으로 데려갈지.
 *
 * - **따라가는 중이면 아니다.** 그때 선택은 인솔자가 열어 둔 상세 곡이 정한다 (SOCIAL-07,
 *   S15P21A405-557). 인솔자가 서 있는 곡과 보고 있는 곡은 다를 수 있어서, 재생을 따라가면
 *   우측 패널이 엉뚱한 곡으로 덮인다.
 * - **새로고침으로 되살린 곡이면 아니다.** 지도를 열자마자 아무도 안 누른 링이 생긴다.
 * - 이미 그 곡이 선택돼 있으면 할 일이 없다 — 지도에서 눌러 재생하는 길이 여기다. 선택과 재생을
 *   이미 함께 옮기므로 이 함수는 그 길에서 아무것도 바꾸지 않는다.
 */
export function shouldFollowPlayback({ playingMusicId, selectedMusicId, restored, riding }: SelectionFollowInput): boolean {
  if (playingMusicId == null || restored || riding) return false;
  return selectedMusicId !== playingMusicId;
}
