-- 현재 화면에서 지켜볼 셀을 새 목록으로 바꾼다.

-- KEYS[1] 사용자의 현재 접속 정보
-- KEYS[2] 사용자가 마지막으로 보낸 화면 정보
--
-- ARGV[1] 사용자 이메일
-- ARGV[2] 확인할 접속 번호
-- ARGV[3] 화면 요청 순번
-- ARGV[4] 현재 레이어
-- ARGV[5..8] 현재 화면의 minX, maxX, minY, maxY
-- ARGV[9] 여기까지 내려오며 선택한 이전 화면들
-- ARGV[10] 새 화면 방식: INDIVIDUAL 또는 CLUSTERED
-- ARGV[11] 새로 지켜볼 셀 목록
-- ARGV[12] 셀별 사용자 목록을 찾을 때 붙이는 키
-- ARGV[13] 셀별 인원수 화면 사용자 목록을 찾을 때 붙이는 키
--
-- 반환: 1=변경함, 0=이미 더 새로운 화면이 있음, -1=현재 접속이 아님

local email = ARGV[1]
local expectedEpoch = ARGV[2]
local requestSeq = tonumber(ARGV[3])
local newLayer = ARGV[4]
local newMode = ARGV[10]
local newCellKeys = ARGV[11]
local cellPrefix = ARGV[12]
local clusteredPrefix = ARGV[13]

if newMode ~= 'INDIVIDUAL' and newMode ~= 'CLUSTERED' then
  return -1
end

local currentEpoch = redis.call('HGET', KEYS[1], 'epoch')
if (not currentEpoch) or currentEpoch ~= expectedEpoch then
  return -1
end

local storedEpoch = redis.call('HGET', KEYS[2], 'epoch')
local storedRequestSeq = tonumber(redis.call('HGET', KEYS[2], 'requestSeq'))
local storedMode = redis.call('HGET', KEYS[2], 'mode')
if storedEpoch == expectedEpoch and storedRequestSeq then
  if storedRequestSeq > requestSeq then
    return 0
  end
  -- 같은 요청에서 사용자 수가 20명을 넘으면 셀별 인원수 방식으로 바꿀 수 있다.
  if storedRequestSeq == requestSeq
      and not (storedMode == 'INDIVIDUAL' and newMode == 'CLUSTERED') then
    return 0
  end
end

local oldLayer = redis.call('HGET', KEYS[2], 'layer')
local oldCellKeys = redis.call('HGET', KEYS[2], 'cellKeys') or ''
if oldLayer then
  for cellKey in string.gmatch(oldCellKeys, '[^,]+') do
    redis.call('SREM', cellPrefix .. oldLayer .. ':' .. cellKey, email)
  end
  redis.call('SREM', clusteredPrefix .. oldLayer, email)
end

if newMode == 'INDIVIDUAL' then
  for cellKey in string.gmatch(newCellKeys, '[^,]+') do
    redis.call('SADD', cellPrefix .. newLayer .. ':' .. cellKey, email)
  end
else
  newCellKeys = ''
  redis.call('SADD', clusteredPrefix .. newLayer, email)
end

redis.call('DEL', KEYS[2])
redis.call('HSET', KEYS[2],
  'epoch', expectedEpoch,
  'requestSeq', ARGV[3],
  'mode', newMode,
  'layer', newLayer,
  'minX', ARGV[5],
  'maxX', ARGV[6],
  'minY', ARGV[7],
  'maxY', ARGV[8],
  'ancestorBounds', ARGV[9],
  'cellKeys', newCellKeys)

return 1
