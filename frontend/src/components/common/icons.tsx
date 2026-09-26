import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size: number, props: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

/** 프로토타입에서 쓰인 라인 아이콘 세트 */
export const SearchIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.2}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4.2-4.2" />
  </svg>
);
/** 마우스와 휠 — 튜토리얼 1단계가 "휠을 굴리세요" 하고 띄우는 그림 (S15P21A405-351) */
export const MouseWheelIcon = ({ size = 40, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={1.5}>
    <rect x="7" y="2" width="10" height="20" rx="5" />
    <path d="M12 6.5v3" />
  </svg>
);
/** 점점점 — 더 볼 것이 있다는 표시. 누르면 옵션 메뉴가 뜬다 (S15P21A405-524) */
export const MoreIcon = ({ size = 17, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.6}>
    <path d="M5 12h.01" />
    <path d="M12 12h.01" />
    <path d="M19 12h.01" />
  </svg>
);
/** 내 위치로 가기 — 지도 앱의 "현재 위치" 조준선 */
export const LocateIcon = ({ size = 17, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="6.2" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <path d="M12 1.8v3.2M12 19v3.2M1.8 12h3.2M19 12h3.2" />
  </svg>
);
export const CloseIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const BackIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.2}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const FriendsIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.2 19c.5-3.3 3-5.2 5.8-5.2s5.3 1.9 5.8 5.2" />
    <circle cx="17.5" cy="9.5" r="2.4" />
    <path d="M16 14.4c2.5.1 4.3 1.9 4.8 4.6" />
  </svg>
);
export const JourneyIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="5.5" cy="18.5" r="2.4" />
    <circle cx="18.5" cy="5.5" r="2.4" />
    <path d="M7.6 16.8C11 14 9 10.5 12.4 7.6" />
  </svg>
);
/** 하단 탭의 "지도" (S15P21A405-417) — 별 넷을 이은 작은 별자리 */
export const MapIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4.5 16.5 9 8l4.5 4.5L20 3" />
    <circle cx="4.5" cy="16.5" r="1.6" />
    <circle cx="9" cy="8" r="1.6" />
    <circle cx="13.5" cy="12.5" r="1.6" />
    <circle cx="20" cy="3" r="1.6" />
  </svg>
);
export const RankIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5 20V12M12 20V5M19 20v-6" />
  </svg>
);
export const UserIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c.8-3.8 3.9-6 7.5-6s6.7 2.2 7.5 6" />
  </svg>
);
export const PlayIcon = ({ size = 16, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M8 5v14l11-7z" />
  </svg>
);
export const PauseIcon = ({ size = 16, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
  </svg>
);
/**
 * 목록 재생 — 줄 세 개 + 삼각형 (S15P21A405-384).
 *
 * 홑 삼각형(`PlayIcon`)과 **일부러 다르게** 생겼다. 곡 상세의 순차 재생은 한 곡이 아니라
 * **10곡을 줄 세워 듣는 것**인데, 같은 ▶ 를 쓰면 제목 줄의 "이 곡 재생" 과 구분이 안 됐다.
 */
export const ListPlayIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2}>
    <path d="M4 7h12M4 12h9M4 17h6" />
    <path d="M15.6 13.4v7.2l6-3.6z" fill="currentColor" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);
export const PrevIcon = ({ size = 16, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M7 5h2v14H7zM20 5v14l-10-7z" />
  </svg>
);
export const NextIcon = ({ size = 16, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M15 5h2v14h-2zM4 5l10 7-10 7z" />
  </svg>
);
/**
 * 주변 탐색 — **한 별에서 이웃들로 뻗는 코로나** (S15P21A405-384).
 *
 * 예전 레이더(동심원 + 대각선)는 "훑어본다" 는 뜻이라 이 기능과 어긋났다. 여기서 하는 일은
 * **한 곡을 가운데 두고 가까운 곡들을 불러 세우는 것**이다 — 가운데 별에서 짧은 선이 방사로
 * 뻗고 끝마다 이웃 별이 붙는 그림이 그 뜻이다. 곡 상세 카드 줄과 하단 바가 같은 것을 쓴다.
 */
export const CoronaIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={1.7}>
    <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    <path d="M12 6.4V4M12 20v-2.4M6.4 12H4M20 12h-2.4M8.1 8.1 6.4 6.4M15.9 15.9l1.7 1.7M15.9 8.1l1.7-1.7M8.1 15.9l-1.7 1.7" />
    <circle cx="12" cy="2.9" r="1.05" />
    <circle cx="12" cy="21.1" r="1.05" />
    <circle cx="2.9" cy="12" r="1.05" />
    <circle cx="21.1" cy="12" r="1.05" />
  </svg>
);
export const SmileIcon = ({ size = 19, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={1.8}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14.5c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2" />
    <circle cx="9" cy="9.6" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="9.6" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);
/** ⓘ — 눌러서 설명을 여는 자리 (S15P21A405-435) */
export const InfoIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.6" r=".9" fill="currentColor" stroke="none" />
  </svg>
);

export const HelpIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.8 2.1c-.9.6-1.3 1.1-1.3 2.1" />
    <circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * 신고 — 깃발. 곡이 음원이 아닐 때 알리는 자리에 쓴다 (S15P21A405-378).
 *
 * 경고 삼각형(⚠)을 쓰지 않았다. 그건 "이 화면에 문제가 있다" 는 신호라, 사용자가 **스스로
 * 누르는 입구**에 놓으면 앱이 고장 난 것처럼 읽힌다. 깃발은 "여기 표시해 둔다" 쪽이다.
 */
export const FlagIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5 21V4" />
    <path d="M5 4h11l-2.2 3.6L16 11H5" />
  </svg>
);
/** 오른쪽 홑화살. 레이어 자취의 칸 사이를 잇는 표시 (S15P21A405-477) */
export const ChevronRightIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2}>
    <path d="M9.5 6l6 6-6 6" />
  </svg>
);
/** 왼쪽 홑화살. 오른쪽은 `rotate-180` 으로 돌려 쓴다 (`ChevronDownIcon` 과 같은 이유) */
export const ChevronLeftIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.1}>
    <path d="M14.5 6l-6 6 6 6" />
  </svg>
);
/**
 * 아래로 향하는 홑화살 — 접힌 것을 편다. **펴진 상태는 뒤집어서 쓴다**(`rotate-180`):
 * 아이콘을 둘로 나누면 바뀌는 순간 튀어서, 한 아이콘을 돌려야 애니메이션이 이어진다.
 */
export const ChevronDownIcon = ({ size = 17, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={2.1}>
    <path d="M6 9.5l6 6 6-6" />
  </svg>
);
/** 곡 길이 — 시계. 칩이 값만 적으므로 그 값이 무엇인지 아이콘이 먼저 말한다 (S15P21A405-384) */
export const ClockIcon = ({ size = 13, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.4V12l3.2 2" />
  </svg>
);
/** 다시 받기 — 둥근 화살표. 실시간 탑 버스기사 새로고침 (S15P21A405-681) */
export const RefreshIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M19.6 12a7.6 7.6 0 1 1-2.2-5.4" />
    <path d="M19.8 4.4v4.2h-4.2" />
  </svg>
);
/** 발매년도 — 달력 */
export const CalendarIcon = ({ size = 13, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="3.6" y="5.4" width="16.8" height="15" rx="2.6" />
    <path d="M3.6 10.2h16.8M8.4 3.4v3.4M15.6 3.4v3.4" />
  </svg>
);
/**
 * 플레이리스트에 추가 (SONG-05) — 목록 세 줄 + 더하기.
 * 하트를 쓰지 않았다. 하트는 "좋아요"(PATH-07)의 자리라 같은 화면에서 뜻이 갈린다.
 */
export const PlaylistAddIcon = ({ size = 17, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 7h12M4 12h12M4 17h6.5" />
    <path d="M17 14.2v6M14 17.2h6" />
  </svg>
);
/**
 * 여정 출발 — 별에서 떠나는 화살. 도착(`ArriveIcon`)과 짝이고, 색은 여정 패널과 같게
 * 출발 teal · 도착 violet 로 쓴다 (`journey-endpoints.tsx`).
 */
export const DepartIcon = ({ size = 15, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="6.4" cy="17.6" r="3.1" />
    <path d="M9.9 14.1 18 6" />
    <path d="M12.6 6H18v5.4" />
  </svg>
);
/** 여정 도착 — 별로 들어오는 화살 */
export const ArriveIcon = ({ size = 15, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="17.6" cy="17.6" r="3.1" />
    <path d="M6 6l7.4 7.4" />
    <path d="M8.8 13.4h4.6V8.8" />
  </svg>
);
/**
 * 신고 — 경광등(삐용삐용). 깃발보다 "무슨 일이 있었다" 는 뜻이 바로 읽힌다 (S15P21A405-384).
 * 받침 · 돔 · 위로 뻗는 빛 두 줄.
 *
 * 색은 쓰는 쪽에서 준다(`currentColor`). 헤더 신고 버튼은 빨강이다 — 402 가 본문에 빨간 버튼을
 * 세운 뜻("눌러야 할 것이 아니라 **눈에 띄어야** 하는 버튼")을 색으로 가져왔다.
 * 다른 아이콘보다 큰 기본값(18)을 쓴다. 작으면 돔·빛줄기가 뭉쳐 그냥 점으로 보인다.
 */
export const SirenIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M7.6 18.6v-3.4a4.4 4.4 0 0 1 8.8 0v3.4" />
    <path d="M5.2 18.6h13.6" />
    <path d="M12 8.6V6.4" />
    <path d="M6.3 11.5 4.2 10.3M17.7 11.5l2.1-1.2" />
  </svg>
);

/**
 * 잡고 옮기는 손잡이 — 가로 세 줄 (S15P21A405-540).
 *
 * 줄이 셋인 것은 **오래된 약속**이다. 목록에서 이 모양은 메뉴가 아니라 "여기를 잡아라" 로
 * 읽힌다. 다른 손잡이 관용구(점 여섯 개)보다 작은 크기에서 덜 뭉친다.
 *
 * 다른 아이콘보다 획을 얇게(1.7) 두었다. 줄이 셋이라 같은 굵기면 까맣게 뭉쳐 보인다.
 */
export const GripIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={1.7}>
    <path d="M4 8h16" />
    <path d="M4 12h16" />
    <path d="M4 16h16" />
  </svg>
);

/**
 * 고양이 별자리 — 귀 둘·둥근 얼굴을 점으로 잇고 눈 둘은 떨어진 별로 둔 모양.
 * 이벤트(별자리 콘테스트) 진입 버튼 (S15P21A405-602). 획은 살짝 얇게(1.6) — 점이 많아 굵으면 뭉친다.
 */
export const CatConstellationIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)} strokeWidth={1.6}>
    <path d="M4.5 5.5 8 9.5h8l3.5-4-1 8.5-3.5 5h-6l-3.5-5z" />
    {[
      [4.5, 5.5],
      [8, 9.5],
      [16, 9.5],
      [19.5, 5.5],
      [18.5, 14],
      [15, 19],
      [9, 19],
      [5.5, 14],
    ].map(([cx, cy]) => (
      <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.45" fill="currentColor" stroke="none" />
    ))}
    <circle cx="9.8" cy="13.6" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="14.2" cy="13.6" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

/** 하트 — 곡 좋아요 (S15P21A405-611). `filled` 면 속을 채운다 */
export const HeartIcon = ({ size = 17, filled = false, ...p }: P & { filled?: boolean }) => (
  <svg {...base(size, p)} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20.3S4.5 15.6 4.5 10.2A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.4-7.5 10.1-7.5 10.1z" />
  </svg>
);
