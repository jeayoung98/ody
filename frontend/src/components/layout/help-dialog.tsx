"use client";

import Box from "@/components/common/box";
import { CloseIcon } from "@/components/common/icons";
import IconButton from "@/components/common/icon-button";
import { LAYER_COUNT, NEARBY_COUNT } from "@/constants";

const HELP_ITEMS = [
  { icon: "🗺️", title: "지도", body: `음악을 좌표로 만든 별지도예요. ${LAYER_COUNT}개의 레이어가 있고, 각 레이어는 2개의 축으로 이루어져요.` },
  { icon: "⭐", title: "별", body: "별 하나가 곡 하나예요. 색은 장르, 크기와 밝기는 재생수에 따라 달라져요." },
  { icon: "🔍", title: "파고들기", body: "확대하다 일정 이상 들어가면 다음 레이어로 파고들어요. 새 축 2개가 추가되며 좌표가 재정렬돼요." },
  { icon: "📡", title: "주변 탐색", body: `선택한 곡과 가장 가까운 ${NEARBY_COUNT}곡을 선으로 이어서 보여줘요. 줌아웃하면 해제돼요.` },
  { icon: "✨", title: "별자리", body: "여정이나 플레이리스트처럼 곡 뭉치가 있을 때 별을 선으로 이어 별자리처럼 보여줘요." },
  { icon: "📍", title: "내 위치", body: "청록색 마름모가 나예요. 별을 클릭하면 그 곡이 재생되면서 내 위치가 그리로 옮겨지고, 화면도 내 위치로 정렬돼요." },
  { icon: "🚀", title: "따라가기", body: "다른 사람의 우주선에 탑승해 탐색 여정을 함께해요. 탑승 중엔 지도 조작이 잠기고 하차 버튼으로 내릴 수 있어요." },
];

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md animate-tin">
        <Box
          title="ODY 사용법"
          code="help"
          actions={
            <IconButton label="닫기" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          }
        >
          <ul className="flex flex-col gap-3">
            {HELP_ITEMS.map((item) => (
              <li key={item.title} className="flex gap-3 text-sm">
                <span className="text-xl leading-none">{item.icon}</span>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs leading-relaxed text-ink-2">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Box>
      </div>
    </div>
  );
}
