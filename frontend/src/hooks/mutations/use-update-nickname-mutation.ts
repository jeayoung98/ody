import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, CHANGED, QUERY_KEYS } from "@/constants";
import { useToastStore } from "@/stores/use-toast-store";
import { api } from "@/lib/api";
import { snapshotQueries } from "@/lib/query-snapshot";
import type { User, UserProfile } from "@/types";

/**
 * 닉네임 변경 (AUTH-01 · USER-02, S15P21A405-474).
 *
 * 가입 직후 닉네임 확정 화면과 프로필 수정 화면이 같이 쓴다. 예전에는 프로필 이미지와
 * 한 요청으로 보냈는데, 백엔드가 둘을 갈라 놓으면서 이미지는 파일 업로드가 됐다
 * (`useUpdateProfileImageMutation`).
 *
 * 성공하면 내 정보를 다시 읽어 상단 프로필·마이페이지가 곧바로 새 값을 보인다.
 *
 * **누르는 순간 이름이 바뀐다** (S15P21A405-675) — 내 정보와 내 프로필 캐시에 먼저 적는다. 실패하면 되돌린다.
 * 토스트는 띄우지 않는다: 두 폼(가입 직후·프로필 수정)이 오류 문구를 제자리에 보여 준다.
 */
export function useUpdateNicknameMutation() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: (nickname: string) =>
      api<{ nickname: string }>(API_ENDPOINTS.user.nickname, { method: "PATCH", body: JSON.stringify({ nickname }) }),
    onMutate: async (nickname) => {
      const restore = await snapshotQueries(qc, [QUERY_KEYS.auth.me, QUERY_KEYS.user.all]);
      const me = qc.getQueryData<User>(QUERY_KEYS.auth.me);
      qc.setQueryData<User>(QUERY_KEYS.auth.me, (prev) => (prev ? { ...prev, nickname } : prev));
      if (me) qc.setQueryData<UserProfile>(QUERY_KEYS.user.profile(me.email), (prev) => (prev ? { ...prev, nickname } : prev));
      return restore;
    },
    onError: (_e, _nickname, restore) => restore?.(),
    onSuccess: (data) => {
      showToast(CHANGED.nicknameChanged(data.nickname));
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.user.all });
    },
  });
}
