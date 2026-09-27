-- 주변사람 패널을 닫는다. 저장된 접속 버전과 같을 때만 지운다 (S15P21A405-582).
--
-- 다른 접속(새 탭)이 연 패널은 건드리지 않는다. 지우면 살아 있는 탭이 변경을 못 받는다.
--
-- KEYS[1] 현재 구독 정보
--
-- ARGV[1] 사용자 이메일
-- ARGV[2] 닫을 접속 버전
-- ARGV[3] 층별 구독 키
--
-- 반환: 1=닫음, 0=다른 접속의 패널

local email = ARGV[1]
local expectedEpoch = ARGV[2]
local subscribersPrefix = ARGV[3]

local storedEpoch = redis.call('HGET', KEYS[1], 'epoch')
if (not storedEpoch) or storedEpoch ~= expectedEpoch then
  return 0
end

local layer = redis.call('HGET', KEYS[1], 'layer')
if layer then
  redis.call('SREM', subscribersPrefix .. layer, email)
end

redis.call('DEL', KEYS[1])
return 1
