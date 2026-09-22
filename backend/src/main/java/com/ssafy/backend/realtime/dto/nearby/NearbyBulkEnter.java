package com.ssafy.backend.realtime.dto.nearby;

import java.util.List;

/**
 * S→C NEARBY_BULK_ENTER — 한 곡에 여러 사람이 한꺼번에 나타났다.
 *
 * 선단이 흩어질 때 쓴다. 한 명씩 알리면 사람 수만큼 알림이 나가고, 받는 쪽은
 * 그 수만큼 목록을 다시 그리면서 중간 상태가 그대로 보인다.
 *
 * 만난 횟수는 받는 사람마다 다르므로 이 덩어리도 받는 사람마다 따로 만든다.
 *
 * @param musicId 사람들이 나타난 곡
 * @param people 나타난 사람들. 한 명짜리 NEARBY_ENTER 와 같은 모양이다
 */
public record NearbyBulkEnter(long musicId, List<NearbyChange> people) {
}
