-- 셀 인원수 재검증 (골격 스텁 — 실제 로직은 내부작업, R-04).
-- KEYS: cell:usercount:{L}
-- ARGV: 셀 키 목록(SCAN 은 Java) → 곡별 SCARD 합과 비교 → 불일치 덮어쓰기
-- return: 불일치 셀 수
return 0
