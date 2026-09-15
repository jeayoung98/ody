package com.ssafy.backend.music.retrieval;

import java.util.List;

/**
 * 상주 집합 조회 조건 (D19). 요청 하나로 완결되며 서버는 탐색 상태를 보관하지 않는다.
 *
 * <p>{@code level=1} 은 사용자 입력과 무관하게 결과가 같아 누적 범위가 비어 있다 — 어댑터가
 * 미리 계산한 정적 결과를 읽는다. {@code level>=2} 는 이전 겹들에서 좁힌 범위를 전부 받는다.
 * 클라이언트가 누적 범위를 캐싱하고 레이어를 올라가면 폐기한다.
 *
 * <p>이 누적이 spec FR-008 의 {@code candidate(N+1) ⊆ candidate(N)} 을 전달 계약으로 성립시킨다.
 * 그래서 개수를 강제한다 — 범위가 모자라면 후보가 조용히 넓어진다.
 *
 * @param accumulated 레이어 1..level-1 의 범위. level=1 이면 비어 있다
 * @param limit       상주 집합 크기. 1000 이 규모 기준이나 값은 주입받는다(D18, 하드코딩 금지)
 */
public record MajorQuery(int level, List<LayerBox> accumulated, int limit) {

	public MajorQuery {
		if (accumulated == null) {
			throw new IllegalArgumentException("accumulated 는 null 일 수 없다 (level=1 이면 빈 목록)");
		}
		if (accumulated.size() != level - 1) {
			throw new IllegalArgumentException(
					"누적 범위는 level-1 개여야 한다 (D19): level=%d, 받은 개수=%d".formatted(level, accumulated.size()));
		}
		if (limit < 1) {
			throw new IllegalArgumentException("limit 는 1 이상이어야 한다: " + limit);
		}
		accumulated = List.copyOf(accumulated);
	}

	/** 최상위 진입 — 파라미터 없는 정적 조회 분기 (FR-004, D19). */
	public boolean isTopLevel() {
		return level == 1;
	}

	/** 상주 집합을 그릴 평면의 x 축 번호 (1-based). level n → pc(2n-1) (FR-003) */
	public int axisX() {
		return 2 * level - 1;
	}

	/** 상주 집합을 그릴 평면의 y 축 번호 (1-based). level n → pc(2n) (FR-003) */
	public int axisY() {
		return 2 * level;
	}
}
