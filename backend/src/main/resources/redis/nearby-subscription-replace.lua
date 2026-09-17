-- 주변사람 패널을 열 때 구독 곡을 새 목록으로 바꾼다.

-- KEYS[1] 현재 접속 정보
-- KEYS[2] 현재 구독 정보
--
-- ARGV[1] 사용자 이메일
-- ARGV[2] 확인할 접속 버전
-- ARGV[3] 곡별 구독 키
-- ARGV[4] 새 구독 곡 목록
--
-- 반환: 1=성공, 0=현재 접속이 아님.

local email = ARGV[1]
local expectedEpoch = ARGV[2]
local subscribersPrefix = ARGV[3]
local newMusicIds = ARGV[4]

local currentEpoch = redis.call('HGET', KEYS[1], 'epoch')
if (not currentEpoch) or currentEpoch ~= expectedEpoch then
  return 0
end

local nextIds = {}
for musicId in string.gmatch(newMusicIds, '[^,]+') do
  nextIds[musicId] = true
  redis.call('SADD', subscribersPrefix .. musicId, email)
end

local previousMusicIds = redis.call('HGET', KEYS[2], 'musicIds') or ''
for musicId in string.gmatch(previousMusicIds, '[^,]+') do
  if not nextIds[musicId] then
    redis.call('SREM', subscribersPrefix .. musicId, email)
  end
end

redis.call('HSET', KEYS[2],
  'epoch', expectedEpoch,
  'musicIds', newMusicIds)

return 1
