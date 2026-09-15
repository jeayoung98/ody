-- presence-leave.lua — 이탈/만료 정리(RT-05) 원자 처리. 곡·셀은 스크립트 안에서 읽어 정리(play/join 과 경쟁 없음).
--
-- 두 경로:
--   explicit/disconnect: epoch 가드(그 세션 epoch 와 저장 epoch 일치할 때만). sweepTime="".
--   sweep(만료 백스톱):  sweepTime(만료 감지 시각) 기준으로 현재 expiry score 재확인 →
--                        여전히 만료(score <= sweepTime)일 때만 삭제. 재접속하면 connect 가 score 를
--                        미래로 옮기므로 no-op → 새 세션 보존(P2-c). epoch 미사용(score 가 진짜 방어선).
--
-- KEYS[1] presence:user:{email}
-- KEYS[2] presence:expiry
--
-- ARGV[1] email
-- ARGV[2] epoch                 explicit 가드용 ("" = 미사용, sweep 경로)
-- ARGV[3] sweepTime             sweep 만료 재확인용(ms) ("" = 미사용, explicit 경로)
-- ARGV[4] listenersPrefix       "listeners:"          (+ musicId)     전역 청취자
-- ARGV[5] layerListenersPrefix  "layer-listeners:"    (+ "L:m")       레이어별 청취자
-- ARGV[6] activeCellPrefix      "active-song:cell:"   (+ "L:x:y")     셀-곡 집합
-- ARGV[7] activeCellsPrefix     "active-song:cells:"  (+ "L")         점유 셀 목록
-- ARGV[8] usercountPrefix       "cell:usercount:"     (+ "L")         셀 인원수 해시
--
-- 반환: 제거된 {musicId, layer, cellX, cellY} (LEAVE 델타용). no-op/비노출이면 {} .

local email     = ARGV[1]
local epoch     = ARGV[2]
local sweepTime = ARGV[3]

-- 0) 존재 확인 (presence 없는데 만료큐에만 남은 고아 항목은 정리하고 종료)
if redis.call('EXISTS', KEYS[1]) == 0 then
  redis.call('ZREM', KEYS[2], email)
  return {}
end

-- 1) 게이트
if sweepTime ~= '' then
  -- sweep: 여전히 만료 상태일 때만. 재접속(connect 가 score 미래로 ZADD)이면 no-op.
  local sc = redis.call('ZSCORE', KEYS[2], email)
  if (not sc) or (tonumber(sc) > tonumber(sweepTime)) then
    return {}
  end
else
  -- explicit/disconnect: epoch 가드 (새 세션이 덮어썼으면 no-op)
  local storedEpoch = redis.call('HGET', KEYS[1], 'epoch')
  if storedEpoch ~= epoch then
    return {}
  end
end

-- 2) 곡·레이어·셀 읽기
local musicId = redis.call('HGET', KEYS[1], 'musicId')
local layer   = redis.call('HGET', KEYS[1], 'layer')
local cellX   = redis.call('HGET', KEYS[1], 'cellX')
local cellY   = redis.call('HGET', KEYS[1], 'cellY')

-- 3) 활성 상태였으면(곡 있음) 전역·레이어·셀·인원수 정리 — 셀 제거는 '그 레이어' 청취자 기준(유령곡 방지)
local removed = {}
if musicId then
  local cellF = cellX .. ':' .. cellY
  redis.call('SREM', ARGV[4] .. musicId, email)                 -- 전역(Nearby)

  local llKey = ARGV[5] .. layer .. ':' .. musicId
  redis.call('SREM', llKey, email)                              -- 레이어별
  if redis.call('SCARD', llKey) == 0 then
    local cellKey = ARGV[6] .. layer .. ':' .. cellF
    redis.call('SREM', cellKey, musicId)                        -- 그 레이어 마지막 → 셀에서 곡 제거
    if redis.call('SCARD', cellKey) == 0 then
      redis.call('SREM', ARGV[7] .. layer, cellF)               -- 셀 비면 점유목록에서 제거
    end
  end

  local c = redis.call('HINCRBY', ARGV[8] .. layer, cellF, -1)
  if c <= 0 then
    redis.call('HDEL', ARGV[8] .. layer, cellF)
  end
  removed = {musicId, layer, cellX, cellY}
end

-- 4) presence 삭제 + 만료 큐에서 제거
redis.call('DEL', KEYS[1])
redis.call('ZREM', KEYS[2], email)
return removed
