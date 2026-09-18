"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Box from "@/components/common/box";
import Button from "@/components/common/button";
import IconButton from "@/components/common/icon-button";
import { CloseIcon } from "@/components/common/icons";
import Note from "@/components/common/note";
import {
  REPORT_DETAIL_MAX,
  REPORT_DETAIL_PLACEHOLDER,
  REPORT_FAILED_NOTICE,
  REPORT_NEEDS_DETAIL,
  reportReasonsFor,
  REPORT_SENT_NOTICE,
  type ReportReason,
} from "@/constants";
import { useReportMusicMutation } from "@/hooks/mutations/use-report-music-mutation";
import { useToastStore } from "@/stores/use-toast-store";

interface SongReportDialogProps {
  musicId: number;
  /**
   * 그 곡이 **찾아봤는데 없는** 상태인가 (S15P21A405-397). 여는 쪽이 이미 `usePlayability` 로
   * 들고 있는 판정을 넘겨받는다 — 팝업이 같은 조회를 다시 하면 답이 갈릴 수 있다.
   */
  unplayable?: boolean;
  /** 곡 제목 — 어느 곡을 신고하는지 보여줘야 잘못 누른 것을 알아챈다 */
  title: string;
  onClose: () => void;
}

/**
 * 곡 신고 팝업 (S15P21A405-378).
 *
 * 예전에는 패널 안에서 펼쳐졌는데, 무게가 없고 패널을 아래로 밀어냈다. 설문 카드와 같은 꺼풀을
 * 써서 화면 가운데 띄운다 — 고르는 동안 다른 것을 건드리지 않는다.
 *
 * **설문 카드와 달리 빠져나올 길을 둔다.** 설문은 답을 강제하는 자리라 바깥 클릭·ESC 를 일부러
 * 막아 뒀지만(`survey-card.tsx`), 신고는 사용자가 스스로 연 자리다. 잘못 눌렀을 때 갇히면 안 된다.
 *
 * 고르면 바로 보내고 닫는다. 확인 단계를 두지 않았다 — 사유 자체가 이미 선택이고, 한 번 더
 * 묻는 만큼 신고가 줄어든다. 전송 결과는 기다리지 않는다. 실패해도 사용자가 할 수 있는 게 없다.
 *
 * **`기타`만 예외다** (S15P21A405-394). 나머지 사유는 목록 자체가 무엇이 문제인지 말해 주는데
 * 기타는 아무것도 말해 주지 않는다 — 적지 않으면 받아도 고칠 수가 없다. 그래서 그 하나만
 * 입력칸을 열고, 비어 있으면 못 보내게 한다.
 *
 * **`document.body` 로 빼서 그린다.** 우측 패널 안에 그대로 두면 `fixed inset-0` 이 화면이 아니라
 * **패널 안에 갇힌다** — 조상에 `transform`·`filter` 가 걸려 있으면 그것이 고정 위치의 기준이 되기
 * 때문이다. 실제로 그래서 팝업이 패널 폭 안에 뜨고 바깥 클릭도 안 먹었다. 설문 카드가 멀쩡한 것은
 * 그쪽이 패널이 아니라 화면 루트(`main-screen`)에 붙어 있어서다.
 */
export default function SongReportDialog({ musicId, title, unplayable = false, onClose }: SongReportDialogProps) {
  const report = useReportMusicMutation();
  const showToast = useToastStore((s) => s.show);
  /** 상세를 받아야 하는 사유를 고른 상태. null 이면 아직 목록을 보고 있다 */
  const [detailFor, setDetailFor] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = (reason: ReportReason, detailReason?: string) => {
    report.mutate(
      { musicId, reason, detailReason },
      { onSuccess: () => showToast(REPORT_SENT_NOTICE), onError: () => showToast(REPORT_FAILED_NOTICE) },
    );
    onClose();
  };

  /** 상세가 필요한 사유는 한 칸 더 간다. 나머지는 지금까지처럼 누르는 즉시 보낸다 */
  const pick = (reason: ReportReason) => (reason === REPORT_NEEDS_DETAIL ? setDetailFor(reason) : send(reason));

  const trimmed = detail.trim();
  const reasons = reportReasonsFor(unplayable);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay backdrop-blur-sm" onClick={onClose}>
      {/* 상자 안을 눌러도 닫히지 않게 — 바깥을 눌렀을 때만 닫는다 */}
      <div
        className="w-full max-w-sm animate-tin"
        role="dialog"
        aria-modal="true"
        aria-label="곡 신고"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기는 헤더 우상단 X 하나 — 다른 상자들과 같은 자리다. 목록 아래 텍스트 버튼은 상자를 무겁게 했다 */}
        <Box
          title="이 곡을 신고할까요"
          actions={
            <IconButton label="닫기" onClick={onClose} className="text-ink-2!">
              <CloseIcon />
            </IconButton>
          }
        >
          <p className="truncate text-[13px] text-ink-2">{title}</p>
          {detailFor ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="lbl text-ink-3">어떤 점이 문제인가요</span>
                <textarea
                  autoFocus
                  rows={3}
                  value={detail}
                  maxLength={REPORT_DETAIL_MAX}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder={REPORT_DETAIL_PLACEHOLDER}
                  className="w-full resize-none rounded-box border border-line bg-glass px-3 py-2 text-[13px] text-ink placeholder:text-ink-4 focus:border-teal focus:outline-none"
                />
              </label>
              <div className="flex gap-2">
                {/* 적은 것을 버리고 목록으로. 잘못 눌렀을 때 닫았다 다시 열게 하지 않는다 */}
                <Button size="sm" onClick={() => (setDetailFor(null), setDetail(""))}>
                  뒤로
                </Button>
                {/* 비어 있으면 못 보낸다 — 빈 기타 신고는 받아도 고칠 수가 없다 */}
                <Button variant="primary" size="sm" className="flex-1" disabled={!trimmed} onClick={() => send(detailFor, trimmed)}>
                  보내기
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                {reasons.map((r) => (
                  <Button key={r.value} className="justify-start! text-left" onClick={() => pick(r.value)}>
                    <span className="font-medium">{r.label}</span>
                    <span className="ml-1.5 text-[11.5px] text-ink-3">{r.detail}</span>
                  </Button>
                ))}
              </div>
              <Note>보낸 신고는 이 곡의 데이터를 고치는 데만 씁니다.</Note>
            </>
          )}
        </Box>
      </div>
    </div>,
    document.body,
  );
}
