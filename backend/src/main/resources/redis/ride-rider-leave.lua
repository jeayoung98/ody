-- ride-rider-leave.lua — 따라가던 사람 한 명이 사라졌을 때 그 사람만 뺀다 (RT-39).
--
-- 선단은 그대로 둔다. 인솔자가 사라진 것이 아니라 따라가던 사람이 사라진 것이다.
-- 지도에 다시 넣지 않는다. 사라진 사람이라 넣으면 유령이 된다.
--
-- ride:captain 과 ride:riders 는 서로 뒤집은 관계라 하나만 지우면 유령이 남는다.
-- 인솔자에게 남은 인원을 알려야 해서 지운 뒤 수를 같이 돌려준다.
--
-- KEYS[1] ride:captain:{사라진 사람}
--
-- ARGV[1] 사라진 사람 email   [2] 따라오는 사람들 키   [3] 그 사람의 접속 정보 키
--
-- 반환: {'OK', 인솔자, 남은 인원} 또는 {'NOT_RIDING'}

local rider = ARGV[1]
local P_riders = ARGV[2]

local captain = redis.call('HGET', KEYS[1], 'captain')
if not captain then
  return {'NOT_RIDING'}
end

local ridersKey = P_riders .. captain
redis.call('SREM', ridersKey, rider)
redis.call('DEL', KEYS[1])
-- riding 표시도 지운다. 지도에는 안 넣지만, 표시가 남으면 그 뒤 재생·입장이 거부된다.
redis.call('HDEL', ARGV[3], 'riding')

return {'OK', captain, tostring(redis.call('SCARD', ridersKey))}
