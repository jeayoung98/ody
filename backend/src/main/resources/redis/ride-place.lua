-- ride-place.lua — 따라가는 사람을 인솔자 자리로 옮기되 지도에는 넣지 않는다 (RT-30).
--
-- 지도 인덱스에 넣으면 그룹이 한 점이 아니라 N개 점이 된다. 인솔자가 곡을 바꿀 때마다
-- 위치 변경이 인원수만큼 터지고 화면 갱신도 그만큼 퍼진다. 그래서 넣지 않는다.
-- 남들 화면에는 인솔자 한 점과 따라오는 인원수만 보인다.
--
-- presence 자체는 남긴다 — 하트비트·만료·접속 번호가 이 키를 쓰고,
-- 내릴 때 어느 자리에 남길지도 여기 있어야 안다.
--
-- KEYS[1] presence:user:{따라가는 사람}
--
-- ARGV[1] 이메일           [2] 확인할 접속 번호
--   [3] 이전 곡("" 정지)   [4] 이전 레이어("")   [5] 이전 셀("x:y", "")
--   [6] 새 곡              [7] 새 레이어         [8] x   [9] y   [10] 셀X   [11] 셀Y
--   [12] 곡별 청취자 키     [13] 레이어별 청취자 키
--   [14] 셀별 재생 곡 키    [15] 사용 중인 셀 키   [16] 셀별 사용자 수 키
--
-- 반환: {'OK'} 또는 {'STALE'}.

local email = ARGV[1]
local expectedEpoch = ARGV[2]
local oldM, oldL, oldCellF = ARGV[3], ARGV[4], ARGV[5]

if redis.call('EXISTS', KEYS[1]) == 0 then
  return {'STALE'}
end

local currentEpoch = redis.call('HGET', KEYS[1], 'epoch')
if (not currentEpoch) or currentEpoch ~= expectedEpoch then
  return {'STALE'}
end

-- 넘어온 이전 곡이 실제와 다르면 그 사이에 자리가 바뀐 것이다.
local cur = redis.call('HGET', KEYS[1], 'musicId') or ''
if cur ~= oldM then
  return {'STALE'}
end

-- 서 있던 자리가 있으면 지도에서 뺀다. 남들 화면에서 사라진다.
if oldM ~= '' then
  local P_lis, P_ll = ARGV[12], ARGV[13]
  local P_cell, P_cells, P_uc = ARGV[14], ARGV[15], ARGV[16]

  redis.call('SREM', P_lis .. oldM, email)

  local llKey = P_ll .. oldL .. ':' .. oldM
  redis.call('SREM', llKey, email)
  if redis.call('SCARD', llKey) == 0 then
    local cellKey = P_cell .. oldL .. ':' .. oldCellF
    redis.call('SREM', cellKey, oldM)
    if redis.call('SCARD', cellKey) == 0 then
      redis.call('SREM', P_cells .. oldL, oldCellF)
    end
  end

  local c = redis.call('HINCRBY', P_uc .. oldL, oldCellF, -1)
  if c <= 0 then
    redis.call('HDEL', P_uc .. oldL, oldCellF)
  end
end

-- 새 자리는 값만 적어 둔다. 어떤 인덱스에도 넣지 않는다.
redis.call('HSET', KEYS[1],
  'musicId', ARGV[6],
  'layer',   ARGV[7],
  'x',       ARGV[8],
  'y',       ARGV[9],
  'cellX',   ARGV[10],
  'cellY',   ARGV[11])

return {'OK'}
