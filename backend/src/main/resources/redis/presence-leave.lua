-- 이탈 정리 원자 (골격 스텁 — 실제 로직은 내부작업, R-04).
-- 스크립트 안에서 playingMusicId·셀을 읽어 정리한다(밖에서 읽으면 곡 변경과 경쟁, FR-024).
-- KEYS: presence:user:{email}, cell:usercount:{L}
-- ARGV: email, epoch
-- return: 제거된 {musicId, layer, cellX, cellY} 또는 {} (epoch 불일치=no-op)
return {}
