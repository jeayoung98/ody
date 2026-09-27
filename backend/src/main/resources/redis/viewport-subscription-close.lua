-- 마지막으로 연 화면의 구독 정보를 지운다.

-- KEYS[1] 사용자의 현재 접속 정보
-- KEYS[2] 사용자가 마지막으로 보낸 화면 정보
--
-- ARGV[1] 사용자 이메일
-- ARGV[2] 확인할 접속 번호
-- ARGV[3] 확인할 화면 요청 순번
-- ARGV[4] 셀별 사용자 목록을 찾을 때 붙이는 키
-- ARGV[5] 셀별 인원수 화면 사용자 목록을 찾을 때 붙이는 키
--
-- 반환: 1=닫음, 0=현재 화면과 다른 요청, -1=현재 접속이 아님

local email = ARGV[1]
local expectedEpoch = ARGV[2]
local expectedRequestSeq = ARGV[3]
local cellPrefix = ARGV[4]
local clusteredPrefix = ARGV[5]

local currentEpoch = redis.call('HGET', KEYS[1], 'epoch')
if (not currentEpoch) or currentEpoch ~= expectedEpoch then
  return -1
end

local storedEpoch = redis.call('HGET', KEYS[2], 'epoch')
local storedRequestSeq = redis.call('HGET', KEYS[2], 'requestSeq')
if storedEpoch ~= expectedEpoch or storedRequestSeq ~= expectedRequestSeq then
  return 0
end

local layer = redis.call('HGET', KEYS[2], 'layer')
local cellKeys = redis.call('HGET', KEYS[2], 'cellKeys') or ''
if layer then
  for cellKey in string.gmatch(cellKeys, '[^,]+') do
    redis.call('SREM', cellPrefix .. layer .. ':' .. cellKey, email)
  end
  redis.call('SREM', clusteredPrefix .. layer, email)
end

redis.call('DEL', KEYS[2])
return 1
