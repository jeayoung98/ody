/** 마지막 글자에 받침이 있는지 */
function hasBatchim(word: string): boolean {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}

/** 을/를 */
export function eulReul(word: string): string {
  return hasBatchim(word) ? "을" : "를";
}

/** 이/가 */
export function iGa(word: string): string {
  return hasBatchim(word) ? "이" : "가";
}
