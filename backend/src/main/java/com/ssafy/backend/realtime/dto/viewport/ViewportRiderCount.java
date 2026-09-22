package com.ssafy.backend.realtime.dto.viewport;

/**
 * S→C VIEWPORT_RIDER_COUNT — 화면에 보이는 누군가의 따라오는 인원수가 바뀌었다.
 *
 * 선단은 남들 화면에 인솔자 한 점으로만 보인다. 그 점에 몇 명이 붙어 있는지가
 * 선단임을 알 수 있는 유일한 표시인데, 지금까지는 인솔자가 곡을 바꿔야만 갱신됐다.
 * 스무 명이 타고 내려도 구경하는 쪽에는 계속 같은 수로 보였다.
 *
 * 자리는 그대로라 위치는 싣지 않는다.
 *
 * @param requestSeq 받는 사람의 화면 요청 번호
 * @param email 인원수가 바뀐 사람
 * @param riderCount 바뀐 뒤의 인원수
 */
public record ViewportRiderCount(long requestSeq, String email, int riderCount) {
}
