package com.ssafy.backend.realtime.dto.viewport;

/**
 * 한 셀에 있는 사용자 수.
 *
 * @param cellX 가로 셀 번호
 * @param cellY 세로 셀 번호
 * @param x 지도에 표시할 원시 x 좌표
 * @param y 지도에 표시할 원시 y 좌표
 * @param count 사용자 수
 */
public record ViewportCellCount(int cellX, int cellY, double x, double y, int count) {
}
