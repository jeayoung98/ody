-- presence-join.lua — 배치·이사(RT-01) 원자 처리. "join = 그 레이어·그 곡에 활성 배치".
-- play 와 "활성 배치 코어"를 공유하되 만남 목록·play_history 는 없다(join 은 노출만, 이동 아님).
-- 좌표·셀(부동소수)은 Java(MusicPositionCalculator)에서 계산해 정수·문자열만 넘긴다(Lua 안 부동소수 금지).
--
-- KEYS[1] presence:user:{email}   -- 내 접속 상태(위치)
--
-- ARGV[1]  email          내 식별자
-- ARGV[2]  oldMusicId     이전 곡 ("" = 정지였음/첫 배치)
-- ARGV[3]  oldLayer       이전 레이어 ("" = 없음)
-- ARGV[4]  oldCellField   "ox:oy" 이전 셀 ("" = 없음)
-- ARGV[5]  newMusicId     배치할 곡
-- ARGV[6]  newLayer       배치할 레이어
-- ARGV[7]  newCellField   "nx:ny" 새 셀
-- ARGV[8]  x              정규화 x (0~1)
-- ARGV[9]  y              정규화 y (0~1)
-- ARGV[10] newCellX       새 셀 X
-- ARGV[11] newCellY       새 셀 Y
-- ARGV[12] listenersPrefix        "listeners:"          (+ musicId)      전역 청취자(Nearby)
-- ARGV[13] layerListenersPrefix   "layer-listeners:"    (+ "L:m")        레이어별 청취자(뷰포트·만남)
-- ARGV[14] activeCellPrefix       "active-song:cell:"   (+ "L:x:y")      셀-곡 집합
-- ARGV[15] activeCellsPrefix      "active-song:cells:"  (+ "L")          점유 셀 목록
-- ARGV[16] usercountPrefix        "cell:usercount:"     (+ "L")          셀 인원수 해시
--
-- 반환: {'OK'} 성공, {'STALE'} 현재 상태가 없거나 이전 값이 다른 경우.

local email = ARGV[1]
local oldM, oldL, oldCellF = ARGV[2], ARGV[3], ARGV[4]
local newM, newL, newCellF = ARGV[5], ARGV[6], ARGV[7]

-- 0) presence 존재 (정지 상태로 connect 되어 있어야 함)
if redis.call('EXISTS', KEYS[1]) == 0 then
  return {'STALE'}
end

-- 1) 가드: 저장된 현재 곡이 넘어온 old 와 같은가 (다르면 그 사이 play 가 끼어든 것)
local cur = redis.call('HGET', KEYS[1], 'musicId')
local curStr = cur or ''
if curStr ~= oldM then
  return {'STALE'}
end

local P_lis  = ARGV[12]
local P_ll   = ARGV[13]
local P_cell = ARGV[14]
local P_cells= ARGV[15]
local P_uc   = ARGV[16]

-- 같은 레이어·같은 곡이면 활성 구조는 그대로(좌표만 아래서 갱신)
local samePlace = (oldM == newM) and (oldL == newL)

if not samePlace then
  -- 2) old 제거 (정지가 아니었을 때만)
  if oldM ~= '' then
    -- 곡이 바뀌면 전역 청취자에서 제거. 레이어만 바뀌면 전역은 유지(같은 곡 계속 재생 중).
    if oldM ~= newM then
      redis.call('SREM', P_lis .. oldM, email)
    end
    local oldLL = P_ll .. oldL .. ':' .. oldM
    redis.call('SREM', oldLL, email)
    if redis.call('SCARD', oldLL) == 0 then
      local oldCellKey = P_cell .. oldL .. ':' .. oldCellF
      redis.call('SREM', oldCellKey, oldM)                 -- 그 레이어 마지막 청취자 → 셀에서 곡 제거
      if redis.call('SCARD', oldCellKey) == 0 then
        redis.call('SREM', P_cells .. oldL, oldCellF)      -- 셀 비면 점유목록에서 제거
      end
    end
    local oc = redis.call('HINCRBY', P_uc .. oldL, oldCellF, -1)
    if oc <= 0 then
      redis.call('HDEL', P_uc .. oldL, oldCellF)
    end
  end

  -- 3) new 추가
  redis.call('SADD', P_lis .. newM, email)                 -- 전역(Nearby); 이미 있으면 무해
  redis.call('SADD', P_ll .. newL .. ':' .. newM, email)   -- 레이어별
  redis.call('SADD', P_cell .. newL .. ':' .. newCellF, newM)
  redis.call('SADD', P_cells .. newL, newCellF)
  redis.call('HINCRBY', P_uc .. newL, newCellF, 1)
end

-- 4) presence 갱신 (epoch 불변)
redis.call('HSET', KEYS[1],
  'musicId', newM,
  'layer',   newL,
  'x',       ARGV[8],
  'y',       ARGV[9],
  'cellX',   ARGV[10],
  'cellY',   ARGV[11])

return {'OK'}
