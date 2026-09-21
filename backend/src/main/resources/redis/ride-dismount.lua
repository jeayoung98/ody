-- ride-dismount.lua — 따라가기를 끝내고 지도로 돌아온다 (RT-38).
--
-- 두 가지를 한 번에 한다.
--   1) 따라가기 등록 지우기 — ride:riders 에서 빼고 ride:captain 삭제.
--      두 키는 서로 뒤집은 관계라 하나만 지우면 유령이 남는다.
--   2) 지도에 다시 넣기 — 탈 때 ride-place.lua 가 뺐기 때문에 지금은 아무에게도 안 보인다.
--      넣지 않으면 내린 뒤에도 유령으로 남아 남들 화면과 주변 사람 목록에 안 잡힌다.
--
-- 둘을 나누면 그 사이에 "따라가지도 않고 지도에도 없는" 순간이 생긴다.
-- 서 있는 자리는 presence 에 그대로 있다. 인솔자가 마지막으로 있던 곡이다.
--
-- KEYS[1] presence:user:{내리는 사람}
-- KEYS[2] ride:captain:{내리는 사람}
-- KEYS[3] ride:riders:{인솔자}
--
-- ARGV[1] 내리는 사람 email   [2] 인솔자 email
--   [3] 곡별 청취자 키   [4] 레이어별 청취자 키
--   [5] 셀별 재생 곡 키  [6] 사용 중인 셀 키   [7] 셀별 사용자 수 키
--
-- 반환: {'OK', 곡, 레이어, 셀X, 셀Y, 남은 인원} 또는 {'NOT_RIDING'} · {'STALE'}

local rider = ARGV[1]
local captain = ARGV[2]

-- 1) 접속이 살아 있는가.
if redis.call('EXISTS', KEYS[1]) == 0 then
  return {'STALE'}
end

-- 2) 따라가는 중인가.
if redis.call('EXISTS', KEYS[2]) == 0 then
  return {'NOT_RIDING'}
end

-- 3) 넘어온 인솔자가 실제와 같은가. 다르면 그 사이에 갈아탄 것이다.
local storedCaptain = redis.call('HGET', KEYS[2], 'captain')
if storedCaptain ~= captain then
  return {'STALE'}
end

-- 4) 이 탑승이 지금 연결에서 만든 것인가.
--    다르면 이전 연결 때 만든 탑승이라 지금 요청으로 지우지 않는다.
local mountEpoch = redis.call('HGET', KEYS[2], 'epoch')
local currentEpoch = redis.call('HGET', KEYS[1], 'epoch')
if (not mountEpoch) or (not currentEpoch) or mountEpoch ~= currentEpoch then
  return {'STALE'}
end

-- 5) 서 있는 자리를 읽는다. 이 값으로 지도에 다시 넣는다.
local musicId = redis.call('HGET', KEYS[1], 'musicId')
local layer = redis.call('HGET', KEYS[1], 'layer')
local cellX = redis.call('HGET', KEYS[1], 'cellX')
local cellY = redis.call('HGET', KEYS[1], 'cellY')
if (not musicId) or musicId == '' or (not layer) or layer == '' then
  return {'STALE'}
end

-- 6) 등록을 지운다. 두 키를 같이 바꾼다.
redis.call('SREM', KEYS[3], rider)
redis.call('DEL', KEYS[2])

-- 7) 지도에 다시 넣는다. 이제 남들 화면에 한 점으로 보인다.
local P_lis, P_ll = ARGV[3], ARGV[4]
local P_cell, P_cells, P_uc = ARGV[5], ARGV[6], ARGV[7]
local cellField = cellX .. ':' .. cellY

redis.call('SADD', P_lis .. musicId, rider)
redis.call('SADD', P_ll .. layer .. ':' .. musicId, rider)
redis.call('SADD', P_cell .. layer .. ':' .. cellField, musicId)
redis.call('SADD', P_cells .. layer, cellField)
redis.call('HINCRBY', P_uc .. layer, cellField, 1)

return {'OK', musicId, layer, cellX, cellY, tostring(redis.call('SCARD', KEYS[3]))}
