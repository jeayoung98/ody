/** 받침에 따라 "으로 / 로"를 고른다 (행성**으로**, 은하**로**) */
export function ro(word: string) {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  if (c < 0 || c >= 11172) return "로";
  const jong = c % 28;
  return jong === 0 || jong === 8 ? "로" : "으로";
}
