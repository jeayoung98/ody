-- presence-leave.lua — 이탈/만료 정리(RT-05) 원자 처리.
-- 곡·셀을 밖에서 읽으면 재생(play)과 경쟁하므로, presence 를 스크립트 안에서 읽어 정리한다(FR-024).
-- epoch 가드: 넘어온 epoch 와 저장된 epoch 가 같을 때만 정리(새 세션이 덮어썼으면 no-op).
--
-- KEYS[1] presence:user:{email}   -- 내 접속 상태(위치)
-- KEYS[2] presence:expiry         -- 만료 타이머 ZSET
--
-- ARGV[1] email             내 식별자 (listeners·expiry 멤버)
-- ARGV[2] epoch             세션 세대 (가드용)
-- ARGV[3] listenersPrefix   "listeners:"         (+ musicId)     청취자 집합 키 접두
-- ARGV[4] activeCellPrefix  "active-song:cell:"  (+ "L:x:y")     셀-곡 집합 키 접두
-- ARGV[5] usercountPrefix   "cell:usercount:"    (+ layer)       셀 인원수 해시 키 접두
--
-- 반환: 제거된 {musicId, layer, cellX, cellY} (LEAVE 델타용). no-op/비노출이면 {} .

local email = ARGV[1]

-- 0) 존재 확인 (presence 없는데 만료큐에만 남은 고아 항목은 정리하고 종료)
if redis.call('EXISTS', KEYS[1]) == 0 then
  redis.call('ZREM', KEYS[2], email)
  return {}
end

-- 1) epoch 가드 — 다르면 새 세션이 이미 덮어쓴 것 → 건드리지 않음
local storedEpoch = redis.call('HGET', KEYS[1], 'epoch')
if storedEpoch ~= ARGV[2] then
  return {}
end

-- 2) 곡·셀을 스크립트 안에서 읽기 (play 와 경쟁 없음)
local musicId = redis.call('HGET', KEYS[1], 'musicId')
local layer   = redis.call('HGET', KEYS[1], 'layer')
local cellX   = redis.call('HGET', KEYS[1], 'cellX')
local cellY   = redis.call('HGET', KEYS[1], 'cellY')

-- 3) 노출 상태였으면(곡 있음) 청취자/셀/인원수 정리
local removed = {}
if musicId then
  local listenersKey = ARGV[3] .. musicId
  local cellField    = cellX .. ':' .. cellY
  local cellKey      = ARGV[4] .. layer .. ':' .. cellField
  local usercountKey = ARGV[5] .. layer

  redis.call('SREM', listenersKey, email)
  if redis.call('SCARD', listenersKey) == 0 then
    redis.call('SREM', cellKey, musicId)            -- 청취자 0 → 이 셀에서 곡 제거
  end
  local c = redis.call('HINCRBY', usercountKey, cellField, -1)
  if c <= 0 then
    redis.call('HDEL', usercountKey, cellField)     -- 0 이하면 필드 삭제
  end
  removed = {musicId, layer, cellX, cellY}
end

-- 4) presence 삭제 + 만료 큐에서 제거
redis.call('DEL', KEYS[1])
redis.call('ZREM', KEYS[2], email)

-- 5) 제거 정보 반환(없거나 비노출이면 {})
return removed
