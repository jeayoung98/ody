-- 주변사람 패널을 열 때 구독할 층을 바꾼다 (S15P21A405-582).
--
-- 예전에는 비슷한 곡 열한 개를 곡마다 등록했다. 기준이 층 전체가 되면서 등록도 하나가 된다.
-- 같은 층에서 곡만 바꾸는 사람은 구독을 건드릴 일이 아예 없어졌다.
--
-- KEYS[1] 현재 접속 정보
-- KEYS[2] 현재 구독 정보
--
-- ARGV[1] 사용자 이메일
-- ARGV[2] 확인할 접속 버전
-- ARGV[3] 층별 구독 키
-- ARGV[4] 새로 구독할 층
--
-- 반환: 1=성공, 0=현재 접속이 아님.

local email = ARGV[1]
local expectedEpoch = ARGV[2]
local subscribersPrefix = ARGV[3]
local newLayer = ARGV[4]

local currentEpoch = redis.call('HGET', KEYS[1], 'epoch')
if (not currentEpoch) or currentEpoch ~= expectedEpoch then
  return 0
end

-- 옛 층에서 뺀다. 같은 층이면 뺄 것도 없다.
local previousLayer = redis.call('HGET', KEYS[2], 'layer')
if previousLayer and previousLayer ~= newLayer then
  redis.call('SREM', subscribersPrefix .. previousLayer, email)
end

redis.call('SADD', subscribersPrefix .. newLayer, email)
redis.call('HSET', KEYS[2], 'epoch', expectedEpoch, 'layer', newLayer)

return 1
