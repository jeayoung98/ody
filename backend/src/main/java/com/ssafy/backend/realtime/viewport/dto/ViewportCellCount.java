package com.ssafy.backend.realtime.viewport.dto;

/**
 * 한 셀에 있는 사용자 수.
 *
 * @param cellX 가로 셀 번호
 * @param cellY 세로 셀 번호
 * @param count 사용자 수
 */
public record ViewportCellCount(int cellX, int cellY, int count) {
}
