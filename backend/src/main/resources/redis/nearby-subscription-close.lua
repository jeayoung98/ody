--저장된 접속 버전 확인해서 다른 접속 버전이면 아무것도 삭제하지 않음
-- 현재 접속이(현재 세션아이디일때) 요청한 주변사람 패널만 닫는다.

-- KEYS[1] 현재 구독 정보
--
-- ARGV[1] 사용자 이메일
-- ARGV[2] 닫을 접속 버전
-- ARGV[3] 곡별 주변사람 구독 키
--
-- 반환: 1=닫음, 0=다른 접속의 패널

local email = ARGV[1]
local expectedEpoch = ARGV[2]
local subscribersPrefix = ARGV[3]

local storedEpoch = redis.call('HGET', KEYS[1], 'epoch')
if (not storedEpoch) or storedEpoch ~= expectedEpoch then
  return 0
end

local musicIds = redis.call('HGET', KEYS[1], 'musicIds') or ''
for musicId in string.gmatch(musicIds, '[^,]+') do
  redis.call('SREM', subscribersPrefix .. musicId, email)
end

redis.call('DEL', KEYS[1])
return 1
