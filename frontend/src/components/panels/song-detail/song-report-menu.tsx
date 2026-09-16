"use client";

import Box from "@/components/common/box";
import Button from "@/components/common/button";
import Note from "@/components/common/note";
import { REPORT_FAILED_NOTICE, REPORT_REASONS, REPORT_SENT_NOTICE, type ReportReason } from "@/constants";
import { useReportMusicMutation } from "@/hooks/mutations/use-report-music-mutation";
import { useToastStore } from "@/stores/use-toast-store";

interface SongReportMenuProps {
  musicId: number;
  /** 사유를 고르거나 취소했다 — 여는 쪽이 목록을 닫는다 */
  onDone: () => void;
}

/**
 * 곡 신고 사유 고르기 (S15P21A405-377).
 *
 * **고르면 바로 보내고 닫는다.** 확인 단계를 두지 않았다 — 사유 자체가 이미 선택이고, 한 번 더
 * 묻는 만큼 신고가 줄어든다. 잘못 눌러도 되돌릴 게 없는 가벼운 신호라 그 편이 맞다.
 *
 * 전송 결과를 기다리지 않고 닫는다. 목록을 붙잡아 두면 사용자는 답을 기다리는데, 이 신호는
 * 실패해도 사용자가 할 수 있는 게 없다 — 결과는 알림으로만 알려 준다.
 */
export default function SongReportMenu({ musicId, onDone }: SongReportMenuProps) {
  const report = useReportMusicMutation();
  const showToast = useToastStore((s) => s.show);

  const send = (reason: ReportReason) => {
    report.mutate(
      { musicId, reason },
      {
        onSuccess: () => showToast(REPORT_SENT_NOTICE),
        onError: () => showToast(REPORT_FAILED_NOTICE),
      },
    );
    onDone();
  };

  return (
    <Box title="무엇이 문제인가요">
      <div className="flex flex-col gap-1.5">
        {REPORT_REASONS.map((r) => (
          <Button key={r.value} className="justify-start! text-left" onClick={() => send(r.value)}>
            <span className="font-medium">{r.label}</span>
            <span className="ml-1.5 text-[11.5px] text-ink-3">{r.detail}</span>
          </Button>
        ))}
      </div>
      <Note>보낸 신고는 이 곡의 데이터를 고치는 데만 씁니다.</Note>
      <Button size="sm" onClick={onDone}>
        취소
      </Button>
    </Box>
  );
}
