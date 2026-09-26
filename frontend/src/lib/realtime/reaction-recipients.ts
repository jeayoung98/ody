/**
 * 반응을 받을 사람들 (SOCIAL-02, S15P21A405-699).
 *
 * **주변 사람 목록만으로는 선단이 빠진다.** 따라가는 사람은 지도에 올라가지 않아(백엔드 `RideService.mount` 5단계)
 * 인솔자의 주변 목록에 없고, 따라가는 쪽의 주변 구독은 탑승 때 서버가 끊는다. 그래서 인솔자가 반응해도 동승자에게
 * 안 갔다. 선단은 서로 가장 가까이 있는 사람들이라 빠지면 안 된다 — 인솔자면 내 동승자를, 동승자면 인솔자를 더한다.
 *
 * 동승자끼리는 서로를 모른다(동승자 명단이 동승자에게 안 온다) — 그건 백엔드가 명단을 줘야 풀린다.
 *
 * 같은 사람이 두 번 들어가면 두 번 보내고 두 번째가 쿨다운(429)에 걸린다. 한 번만 남긴다.
 */
export function reactionRecipients(people: readonly { email: string }[], leaderEmail: string | null, riders: readonly { email: string }[]): string[] {
  const out = new Set<string>();
  for (const p of people) out.add(p.email);
  if (leaderEmail) out.add(leaderEmail);
  for (const r of riders) out.add(r.email);
  return [...out];
}
