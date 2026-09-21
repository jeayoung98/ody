-- presence-play.lua — 재생 선언(RT-02) = 이동. "재생 = 위치 이동의 유일한 원본".
-- 활성 배치 코어는 presence-join.lua 와 동일. 차이: 새 (레이어,곡) 청취자를 '만남 후보'로 반환한다.
-- 좌표·셀(부동소수)은 Java(MusicPositionCalculator)에서 계산해 정수·문자열만 넘긴다(Lua 안 부동소수 금지).
--
-- KEYS[1] presence:user:{email}
--
-- ARGV (presence-join.lua 와 동일):
--   [1] email  [2] oldMusicId("" 정지/첫재생)  [3] oldLayer("")  [4] oldCellField("ox:oy","")
--   [5] newMusicId  [6] newLayer  [7] newCellField("nx:ny")
--   [8] x  [9] y  [10] newCellX  [11] newCellY
--   [12] listenersPrefix "listeners:"           [13] layerListenersPrefix "layer-listeners:"
--   [14] activeCellPrefix "active-song:cell:"    [15] activeCellsPrefix "active-song:cells:"
--   [16] usercountPrefix "cell:usercount:"
--
-- 반환: {'OK', 만남email...} 성공(같은 자리 재선언이면 빈 만남). {'STALE'} presence 없음/old 불일치.

local email = ARGV[1]
local oldM, oldL, oldCellF = ARGV[2], ARGV[3], ARGV[4]
local newM, newL, newCellF = ARGV[5], ARGV[6], ARGV[7]

-- 0) presence 존재
if redis.call('EXISTS', KEYS[1]) == 0 then
  return {'STALE'}
end

-- 1) 가드: 따라가는 중이면 지도에 없다. 여기서 옮기면 지도에 다시 나타나고
--    인솔자 셀 인원수도 깎인다. 컨트롤러가 이미 막지만 경합으로 새어 들어올 수 있다.
if redis.call('HGET', KEYS[1], 'riding') then
  return {'STALE'}
end

-- 2) 가드: 저장된 현재 곡이 넘어온 old 와 같은가
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

local samePlace = (oldM == newM) and (oldL == newL)
local met = {}

if not samePlace then
  -- 2) 만남 후보: 내가 SADD 되기 "직전" 새 (레이어,곡) 청취자 = 같은 레이어 같은 곡. 나 제외.
  local before = redis.call('SMEMBERS', P_ll .. newL .. ':' .. newM)
  for i = 1, #before do
    if before[i] ~= email then
      met[#met + 1] = before[i]
    end
  end

  -- 3) old 제거 (정지가 아니었을 때만) — old 는 반드시 oldLayer 기준
  if oldM ~= '' then
    if oldM ~= newM then
      redis.call('SREM', P_lis .. oldM, email)          -- 곡 바뀜 → 전역에서 제거
    end
    local oldLL = P_ll .. oldL .. ':' .. oldM
    redis.call('SREM', oldLL, email)
    if redis.call('SCARD', oldLL) == 0 then
      local oldCellKey = P_cell .. oldL .. ':' .. oldCellF
      redis.call('SREM', oldCellKey, oldM)
      if redis.call('SCARD', oldCellKey) == 0 then
        redis.call('SREM', P_cells .. oldL, oldCellF)
      end
    end
    local oc = redis.call('HINCRBY', P_uc .. oldL, oldCellF, -1)
    if oc <= 0 then
      redis.call('HDEL', P_uc .. oldL, oldCellF)
    end
  end

  -- 4) new 추가
  redis.call('SADD', P_lis .. newM, email)              -- 전역(Nearby)
  redis.call('SADD', P_ll .. newL .. ':' .. newM, email) -- 레이어별
  redis.call('SADD', P_cell .. newL .. ':' .. newCellF, newM)
  redis.call('SADD', P_cells .. newL, newCellF)
  redis.call('HINCRBY', P_uc .. newL, newCellF, 1)
end

-- 5) presence 갱신 (epoch 불변)
redis.call('HSET', KEYS[1],
  'musicId', newM,
  'layer',   newL,
  'x',       ARGV[8],
  'y',       ARGV[9],
  'cellX',   ARGV[10],
  'cellY',   ARGV[11])

-- 6) 만남 목록 반환 (cnt++ 는 -272 에서 3분 쿨다운으로)
local out = {'OK'}
for i = 1, #met do out[#out + 1] = met[i] end
return out
