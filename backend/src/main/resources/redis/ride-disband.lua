-- ride-disband.lua — 선단을 통째로 흩고 지도로 돌려보낸다 (RT-39).
--
-- 인솔자가 연결을 끊거나 접속이 만료되면 따라가던 사람 전원이 강제로 내린다.
-- 85 의 하차를 N 명에게 한 번에 한 것이다. 한 명씩 나눠 하면 그 사이에
-- "따라가지도 않고 지도에도 없는" 사람이 생기고, 스무 명이면 그 구간이 스무 배 길다.
--
-- 서 있는 자리는 각자의 presence 에 있다. 따라가는 동안 인솔자를 따라 계속 갱신됐으므로
-- 전원이 인솔자의 마지막 곡 위에 있다. 인솔자의 presence 는 이미 지워졌을 수 있어 보지 않는다.
--
-- 흩는 대상은 이 인솔자의 선단 하나다. 지도에 있는 다른 선단은 건드리지 않는다.
--
-- 그 곡에 원래 있던 사람들은 아무도 다시 넣기 전에 한 번만 읽는다.
-- 한 명씩 넣으면서 읽으면, 먼저 들어간 동료가 뒤에 넣는 사람의 명단에 남으로 잡힌다.
-- 같은 선단이었으니 만남이 아닌데도 그렇다.
--
-- KEYS[1] ride:riders:{인솔자}
-- KEYS[2] ride:playback:{인솔자}
-- KEYS[3] ride:panel:{인솔자}
--
-- ARGV[1] 인솔자 email
--   [2] 사용자 상태 키   [3] 따라가는 대상 키
--   [4] 곡별 청취자 키   [5] 레이어별 청취자 키
--   [6] 셀별 재생 곡 키  [7] 사용 중인 셀 키   [8] 셀별 사용자 수 키
--
-- 반환: {'OK', 곡, 레이어, 셀X, 셀Y, 내린 사람 수, 원래 있던 사람 수, 내린 사람들..., 원래 있던 사람들...}
--       또는 {'NO_RIDERS'} — 따라오던 사람이 없었다. 남은 키는 그래도 지운다.

local P_pre, P_cap = ARGV[2], ARGV[3]
local P_lis, P_ll = ARGV[4], ARGV[5]
local P_cell, P_cells, P_uc = ARGV[6], ARGV[7], ARGV[8]

-- 1) 따라오던 사람 전원.
local riders = redis.call('SMEMBERS', KEYS[1])

-- 2) 따라오던 사람이 없어도 남은 키는 지운다. 고아 키가 남으면 다음 선단이 물려받는다.
if #riders == 0 then
  redis.call('DEL', KEYS[1], KEYS[2], KEYS[3])
  return {'NO_RIDERS'}
end

-- 3) 각자 서 있는 자리를 읽는다. 아직 아무도 지도에 넣지 않았다.
local spots = {}
local musicId, layer, cellX, cellY
for i = 1, #riders do
  local pk = P_pre .. riders[i]
  local s = redis.call('HMGET', pk, 'musicId', 'layer', 'cellX', 'cellY')
  spots[i] = s
  -- 전원이 인솔자의 마지막 곡에 있다. 그중 하나를 선단의 자리로 삼는다.
  if (not musicId) and s[1] and s[1] ~= '' and s[2] and s[2] ~= '' then
    musicId, layer, cellX, cellY = s[1], s[2], s[3], s[4]
  end
end

-- 4) 그 곡에 원래 있던 사람들. 아직 아무도 안 넣었으니 이 선단 사람은 여기 없다.
local residents = {}
if musicId then
  residents = redis.call('SMEMBERS', P_ll .. layer .. ':' .. musicId)
end

-- 5) 한 명씩 등록을 지우고 지도에 다시 넣는다.
local left = {}
for i = 1, #riders do
  local rider = riders[i]
  redis.call('DEL', P_cap .. rider)

  local s = spots[i]
  -- 접속 정보가 없으면 그 사람도 이미 나간 것이다. 지도에 넣지 않는다.
  if s[1] and s[1] ~= '' and s[2] and s[2] ~= '' then
    local cf = s[3] .. ':' .. s[4]
    -- riding 표시를 지운다. 이제 자리와 지도가 다시 일치한다.
    redis.call('HDEL', P_pre .. rider, 'riding')
    redis.call('SADD', P_lis .. s[1], rider)
    redis.call('SADD', P_ll .. s[2] .. ':' .. s[1], rider)
    redis.call('SADD', P_cell .. s[2] .. ':' .. cf, s[1])
    redis.call('SADD', P_cells .. s[2], cf)
    redis.call('HINCRBY', P_uc .. s[2], cf, 1)
    left[#left + 1] = rider
  end
end

-- 6) 선단의 흔적을 지운다. 따라가는 대상 · 재생 정보 · 열어 둔 곡 상세.
redis.call('DEL', KEYS[1], KEYS[2], KEYS[3])

local out = {'OK', musicId or '', layer or '', cellX or '', cellY or '',
             tostring(#left), tostring(#residents)}
for i = 1, #left do out[#out + 1] = left[i] end
for i = 1, #residents do out[#out + 1] = residents[i] end
return out
