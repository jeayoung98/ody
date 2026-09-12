-- presence-play.lua — 재생 선언(RT-02) 원자 갱신. "재생 = 위치 이동의 유일한 원본".
-- 좌표·셀(부동소수) 계산은 Java(CoordinateMapper)에서 미리 하고 정수·문자열만 넘긴다(Lua 안 부동소수 금지).
--
-- KEYS[1] listeners:{oldMusicId}                       -- 이전 곡 청취자 집합
-- KEYS[2] listeners:{newMusicId}                       -- 새 곡 청취자 집합
-- KEYS[3] active-song:cell:{L}:{oldCellX}:{oldCellY}   -- 이전 셀에 있는 active곡들
-- KEYS[4] active-song:cell:{L}:{newCellX}:{newCellY}   -- 새 셀에 있는 active곡들
-- KEYS[5] cell:usercount:{L}  (Hash "cx:cy"->count)    -- 레이어별 셀 인원수 (줌아웃 많이 되어있을때 이거 합산해서 보여줌)
-- KEYS[6] presence:user:{email}  (Hash)                -- 내 접속 상태(위치)
--
-- ARGV[1]  email         내 식별자
-- ARGV[2]  oldMusicId    이전 곡 ("" = 재생 중 아니었음, 처음 진입시 대비)
-- ARGV[3]  newMusicId    새로 재생하는 곡
-- ARGV[4]  layer         현재 레이어
-- ARGV[5]  x             정규화 x (0~1)
-- ARGV[6]  y             정규화 y (0~1)
-- ARGV[7]  cellX         새 셀 X
-- ARGV[8]  cellY         새 셀 Y
-- ARGV[9]  oldCellField  "ox:oy"  이전 셀의 인원수 필드명
-- ARGV[10] newCellField  "nx:ny"  새 셀의 인원수 필드명
--
-- 반환: {'OK', email, ...} = 성공(만남 목록). 같은 곡 재선언/첫 청취자면 {'OK'} .
--       presence 없음/old 불일치(Sweep 경쟁)면 {'STALE'} → Java 가 PRESENCE_STALE 로 매핑.
--       (정수/문자열 혼합 회피 위해 모든 원소를 문자열로 통일)

local email = ARGV[1]
local oldM  = ARGV[2]
local newM  = ARGV[3]

-- 0) presence 존재 확인 (이탈/만료 후면 재생 처리 금지)
if redis.call('EXISTS', KEYS[6]) == 0 then
  return {'STALE'}
end

-- 1) 가드: 저장된 현재 곡이 내가 아는 old 와 같은가 (다르면 상태가 낡음)
local cur = redis.call('HGET', KEYS[6], 'musicId')
local curStr = cur or ''            -- 필드 없으면(비노출) false -> ''
if curStr ~= oldM then
  return {'STALE'}
end

-- 2~3) 곡이 실제로 바뀔 때만 청취자/셀/인원수 갱신
local met = {}
if newM ~= oldM then
  -- 2) 만남 목록: 내가 SADD 되기 "직전" new곡 청취자 (나 제외 상태)
  met = redis.call('SMEMBERS', KEYS[2])

  -- 3a) old 곡에서 나 제거 (비노출이 아니었을 때만)
  if oldM ~= '' then
    redis.call('SREM', KEYS[1], email)
    if redis.call('SCARD', KEYS[1]) == 0 then
      redis.call('SREM', KEYS[3], oldM)          -- 청취자 0 → 이 셀에서 곡 제거
    end
    local oc = redis.call('HINCRBY', KEYS[5], ARGV[9], -1)
    if oc <= 0 then
      redis.call('HDEL', KEYS[5], ARGV[9])        -- 0 이하면 필드 삭제
    end
  end

  -- 3b) new 곡에 나 추가
  redis.call('SADD', KEYS[2], email)
  redis.call('SADD', KEYS[4], newM)               -- 셀에 곡 등장(idempotent)
  redis.call('HINCRBY', KEYS[5], ARGV[10], 1)
end

-- 4) presence 갱신 (epoch 은 건드리지 않는다)
redis.call('HSET', KEYS[6],
  'musicId', newM,
  'layer',   ARGV[4],
  'x',       ARGV[5],
  'y',       ARGV[6],
  'cellX',   ARGV[7],
  'cellY',   ARGV[8])

-- 5) 만남 목록 반환 (같은 곡 재선언이면 빈 목록) , 마주친 CNT ++ 하기용 목록
local out = {'OK'}
for i = 1, #met do out[#out + 1] = met[i] end
return out
