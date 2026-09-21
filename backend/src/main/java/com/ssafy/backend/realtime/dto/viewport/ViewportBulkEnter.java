package com.ssafy.backend.realtime.dto.viewport;

import java.util.List;

/**
 * S→C VIEWPORT_BULK_ENTER — 여러 사람이 한 자리에 한꺼번에 나타났다.
 *
 * 선단이 흩어질 때 쓴다. 스무 명이 한 점에서 풀려 나오는데 한 명씩 알리면 스무 건이 된다.
 * 받는 쪽은 스무 번 다시 그리게 되고, 중간 상태가 화면에 그대로 보인다.
 *
 * 전원이 인솔자의 마지막 곡에 남으므로 자리는 하나뿐이다.
 *
 * @param requestSeq 받는 사람의 화면 요청 번호
 * @param musicId 사람들이 나타난 곡
 * @param x 지도 가로 좌표
 * @param y 지도 세로 좌표
 * @param users 나타난 사람들
 */
public record ViewportBulkEnter(
		long requestSeq,
		long musicId,
		double x,
		double y,
		List<ViewportUser> users) {
}
