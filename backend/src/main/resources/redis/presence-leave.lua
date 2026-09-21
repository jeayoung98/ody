-- 사용자가 나갈 때 재생 상태와 실시간 구독을 함께 지운다.

-- KEYS[1] 사용자 상태
-- KEYS[2] 접속 만료 목록
-- KEYS[3] 주변사람 구독 정보
-- KEYS[4] 현재 화면 정보
--
-- ARGV[1] 사용자 이메일
-- ARGV[2] 접속 버전
-- ARGV[3] 만료 확인 시각
-- ARGV[4] 곡별 청취자 키
-- ARGV[5] 레이어별 청취자 키
-- ARGV[6] 셀별 재생 곡 키
-- ARGV[7] 사용 중인 셀 키
-- ARGV[8] 셀별 사용자 수 키
-- ARGV[9] 곡별 주변사람 구독 키
-- ARGV[10] 셀별 화면 구독 키
-- ARGV[11] 셀별 인원수 화면 구독 키
--
-- 반환: 지운 곡, 위치, 접속 버전. 지울 자리가 없었으면 빈 목록.
--       옛 접속의 종료 요청이거나 아직 만료 전이면 {'SKIPPED'} — 아무것도 건드리지 않았다는 뜻이다.
--       부르는 쪽은 이때 따라가기도 그대로 둬야 한다. 그 사람은 아직 접속해 있다.

local email     = ARGV[1]
local epoch     = ARGV[2]
local sweepTime = ARGV[3]

local function removeNearbySubscriptions()
  local musicIds = redis.call('HGET', KEYS[3], 'musicIds') or ''
  for musicId in string.gmatch(musicIds, '[^,]+') do
    redis.call('SREM', ARGV[9] .. musicId, email)
  end
  redis.call('DEL', KEYS[3])
end

-- 화면 구독은 조건 없이 지운다. 저장된 접속 번호는 그 화면을 연 시점의 것이라
-- 지금 접속 번호보다 앞서면 앞섰지 뒤설 수 없다. 다르다면 오래된 것이니 더더욱 지워야 한다.
local function removeViewportSubscriptions()
  local viewportLayer = redis.call('HGET', KEYS[4], 'layer')
  local cellKeys = redis.call('HGET', KEYS[4], 'cellKeys') or ''
  if viewportLayer then
    for cellKey in string.gmatch(cellKeys, '[^,]+') do
      redis.call('SREM', ARGV[10] .. viewportLayer .. ':' .. cellKey, email)
    end
    redis.call('SREM', ARGV[11] .. viewportLayer, email)
  end
  redis.call('DEL', KEYS[4])
end

-- 사용자 상태가 없으면 남은 정보만 지운다.
if redis.call('EXISTS', KEYS[1]) == 0 then
  redis.call('ZREM', KEYS[2], email)
  removeNearbySubscriptions()
  removeViewportSubscriptions()
  return {}
end

if sweepTime ~= '' then
  -- 아직 만료되지 않았으면 중단한다.
  local sc = redis.call('ZSCORE', KEYS[2], email)
  if (not sc) or (tonumber(sc) > tonumber(sweepTime)) then
    return {'SKIPPED'}
  end
else
  -- 다른 접속의 종료 요청이면 중단한다.
  local storedEpoch = redis.call('HGET', KEYS[1], 'epoch')
  if storedEpoch ~= epoch then
    return {'SKIPPED'}
  end
end

-- 현재 재생 위치와 접속 버전을 읽는다.
local musicId = redis.call('HGET', KEYS[1], 'musicId')
local layer   = redis.call('HGET', KEYS[1], 'layer')
local cellX   = redis.call('HGET', KEYS[1], 'cellX')
local cellY   = redis.call('HGET', KEYS[1], 'cellY')
local storedEpoch = redis.call('HGET', KEYS[1], 'epoch')

-- 따라가는 중이면 자리는 적혀 있어도 지도에는 없다. 빼면 인솔자 셀 인원수가 깎이고,
-- 아무에게도 보인 적 없는 사람의 퇴장 알림이 나간다.
local riding = redis.call('HGET', KEYS[1], 'riding')

-- 재생 중이었다면 곡과 위치를 지운다.
local removed = {}
if musicId and not riding then
  local cellF = cellX .. ':' .. cellY
  redis.call('SREM', ARGV[4] .. musicId, email)

  local llKey = ARGV[5] .. layer .. ':' .. musicId
  redis.call('SREM', llKey, email)
  if redis.call('SCARD', llKey) == 0 then
    local cellKey = ARGV[6] .. layer .. ':' .. cellF
    redis.call('SREM', cellKey, musicId)
    if redis.call('SCARD', cellKey) == 0 then
      redis.call('SREM', ARGV[7] .. layer, cellF)
    end
  end

  local c = redis.call('HINCRBY', ARGV[8] .. layer, cellF, -1)
  if c <= 0 then
    redis.call('HDEL', ARGV[8] .. layer, cellF)
  end
  removed = {musicId, layer, cellX, cellY, storedEpoch}
end

-- 실시간 구독과 사용자 상태를 지운다.
removeNearbySubscriptions()
removeViewportSubscriptions()
redis.call('DEL', KEYS[1])
redis.call('ZREM', KEYS[2], email)
return removed
