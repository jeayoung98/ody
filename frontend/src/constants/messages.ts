/**
 * 여러 화면이 함께 쓰는 안내 문구. 같은 상황을 두 군데서 다르게 말하지 않게 한 곳에 둔다.
 */

/**
 * **재생이 막히는 이유별 문구.** 배지(짧게) · 토스트(눌렀을 때) · 설명(패널 안) 세 자리에서
 * 같은 말을 쓰라고 한 덩어리로 묶었다.
 *
 * 이유를 나누는 기준은 **사용자가 할 일이 다른가**다. 검색해봤는데 없는 곡은 다시 눌러도 같고,
 * 아직 안 찾아본 곡과 조회가 실패한 곡은 다시 눌러 보면 될 수 있다.
 * 한 문구로 합치면 그중 하나는 거짓말이 된다 — 그래서 `retryable` 도 함께 둔다.
 */
/**
 * 못 트는 이유별 문구. `ref` 는 **분석 이벤트용 기능 ID** 다 (`player-bar` 의 `action_blocked`) —
 * 화면에는 적지 않는다 (S15P21A405-384).
 */
export const PLAYBACK_BLOCKED = {
  /**
   * 유튜브를 **찾아봤는데 없었다** (`"none"`, SONG-04, S15P21A405-336).
   *
   * **재생을 되게 만드는 것이 아니라 왜 안 되는지 알려 주는 문구다.** 목으로 가짜 영상 ID 를
   * 채워 넣지 않는다 (S15P21A405-324 에서 걷어냈다). 다시 눌러도 같은 답이라 재시도하지 않는다.
   *
   * 문구가 **할 수 있는 일을 가리킨다** (S15P21A405-384). "음원이 없습니다" 로 끝내면 사용자가
   * 할 수 있는 게 없다 — 이 곡을 채워 넣게 하는 유일한 길이 신고라서 그리로 안내한다.
   */
  noVideo: {
    badge: "재생 불가",
    notice: "아직 준비 중인 곡이에요",
    detail: "아직 재생 준비 중인 곡이에요. 오른쪽 위 신고 버튼으로 알려 주시면 음원을 채워 넣을게요.",
    ref: "SONG-04",
    retryable: false,
  },
  /**
   * **아직 찾아보지 않았다** (`null`, S15P21A405-332).
   *
   * 없는 것이 아니라 모르는 것이다. 다시 부르면 백엔드가 그때 검색해 채울 수 있으므로,
   * 누를 때 한 번 더 물어본다 — 그래야 "잠시 후 다시" 가 빈말이 되지 않는다.
   */
  notSearched: {
    badge: "재생 준비 중",
    notice: "음원을 아직 찾는 중이에요. 잠시 후 다시 눌러 주세요",
    detail: "이 곡의 음원을 아직 찾지 못했습니다. 잠시 후 다시 시도해 주세요.",
    ref: null,
    retryable: true,
  },
  /**
   * `videoId` 조회 자체가 실패했다 (S15P21A405-364).
   *
   * **곡의 문제가 아니라 지금의 문제다.** 예전에는 이 경우를 "틀 수 있는 곡" 으로 봐서 버튼이
   * 멀쩡한 채 눌러도 소리가 안 났다 — 여정에서 곡이 조용히 지나가는 것으로 보였다.
   */
  lookupFailed: {
    badge: "재생 준비 중",
    notice: "지금은 재생할 수 없어요. 잠시 후 다시 눌러 주세요",
    detail: "음원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    ref: null,
    retryable: true,
  },
} as const;

/** {@link PLAYBACK_BLOCKED} 의 한 항목 */
export type PlaybackBlocked = (typeof PLAYBACK_BLOCKED)[keyof typeof PLAYBACK_BLOCKED];

/** 못 트는 곡을 자동으로 넘겼을 때 (S15P21A405-364). 조용히 넘기면 곡이 사라진 것으로 보인다 */
export const SKIPPED_UNPLAYABLE = "재생할 수 없는 곡을 건너뛰었어요";

/**
 * 따라가기(탑승)가 거부됐을 때의 안내 (2차 실시간 명세 §3.3, S15P21A405-530).
 *
 * **사유마다 사용자가 할 일이 다르다.** 잠시 뒤 다시 하면 되는 것과 아무리 해도 안 되는 것을
 * 한 문구로 뭉치면 "다시 해 보라" 는 말이 빈말이 된다.
 *
 * `RIDE_NOT_RIDING` 은 여기 없다 — **조용히 넘기는** 사유다. 이미 `RIDE_ENDED` 로 끝나 있어서
 * 내릴 것이 없었던 경우이고, 사용자 입장에서는 눌러서 내려진 것이 맞다.
 */
export const RIDE_REJECTED = {
  RIDE_SELF: "자기 자신은 따라갈 수 없어요",
  RIDE_CAPTAIN_INACTIVE: "지금은 따라갈 수 없는 사용자예요",
  RIDE_ALREADY_RIDING: "이미 따라가는 중이에요. 먼저 내려 주세요",
  RIDE_CHAIN_FORBIDDEN: "따라가기는 한 단계까지만 가능해요",
  RIDE_FULL: "따라가는 인원이 가득 찼어요",
  RIDE_NOT_CAPTAIN: "따라가는 중에는 할 수 없어요. 먼저 내려 주세요",
  RIDE_STALE: "상태가 바뀌었어요. 화면을 새로 고친 뒤 다시 시도해 주세요",
  /**
   * 내 presence 가 없다는 뜻이다 — 인솔자 쪽 문제가 아니다 (S15P21A405-555). 자동 복구(소켓
   * 재연결)를 거치고도 남은 경우라 "불안정" 보다 끊겼다고 말하는 편이 맞다.
   *
   * **내 소켓이 끊긴 경우에만 쓴다** (S15P21A405-628). 붙어 있는데 422 면
   * {@link RIDE_CAPTAIN_UNREACHABLE} 다 — `use-ride-mutation` 의 `onError` 가 고른다.
   */
  PRESENCE_ERROR: "실시간 연결이 끊겼어요. 잠시 후 다시 시도해 주세요",
  UNKNOWN: "따라가기를 시작하지 못했어요",
} as const;

/**
 * **소켓은 멀쩡한데 422 가 온 경우** (S15P21A405-628).
 *
 * 백엔드는 `PRESENCE_ERROR` 하나로 두 가지를 말한다 — 내 presence 가 없거나, 상대가 탈 수
 * 있는 상태가 아니거나. 앞엣것은 프론트가 직접 확인할 수 있으므로(`isConnected`), 그게
 * 아니라면 남은 것은 상대·서버 쪽이다.
 *
 * **"연결이 불안정해요" 를 그대로 쓰면 안 된다.** 내 인터넷을 의심하게 만들어서, 실제로
 * 서버가 거절한 건을 찾는 데 시간을 쓰게 한다 — 이 문구 때문에 한 번 겪었다. 폰에서는
 * 콘솔을 못 보므로 화면 문구가 유일한 단서다.
 */
export const RIDE_CAPTAIN_UNREACHABLE = "지금은 이 사람을 따라갈 수 없어요. 잠시 후 다시 시도해 주세요";

/** 인솔자가 사라져 따라가기가 끝났다 (§4.3). 조용히 끊으면 왜 멈췄는지 알 수 없다 */
export const RIDE_ENDED_BY_CAPTAIN = (who: string) => `${who} 님이 떠나 따라가기가 끝났어요`;
/** 인솔자가 강제 하차(선단 해체)를 눌렀다 (S15P21A405-606). 인솔자는 그 자리에 그대로 있다 — "떠났다" 고 말하면 틀린다 */
export const RIDE_ENDED_BY_DISBAND = (who: string) => `${who} 님이 따라가기를 끝냈어요. 이 자리에서 이어가요`;

/** 내가 인솔자로서 선단을 해체했다 (S15P21A405-606) */
export const RIDE_DISBANDED = (count: number) => `${count}명을 내려 드렸어요`;

/**
 * 해체가 거부됐을 때. `RIDE_NOT_CAPTAIN` 이 여기서는 "따라가는 중" 이 아니라 **"따라오는 사람이 없다"** 는
 * 뜻이다 (백엔드 `disbandByCaptain`) — 세고 나서 부르는 사이에 전원이 내린 경우라 실패가 아니다.
 */
export const RIDE_DISBAND_REJECTED = {
  RIDE_NOT_CAPTAIN: "지금은 따라오는 사람이 없어요",
  PRESENCE_ERROR: "연결이 불안정해요. 잠시 후 다시 시도해 주세요",
  UNKNOWN: "강제 하차에 실패했어요. 잠시 후 다시 시도해 주세요",
} as const;

/** 곡 좋아요 요청이 실패했다 (S15P21A405-611). 낙관적으로 켠 하트는 되돌린다 */
export const LIKE_FAILED = "좋아요를 반영하지 못했어요. 잠시 후 다시 시도해 주세요";

/** 연결이 흔들려 따라가기를 다시 잇는 중이다 (S15P21A405-615). 첫 재시도 때 한 번만 띄운다 */
export const RIDE_RESUMING = "연결이 불안정해요. 따라가기를 다시 잇는 중이에요";
/** 다시 잇기를 다 해 봤지만 안 됐다 — 이제야 내린다 */
export const RIDE_RESUME_FAILED = (who: string) => `${who} 님과 다시 연결하지 못해 따라가기를 마쳤어요`;

/**
 * 반응이 거부됐을 때 (SOCIAL-02·04, S15P21A405-607, 백엔드 `RealtimeErrorCode`).
 * 패널에 뜬 전원에게 보내므로 **전부 거부됐을 때만** 첫 사유를 말한다.
 */
export const REACTION_REJECTED = {
  REACTION_SELF: "자기 자신에게는 반응을 보낼 수 없어요",
  REACTION_NOT_NEARBY: "같은 영역에 있는 사람에게만 보낼 수 있어요",
  REACTION_COOLDOWN: "같은 사람에게는 잠시 뒤에 다시 보낼 수 있어요",
  PRESENCE_ERROR: "연결이 불안정해요. 잠시 후 다시 시도해 주세요",
  UNKNOWN: "반응을 보내지 못했어요",
} as const;


/**
 * 따라가는 중에 여정을 누른 경우 (S15P21A405-557).
 *
 * **묻지 않고 막는다.** 다른 활동은 "멈추고 시작할까요" 를 물어도 되지만(ACT-01), 여정은
 * 출발·도착을 직접 골라야 하는데 따라가는 동안에는 지도를 못 만진다 — 물어서 승낙을 받아도
 * 그 다음에 할 수 있는 것이 없다.
 */
export const RIDING_JOURNEY_BLOCKED = "따라가는 중에는 여정을 만들 수 없어요. 하차한 뒤에 해 주세요";

/** 따라가는 동안 막힌 조작을 눌렀다 (§6). 눌렀는데 아무 일도 안 나는 것이 제일 나쁘다 */
export const RIDING_LOCKED = "따라가는 중에는 직접 고를 수 없어요. 하차하면 다시 돼요";

/**
 * 따라가는 동안 지도를 움직이려 했다 — 휠·드래그·주변 탐색·내 위치로 가기 (S15P21A405-605, SOCIAL-08).
 * 곡 고르기(`RIDING_LOCKED`)와 갈라 둔다: 이쪽은 "화면" 이고 저쪽은 "곡" 이다.
 */
export const RIDING_MAP_LOCKED = "따라가는 중에는 지도를 움직일 수 없어요. 하차하면 다시 돼요";

/**
 * 따라가는 동안 이벤트(별자리 콘테스트)를 열려 했다 (S15P21A405-660).
 *
 * 앞의 셋과 갈라 두는 이유: 이벤트는 **지도도 곡도 아니다.** 화면 대부분을 덮는 모달이라
 * 여는 순간 선단이 보이지 않고, 그 안에서 그리기·출품을 하다 보면 인솔자가 어디로 갔는지
 * 모르게 된다. "움직일 수 없어요" 도 "고를 수 없어요" 도 맞는 말이 아니다.
 */
export const RIDING_CONTEST_BLOCKED = "따라가는 중에는 이벤트를 열 수 없어요. 하차하면 다시 돼요";

/**
 * **바뀌었다는 한 줄** (S15P21A405-667). 조용히 끝나던 변경마다 토스트 하나 — 눌렀는데 아무 표시가 없으면 됐는지
 * 모른다. 이름을 알면 이름을 적고, 훅이 모르면(캐시에 없으면) 종류만 적는다. 실패 문구는 각자 자리에 따로 있다.
 */
export const CHANGED = {
  playlistItemAdded: (name: string | null) => (name ? `「${name}」에 담았어요` : "플레이리스트에 담았어요"),
  playlistItemDuplicate: "이미 담긴 곡이에요",
  playlistItemRemoved: "플레이리스트에서 뺐어요",
  playlistCreated: (name: string) => `「${name}」 만들었어요`,
  playlistDeleted: (name: string | null) => (name ? `「${name}」 지웠어요` : "플레이리스트를 지웠어요"),
  nicknameChanged: (nickname: string) => `닉네임을 바꿨어요 · ${nickname}`,
  profileImageChanged: "프로필 사진을 바꿨어요",
  musicLiked: "좋아요했어요",
  musicUnliked: "좋아요를 취소했어요",
  playlistLiked: "플레이리스트를 좋아요했어요",
  playlistUnliked: "플레이리스트 좋아요를 취소했어요",
  followed: "팔로우했어요",
  unfollowed: "팔로우를 취소했어요",
  rideStarted: (who: string) => `${who} 님을 따라가요`,
  tasteGenerated: "취향 리포트를 만들었어요",
  loggedOut: "로그아웃했어요",
} as const;

/**
 * "내 위치로 가기" 를 눌렀는데 갈 수 없다 (S15P21A405-670). 눌렀는데 아무 일도 안 나는 것이 제일 나쁘다.
 *
 * 지도는 겹마다 서버가 고른 곡만 받으므로 랭킹·검색·플리에서 튼 곡은 지도가 좌표를 모를 수 있다.
 * 그때는 곡 상세에서 좌표를 받아 오는데, 좌표가 아예 없는 곡(`location` null)이거나 그 조회가 실패하면 여기다.
 */
export const HOME_NO_COORDS = "이 곡은 지도에 자리가 없어서 갈 수 없어요";
export const HOME_LOOKUP_FAILED = "곡의 자리를 못 불러왔어요. 다시 눌러 주세요";
