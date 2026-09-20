-- ride-mount.lua — 따라가기 시작(RT-30·RT-31). 검사와 등록을 한 번에 한다.
-- 검사만 하고 나중에 등록하면 그 사이에 정원이 차거나 대상이 나갈 수 있다.
--
-- KEYS[1] presence:user:{따라가는 사람}   접속 번호 확인
-- KEYS[2] presence:user:{인솔자}          곡 위에 서 있는지 확인
-- KEYS[3] ride:captain:{따라가는 사람}    이미 따라가는 중인지
-- KEYS[4] ride:riders:{따라가는 사람}     나를 따라오는 사람이 있는지
-- KEYS[5] ride:captain:{인솔자}           대상이 남을 따라가는 중인지
-- KEYS[6] ride:riders:{인솔자}            정원 확인 + 등록
--
-- ARGV[1] 따라가는 사람 email  [2] 인솔자 email  [3] 확인할 접속 번호  [4] 정원
--
-- 반환: {'OK', 인솔자 곡, 인솔자 레이어} 또는 거부 사유 하나.

local rider = ARGV[1]
local captain = ARGV[2]
local expectedEpoch = ARGV[3]
local maxRiders = tonumber(ARGV[4])

-- 1) 지금 소켓에서 온 요청인가. 재연결 전 탭이 보낸 요청은 버린다.
local riderEpoch = redis.call('HGET', KEYS[1], 'epoch')
if (not riderEpoch) or riderEpoch ~= expectedEpoch then
  return {'STALE'}
end

-- 2) 이미 누군가를 따라가는 중인가. 자동으로 갈아타지 않는다.
if redis.call('EXISTS', KEYS[3]) == 1 then
  return {'ALREADY'}
end

-- 3) 줄줄이 따라가기 금지. 양쪽 다 막는다.
--    따라오는 사람을 두고 또 따라가면 전파가 갈래를 치고 해체가 재귀가 된다.
if redis.call('SCARD', KEYS[4]) > 0 then
  return {'CHAIN_HAS_RIDERS'}
end
if redis.call('EXISTS', KEYS[5]) == 1 then
  return {'CHAIN_TARGET_RIDING'}
end

-- 4) 대상이 곡 위에 서 있는가. 접속만 하고 아직 안 튼 사람은 따라갈 자리가 없다.
local captainMusic = redis.call('HGET', KEYS[2], 'musicId')
local captainLayer = redis.call('HGET', KEYS[2], 'layer')
if (not captainMusic) or captainMusic == '' or (not captainLayer) or captainLayer == '' then
  return {'CAPTAIN_INACTIVE'}
end

-- 5) 자리가 남았는가.
if redis.call('SCARD', KEYS[6]) >= maxRiders then
  return {'FULL'}
end

-- 6) 등록. 두 키가 서로 뒤집은 관계라 여기서 같이 만든다.
redis.call('HSET', KEYS[3], 'captain', captain, 'epoch', expectedEpoch)
redis.call('SADD', KEYS[6], rider)

return {'OK', captainMusic, captainLayer}
