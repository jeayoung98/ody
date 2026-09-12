-- usercount-recount.lua — 셀 인원수 대조·복구(RT-23). 60초마다 무조건 실행
-- 저장된 cell:usercount 값 vs 실제(그 셀 곡들의 청취자 수 합)을 비교해 틀린 셀만 덮어쓴다.
-- 대조 도중 play 가 끼면 잘못 고치므로 한 레이어치를 한 원자 스크립트로 처리한다.
-- 어느 셀을 볼지(SCAN)는 Java 가 정해 셀 필드 목록으로 넘긴다.
--
-- KEYS[1] cell:usercount:{L}    -- 레이어별 셀 인원수 해시 (field "x:y" -> count)
--
-- ARGV[1]  layer            검증 대상 레이어
-- ARGV[2]  activeCellPrefix "active-song:cell:" (+ "L:x:y")  셀-곡 집합 키 접두
-- ARGV[3]  listenersPrefix  "listeners:"        (+ musicId)  청취자 집합 키 접두
-- ARGV[4..] 검증할 셀 필드 목록 "x:y" (Java 가 active-song SCAN + usercount HKEYS 합집합)
--
-- 반환: 불일치(수정)한 셀 수

local usercountKey    = KEYS[1]
local layer           = ARGV[1]
local activeCellPrefix = ARGV[2]
local listenersPrefix  = ARGV[3]

local mismatches = 0

for i = 4, #ARGV do
  local field = ARGV[i]                                   -- "x:y"
  local cellKey = activeCellPrefix .. layer .. ':' .. field

  -- 실제값: 이 셀에 있는 곡들의 청취자 수 합 (decision ②: 레이어 필터 없이 SCARD 합)
  local actual = 0
  local songs = redis.call('SMEMBERS', cellKey)
  for _, m in ipairs(songs) do
    actual = actual + redis.call('SCARD', listenersPrefix .. m)
  end

  local stored = tonumber(redis.call('HGET', usercountKey, field)) or 0
  if actual ~= stored then
    mismatches = mismatches + 1
    if actual > 0 then
      redis.call('HSET', usercountKey, field, actual)     -- 실제값으로 덮어쓰기
    else
      redis.call('HDEL', usercountKey, field)             -- 0 이면 필드 삭제
    end
  end
end

return mismatches
