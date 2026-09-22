"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { useStarScreenPos } from "@/components/tutorial/tutorial-hint";
import TutorialSpotlight from "@/components/tutorial/tutorial-spotlight";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { BREAKPOINTS } from "@/constants/design-tokens";
import { track } from "@/lib/analytics/client";
import { readStorage, writeStorage } from "@/lib/storage";
import { useIsNarrow } from "@/hooks/use-is-narrow";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";

/**
 * 바로재생을 모르는 사람에게 한 번 짚어 준다 (S15P21A405-393).
 *
 * **튜토리얼과 다른 물건이다.** 튜토리얼은 처음 한 번 순서대로 끌고 가는 것이고, 이건 이미
 * 쓰고 있는 사람에게 "이렇게도 된다" 를 흘리는 자리다. 그래서 단계도 없고 진행도 없다.
 *
 * 알리는 규칙은 `map-view.tsx` `pressSong` 에 있다 (S15P21A405-288) — **이미 고른 별을 다시
 * 누르면 재생.** 안 고른 별은 첫 클릭이 선택·둘째가 재생이라 결과적으로 더블클릭이 먹는다.
 * `dblclick` 핸들러는 없으니 "더블클릭" 은 겪는 쪽의 말이고 구현의 말이 아니다.
 *
 * **조작을 막지 않는다.** 덤도 별도 `pointer-events-none` 이라 힌트가 떠 있는 동안에도 확대·
 * 이동·클릭이 그대로 된다. 유일하게 누를 수 있는 것은 건너뛰기뿐이다. 튜토리얼도 같은
 * 판단을 했다 (S15P21A405-354) — 가리켜 주기만 하고 길을 막지 않는다.
 */

/** 힌트를 따로 세는 자리. 같은 조작이라도 문맥이 다르면 새로 알려 준다 */
type HintContext = "map" | "nearby" | "journey";

const LABEL: Record<HintContext, string> = {
  map: "별을 더블클릭하면 바로 재생돼요",
  nearby: "이웃 별도 더블클릭하면 바로 들려요",
  journey: "여정의 별도 더블클릭하면 바로 들려요",
};

/** 전환(다이빙·고리 펼치기)이 끝나고 화면이 가라앉은 뒤에 띄운다. 그 전에는 별이 날아다닌다 */
const SETTLE_MS = 1600;

/** 짚을 별을 이 아래에서 고른다 — 위쪽은 검색창·레이어 스테퍼가 쓴다 */
const HUD_TOP = 150;

/** 툴팁이 화면 끝에 닿지 않게 두는 여백(px) */
const EDGE = 12;
/** 별 중심에서 툴팁까지 띄우는 거리(px). 반짝임 고리(36px) 바깥 */
const TIP_GAP = 46;

const seen = () => readStorage<HintContext[]>(STORAGE_KEYS.playHintSeen) ?? [];

function markSeen(context: HintContext) {
  const next = seen();
  if (next.includes(context)) return;
  writeStorage(STORAGE_KEYS.playHintSeen, [...next, context]);
}

function contextOf(viewMode: string): HintContext | null {
  if (viewMode === "nearby") return "nearby";
  if (viewMode === "constellation") return "journey";
  if (viewMode === "default") return "map";
  return null;
}

export default function PlayHint() {
  const pathname = usePathname();
  /**
   * **폰에서 시트가 펼쳐져 있으면 안 띄운다** (S15P21A405-532).
   *
   * 이 안내는 `fixed inset-0 z-[55]` 라 시트(z-20) 위로 그대로 떠오른다. 덤 한 겹에 맥박
   * 고리까지 얹혀서, 곡 상세를 보는 중에 **튜토리얼이 뚫고 나온 것처럼** 보였다 —
   * 실제로는 튜토리얼이 아니라 이것이다(모양을 일부러 같게 만들었다).
   *
   * z 를 내리는 것으로는 안 된다. 이 안내가 짚는 것은 **지도 위의 별**이라, 시트가 지도를
   * 덮고 있으면 가리킬 대상 자체가 안 보인다. 그래서 아예 미룬다 — 시트를 접거나 닫으면
   * 그때 뜬다. 데스크톱은 패널이 옆에 서고 지도가 그대로 보이므로 손대지 않는다.
   */
  const narrow = useIsNarrow();
  const activePanel = usePanelStore((s) => s.activePanel);
  const panelCollapsed = usePanelStore((s) => s.collapsed);
  // 서버와 첫 클라이언트 렌더는 비어 있다 — 저장소를 render 중에 읽으면 하이드레이션이 깨진다
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const viewMode = useMapStore((s) => s.viewMode);
  const context = contextOf(viewMode);

  /**
   * 화면이 가라앉은 뒤에야 띄운다. `settledFor` 가 **지금 문맥과 같을 때만** 유효하다 —
   * 문맥이 바뀌면 지난 값이 남아 있어도 저절로 어긋나서 꺼진다.
   */
  const [settledFor, setSettledFor] = useState<HintContext | null>(null);
  /** 이번 세션에서 닫은 문맥. 저장소에도 남기지만 그것만 보면 이 렌더에서 안 꺼진다 */
  const [dismissed, setDismissed] = useState<HintContext[]>([]);
  const [starId, setStarId] = useState<number | null>(null);

  const pending = hydrated && context != null && settledFor === context && !dismissed.includes(context);

  useEffect(() => {
    if (!hydrated || !context || seen().includes(context)) return;
    const id = window.setTimeout(() => setSettledFor(context), SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [hydrated, context]);

  /**
   * 짚을 별을 고른다. **안 보이게 되면 다시 고른다** — 힌트가 떠 있는 동안에도 지도를 움직일
   * 수 있어서, 짚어 둔 별이 화면 밖으로 나가면 반짝임만 사라지고 무엇을 누르라는 건지 모르게 된다.
   */
  useEffect(() => {
    if (!pending) return;
    let cur: number | null = null;
    const id = window.setInterval(() => {
      const e = getMapEngine();
      if (!e || (cur != null && e.starPos(cur))) return;
      cur = e.pickTutorialStar(HUD_TOP);
      setStarId(cur);
    }, 300);
    return () => window.clearInterval(id);
  }, [pending]);

  const at = useStarScreenPos(pending ? starId : null);

  useEffect(() => {
    if (!pending || !context) return;
    track("play_hint_shown", { context });
  }, [pending, context]);

  /**
   * **실제로 재생해야 닫힌다.** `playSeq` 는 같은 곡을 다시 틀어도 오르는 카운터라
   * `currentMusicId` 보다 "방금 재생했다" 를 정확히 잡는다. 렌더가 아니라 **구독**으로 보는 이유는
   * 그래야 닫는 일이 effect 본문이 아니라 사건이 일어난 자리에서 처리되기 때문이다.
   */
  useEffect(() => {
    if (!pending || !context) return;
    const from = usePlayerStore.getState().playSeq;
    return usePlayerStore.subscribe((s) => {
      if (s.playSeq === from) return;
      track("play_hint_done", { context, result: "played" });
      markSeen(context);
      setDismissed((d) => (d.includes(context) ? d : [...d, context]));
    });
  }, [pending, context]);

  /**
   * 툴팁 크기를 잰다. 문구가 문맥마다 달라 폭이 고정이 아니고, 폭을 모르면 화면 안으로
   * 밀어 넣을 수가 없다. 문맥이 바뀌면 이 컴포넌트가 통째로 사라졌다 다시 붙으므로
   * ref 콜백이 다시 불려 값도 다시 잰다.
   */
  const [size, setSize] = useState({ w: 0, h: 0 });
  const measure = useCallback((el: HTMLDivElement | null) => {
    if (el) setSize({ w: el.offsetWidth, h: el.offsetHeight });
  }, []);

  /**
   * 말풍선이 넘어가면 안 되는 아래쪽 한계 (S15P21A405-417).
   *
   * 예전에는 **화면 끝만** 피해서, 별이 아래쪽에 있으면 말풍선이 **재생바 제목 위에 얹혔다.**
   * 좁은 화면에서 네비가 아래로 내려오며 재생바가 54px 위로 올라가자 더 도드라졌다.
   *
   * 떠 있는 HUD 는 전부 `[data-hud]` 를 달고 있고(`map-view.tsx` 가 지도 표식을 비킬 때 쓰는
   * 것과 같은 표시다), 그중 **화면 아래 절반에 있는 것들의 윗변**이 곧 한계다. 높이를 상수로
   * 박지 않는 이유는 재생바가 재생 상태에 따라 커지기 때문이다.
   */
  const bottomLimit = (left: number, right: number) => {
    const limit = window.innerHeight - EDGE;
    /**
     * **좁은 화면에서만 HUD 를 피한다.** 데스크톱에도 같은 겹침이 날 수 있지만, 이번 작업의
     * 전제가 "웹뷰 배치를 건드리지 않는다" 라 경계를 넘지 않는다. 데스크톱 쪽은 따로 다룬다.
     *
     * 폭을 여기서 읽어도 되는 이유는 `BREAKPOINTS` 주석이 말하는 대로 **이 계산이 이미
     * `window.innerWidth` 를 읽고 있는 하이드레이션 이후 코드**이기 때문이다. 렌더 분기가 아니다.
     */
    if (window.innerWidth >= BREAKPOINTS.tablet) return limit;
    let bounded = limit;
    for (const el of document.querySelectorAll("[data-hud]")) {
      const r = el.getBoundingClientRect();
      // **가로로 겹치는 것만** 센다. 안 그러면 옆으로 비켜 있는 HUD 때문에도 뒤집힌다.
      if (r.height > 0 && r.top > window.innerHeight / 2 && r.right > left && r.left < right) {
        bounded = Math.min(bounded, r.top - EDGE);
      }
    }
    return bounded;
  };

  /**
   * 별을 따라가되 화면 밖으로 넘치지 않게 가둔다. 재기 전(첫 렌더)에는 별 위치 그대로 두고,
   * 잰 뒤 한 번 더 그려지며 제자리를 잡는다 — 그 사이가 한 프레임이라 눈에 띄지 않는다.
   */
  const tip = (() => {
    if (!at) return { x: 0, y: 0 };
    if (!size.w) return { x: at.x, y: at.y + TIP_GAP };
    const half = size.w / 2;
    const x = Math.min(Math.max(at.x - half, EDGE), window.innerWidth - size.w - EDGE);
    // 아래에 자리가 없으면 별 위로 뒤집는다
    const below = at.y + TIP_GAP;
    const y = below + size.h > bottomLimit(x, x + size.w) ? at.y - TIP_GAP - size.h : below;
    return { x, y };
  })();

  const skip = () => {
    if (!context) return;
    track("play_hint_done", { context, result: "skipped" });
    markSeen(context);
    setDismissed((d) => (d.includes(context) ? d : [...d, context]));
  };

  // 홈에서만. 튜토리얼 화면도 MainScreen 을 쓰므로 여기서 갈라야 겹치지 않는다
  if (pathname !== ROUTES.home) return null;
  // 폰에서 시트가 펼쳐져 있으면 미룬다 — 위 주석 참고
  if (narrow && activePanel != null && !panelCollapsed) return null;
  if (!pending || !context || !at) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[55]">
      {/* 덤은 튜토리얼과 같은 한 겹을 쓴다. 구멍은 안 뚫는다 — 짚은 별을 위에 직접 그린다 */}
      <TutorialSpotlight spotlight={[]} />
      {/* 반짝이는 별. 튜토리얼의 짚은 별과 같은 모양이되 **누를 수 없다** — 진짜 별을 눌러야 한다 */}
      <i className="fixed block h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 rounded-pill bg-[radial-gradient(circle,rgba(79,227,206,.45)_0%,transparent_65%)]" style={{ left: at.x, top: at.y }} />
      <i className="animate-tbeat fixed block h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-pill border-2 border-teal" style={{ left: at.x, top: at.y }} />
      <i className="animate-tstar fixed block h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-white shadow-[0_0_18px_6px_rgba(79,227,206,.9)]" style={{ left: at.x, top: at.y }} />
      {/*
        툴팁은 별 아래에 붙는다 — 별 위는 반짝임 고리가 쓴다. 다만 **별을 그대로 따라가면
        화면 끝에서 잘린다** (S15P21A405-396): 짚을 별은 화면 안에서 고르지만 툴팁은 그 별보다
        넓어서, 왼쪽 끝 별에 붙이면 툴팁 왼쪽이 화면 밖으로 나간다. 그래서 잰 크기만큼 안으로 민다.
        아래에 자리가 없으면 위로 뒤집는다.
      */}
      <div className="animate-tin fixed" style={{ left: tip.x, top: tip.y }}>
        <div ref={measure} className="glass-liquid flex items-center gap-2 rounded-pill px-3 py-1.5 whitespace-nowrap">
          <span className="text-center text-[12.5px] text-ink">{LABEL[context]}</span>
          {/*
            안내가 주인이다 — 건너뛰기를 같은 무게로 두면 둘 중 무엇을 보라는 건지 안 읽힌다.
            크기·색은 안쪽 span 에 준다. 예전에는 **그래야만** 했다 — `globals.css` 의 기본 블록이
            레이어 밖에 있어 `button { font: inherit; color: inherit }` 가 버튼에 직접 건 유틸리티를
            이겼다. 그 원인은 `@layer base` 로 감싸 고쳤으므로(S15P21A405-384,
            docs/troubleshooting/014) **이제 버튼에 직접 걸어도 먹는다.** 여기는 굳이 바꾸지 않았다.
          */}
          <button type="button" onClick={skip} className="pointer-events-auto cursor-pointer">
            <span className="text-[11.5px] text-ink-3 transition-colors hover:text-ink">건너뛰기</span>
          </button>
        </div>
      </div>
    </div>
  );
}
