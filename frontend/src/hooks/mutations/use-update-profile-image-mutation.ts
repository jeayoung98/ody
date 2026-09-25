import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, CHANGED, QUERY_KEYS } from "@/constants";
import { useToastStore } from "@/stores/use-toast-store";
import { api } from "@/lib/api";
import { snapshotQueries } from "@/lib/query-snapshot";
import type { User, UserProfile } from "@/types";

/**
 * 프로필 사진 교체 (USER-02, S15P21A405-474).
 *
 * 백엔드가 **파일만** 받는다 — 주소 문자열을 보내는 길은 없다 (S15P21A405-426).
 * `FormData` 를 그대로 넘기면 `api()` 가 `Content-Type` 을 손대지 않아 경계 문자열이 맞는다.
 *
 * **지우는 길은 없다.** 백엔드에 삭제 API 가 없어서 다른 사진으로 덮는 것만 된다 (A-37).
 *
 * **고른 사진이 업로드 전에 화면 곳곳에 뜬다** (S15P21A405-675). 파일의 로컬 주소(`createObjectURL`)를 내 정보와
 * 내 프로필 캐시에 먼저 넣는다 — 폼 안의 미리보기만이 아니라 상단 아바타·마이페이지도 같이 바뀐다. 응답이 오면
 * 서버 주소로 갈아끼우고 로컬 주소를 거둔다. 실패하면 이전 사진으로 돌아간다.
 */
export function useUpdateProfileImageMutation() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  const setImage = (imageUrl: string) => {
    const me = qc.getQueryData<User>(QUERY_KEYS.auth.me);
    qc.setQueryData<User>(QUERY_KEYS.auth.me, (prev) => (prev ? { ...prev, imageUrl } : prev));
    if (me) qc.setQueryData<UserProfile>(QUERY_KEYS.user.profile(me.email), (prev) => (prev ? { ...prev, imageUrl } : prev));
  };
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file, file.name);
      return api<{ imageUrl: string }>(API_ENDPOINTS.user.image, { method: "PATCH", body: form });
    },
    onMutate: async (file) => {
      const restore = await snapshotQueries(qc, [QUERY_KEYS.auth.me, QUERY_KEYS.user.all]);
      const url = URL.createObjectURL(file);
      setImage(url);
      return { restore, url };
    },
    onError: (_e, _file, ctx) => {
      ctx?.restore();
      if (ctx) URL.revokeObjectURL(ctx.url);
    },
    onSuccess: (data, _file, ctx) => {
      setImage(data.imageUrl);
      if (ctx) URL.revokeObjectURL(ctx.url);
      showToast(CHANGED.profileImageChanged);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.user.all });
    },
  });
}
