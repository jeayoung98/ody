"use client";

import Button from "@/components/common/button";

/** 필수로 답해야 하는 설문 둘 — 이번 테스트의 핵심이다 */
const SURVEYS = [
  {
    code: "JOURNEY",
    title: "여정 설문",
    body: "출발곡 → 도착곡으로 여정을 만들면, 그 경로에 놓인 곡들을 순서대로 들었을 때 자연스럽게 이어지는지 물어봅니다.",
    asks: ["자연스럽게 이어지나요? — 예 / 아니오", "아니오라면 — 왜 어색하게 느껴졌는지 한 줄로"],
  },
  {
    code: "NEARBY",
    title: "주변 탐색 설문",
    body: "한 곡을 고르면 뜨는 주변 음악 목록이, 실제로 그 곡과 가깝게 들리는지 물어봅니다.",
    asks: ["실제로 가깝게 느껴지나요? — 예 / 아니오"],
  },
] as const;

/**
 * 유저 테스트 안내 (S15P21A405-343). 튜토리얼 **앞에** 한 장 끼는 전체 화면이다.
 *
 * 테스터가 바로 지도로 떨어지면 이번 테스트가 무엇을 보려는 것인지 모른 채 시작한다. 특히
 * **설문 2개가 이번 테스트의 전부**인데 그걸 모르고 지나치면 집계할 것이 없다. 감춰 둔
 * 기능(S15P21A405-333)을 고장으로 오해하는 것도 여기서 미리 막는다.
 *
 * 지도 위에 얹지 않고 화면을 통째로 덮는다 — 읽고 시작하는 자리라 뒤가 보일 이유가 없다.
 */
export default function TestGuide({ onStart }: { onStart: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-void">
      {/* 별이 깔린 머리말 — 앱 안으로 들어간다는 게 첫 화면에서 읽혀야 한다 */}
      <header className="relative overflow-hidden px-6 pt-14 pb-10">
        <i className="grad-bg pointer-events-none absolute inset-0 opacity-25 [mask:radial-gradient(120%_140%_at_15%_0%,#000_0%,transparent_60%)]" />
        <div className="relative mx-auto w-full max-w-[640px] flex flex-col gap-3">
          <span className="lbl text-azure">A405 · SSAFY 빅데이터 특화 프로젝트</span>
          <h1 className="m-0 font-display text-[clamp(1.6rem,5vw,2.1rem)] leading-[1.25] font-bold text-balance">ODY 사용자 테스트 가이드</h1>
          <p className="m-0 max-w-[52ch] text-[13.5px] leading-[1.7] text-ink-2">
            곡을 <b className="font-medium text-ink">소리가 닮은 정도</b>로 배치한 별자리 지도, ODY를 테스트해주셔서 감사합니다. 시작 전에 아래 내용만
            가볍게 읽어주세요.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-3 px-6 pb-10">
        <section className="glass flex flex-col gap-2 rounded-box p-5">
          <h2 className="m-0 font-display text-[15px] font-semibold">지금 화면에 대해 알아두면 좋을 것</h2>
          <p className="m-0 text-[13px] leading-[1.7] text-ink-2">
            지금 버전은 <b className="font-medium text-ink">이번 테스트에 필요한 기능만</b> 켜져 있고, 그 범위 안에서는 정상적으로 동작합니다. 눌리지
            않거나 비어 있는 메뉴가 있어도 오류가 아니라 의도적으로 꺼둔 것이니 신경 쓰지 않으셔도 됩니다.
          </p>
        </section>

        <section className="glass flex flex-col gap-2 rounded-box p-5">
          <span className="lbl self-start rounded-pill border border-teal/35 bg-teal/[.12] px-2.5 py-1 text-teal">왜 하는 테스트인가</span>
          <p className="m-0 text-[13px] leading-[1.7] text-ink-2">
            ODY는 곡을 <b className="font-medium text-ink">음향 특성 기반 유사도</b>로 지도 위에 배치합니다. 이번 테스트의 목적은 그{" "}
            <b className="font-medium text-ink">음악 데이터를 정제</b>하는 것입니다 — 계산상 &ldquo;닮았다&rdquo;고 나온 곡들이 실제로 들었을 때도 닮게
            느껴지는지, 사람 귀로 확인하는 단계입니다.
          </p>
        </section>

        <section className="glass flex flex-col gap-3 rounded-box border-warn/35! p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="lbl rounded-pill border border-warn/40 bg-warn/[.12] px-2.5 py-1 text-warn">필수</span>
            <h2 className="m-0 font-display text-[15px] font-semibold">이것만은 꼭 — 설문 2개</h2>
          </div>
          <p className="m-0 text-[13px] leading-[1.7] text-ink-2">
            테스트 중 아래 설문이 뜨면 <b className="font-medium text-ink">가장 먼저, 반드시</b> 응답해주세요. 이번 테스트에서 제일 중요한 부분입니다.
          </p>
          {SURVEYS.map((s) => (
            <div key={s.code} className="flex flex-col gap-1.5 border-t border-line pt-3.5">
              <div className="flex items-baseline gap-2.5">
                <span className="num text-[10.5px] tracking-[0.06em] text-violet">{s.code}</span>
                <h3 className="m-0 font-display text-[13.5px] font-semibold">{s.title}</h3>
              </div>
              <p className="m-0 text-[13px] leading-[1.7] text-ink-2">{s.body}</p>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-[1.15em] text-[13px] leading-[1.7] text-ink-2">
                {s.asks.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="glass flex flex-col gap-2 rounded-box p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="lbl rounded-pill border border-line-2 bg-white/[.05] px-2.5 py-1 text-ink-2">선택</span>
            <h2 className="m-0 font-display text-[15px] font-semibold">사용성 피드백</h2>
          </div>
          <p className="m-0 text-[13px] leading-[1.7] text-ink-2">
            화면이 헷갈리거나 더 나았으면 하는 부분이 있다면 알려주시면 좋지만, <b className="font-medium text-ink">필수는 아닙니다.</b> 있으시면{" "}
            <b className="font-medium text-ink">A405팀 누구에게나</b> 개인 DM으로 편하게 보내주세요.
          </p>
        </section>

        <section className="rounded-box border border-dashed border-line-2 bg-white/[.03] p-5">
          <h2 className="m-0 mb-2.5 font-display text-[14px] font-semibold">정리하면</h2>
          <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-[1.3em] text-[13px] leading-[1.7] text-ink-2">
            <li>지금 켜진 기능만 사용 — 나머지는 의도적으로 꺼둔 것</li>
            <li>
              <b className="font-medium text-ink">여정 / 주변 탐색 설문</b> — 뜨면 무조건 응답
            </li>
            <li>사용성 피드백 — 있으면 좋고, A405팀에게 개인 DM (선택)</li>
          </ol>
        </section>

        <Button variant="primary" className="mt-1 justify-center py-3!" onClick={onStart}>
          읽었어요 · 시작하기
        </Button>
        <p className="m-0 text-center text-[11px] text-ink-4">다음 화면에서 지도 사용법을 짧게 안내해드려요.</p>
      </main>
    </div>
  );
}
