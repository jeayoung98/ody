-- 곡 변경 원자 갱신 (골격 스텁 — 실제 로직은 내부작업, R-04).
-- KEYS: listeners:{old}, listeners:{new}, active-song:cell:{L}:{ox}:{oy},
--       active-song:cell:{L}:{nx}:{ny}, cell:usercount:{L}, presence:user:{email}
-- ARGV: email, oldMusicId(""=없음), newMusicId, layer, x, y, cellX, cellY, epoch, ttlMs
-- return: 진입 직전 신곡 청취자 목록. old 불일치면 {-1}
return {}
