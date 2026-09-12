package com.ssafy.backend.music.retrieval;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 좌표계 버전에 귀속된 후처리 임계값 (FR-024, T050).
 *
 * <p><b>값의 유일한 출처는 {@code data/serving/<bundle>/postprocess_rules.json} 이다</b>(핸드오프 §2).
 * 여기서는 그 값을 설정으로 받아 들고만 있는다 — Java 상수로 박지 않는다. 데이터 파트가 같은 값을
 * 규칙 파일에서 읽고 하드코딩을 금지하고 있어, 백엔드가 따로 박으면 <b>같은 규칙이 두 벌이 되어
 * 좌표계 교체 시 갈라진다</b>.
 *
 * <p><b>여정(004)과 주변 탐색(005)이 이 하나를 공유한다</b>(FR-024) — 따로 만들면 두 API 가
 * 같은 곡에 다른 규칙을 적용한다.
 *
 * <p>거리는 전부 <b>L2</b>다. 코사인·내적으로 바꾸면 아래 임계값이 전부 무의미해진다.
 * 거리 눈금: {@code 0.0} 같은 파일 · {@code <1.0} 같은 녹음의 다른 제출본 · {@code 1.66} τ_dup ·
 * {@code 2.3~4.2} 잘 나온 top-10 의 10위 · {@code 4.91} τ_far · {@code 10.7} 정답쌍 median ·
 * {@code ~15.7} 무작위 두 곡.
 *
 * @param bundle          좌표 아티팩트 버전. 임계값이 귀속되는 대상이라 함께 둔다 — 번들을 바꾸면 값도 같이 바꾼다
 * @param tauDup          이 거리 미만은 같은 녹음으로 보고 접는다. 기본 1.6624 (다른 곡 최근접 p1;
 *                        다른 곡 손실 1.00%, 같은 녹음 61.2% 접힘)
 * @param artistCap       결과 안 같은 아티스트 최대 곡 수. 기본 3 (top-10 최다 아티스트 p90)
 * @param tauFar          마지막 이웃 거리가 이보다 크면 "유사도 낮음". 기본 4.912 (무작위 쿼리 nn10 p90).
 *                        주변 탐색(005)이 쓴다
 * @param lengthMinS      결과에 넣을 최소 길이(초). 기본 30
 * @param lengthMaxS      결과에 넣을 최대 길이(초). 기본 1200
 * @param farEndpointDist 끝점 거리가 이보다 크면 먼 여정. 기본 10.7 (멜론 정답쌍 거리 median).
 *                        여정(004)이 역 수를 정할 때 쓴다(D3)
 */
@ConfigurationProperties("ody.serving")
public record ServingRules(
		String bundle,
		double tauDup,
		int artistCap,
		double tauFar,
		int lengthMinS,
		int lengthMaxS,
		double farEndpointDist) {

	public ServingRules {
		if (bundle == null || bundle.isBlank()) {
			throw new IllegalArgumentException("ody.serving.bundle 이 비어 있다 — 임계값이 어느 좌표계의 것인지 알 수 없다");
		}
		if (tauDup <= 0 || tauFar <= 0 || farEndpointDist <= 0) {
			throw new IllegalArgumentException("거리 임계값은 0 보다 커야 한다");
		}
		if (artistCap < 1) {
			throw new IllegalArgumentException("artistCap 은 1 이상이어야 한다: " + artistCap);
		}
		if (lengthMinS < 0 || lengthMaxS <= lengthMinS) {
			throw new IllegalArgumentException(
					"길이 범위가 뒤집혔다: %d ~ %d".formatted(lengthMinS, lengthMaxS));
		}
	}

	/** 길이 규칙을 통과하는가. {@code duration} 이 null 이면 판정하지 않고 통과시킨다. */
	public boolean lengthAllowed(Integer duration) {
		return duration == null || (duration >= lengthMinS && duration <= lengthMaxS);
	}
}
