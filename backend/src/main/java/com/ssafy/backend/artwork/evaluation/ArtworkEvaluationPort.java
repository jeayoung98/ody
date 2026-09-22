package com.ssafy.backend.artwork.evaluation;

import java.util.List;
import java.util.Optional;

/**
 * 작품 이미지를 채점하는 외부 모델 (S15P21A405-563).
 *
 * <p>이 인터페이스가 <b>외부 계약이 새지 않게 막는 경계</b>다. GMS 의 요청 형식·인증 방식·모델이
 * 바뀌어도 구현체 한 클래스만 바뀐다.
 *
 * <h2>계약</h2>
 * <ul>
 *   <li>실패는 <b>예외가 아니라 {@code Optional.empty()}</b> 다. 호출 실패·형식 위반·점수 범위
 *       위반을 호출자가 똑같이 "채점 실패" 로 다루게 하려는 것이다(spec FR-006).</li>
 *   <li>돌려주는 점수는 이미 0~100 검증을 통과한 값이다. 모델이 뱉은 값을 그대로 흘리지 않는다.</li>
 *   <li>부수효과 없음. 재시도하지 않는다 — 재시도는 스케줄러가 한다.</li>
 * </ul>
 */
public interface ArtworkEvaluationPort {

	/**
	 * @param pngBytes    서버가 렌더한 작품 이미지
	 * @param themePrompt 회차의 채점 기준 문장({@code artwork_round.theme_prompt})
	 * @param anchors     점수가 붙은 기준 그림. 비어 있으면 기준 없이 채점한다(진단에서 변별력이 크게 떨어졌다)
	 * @return 채점 결과. 실패면 비어 있다
	 */
	Optional<ArtworkEvaluation> evaluate(byte[] pngBytes, String themePrompt, List<ArtworkAnchor> anchors);
}
