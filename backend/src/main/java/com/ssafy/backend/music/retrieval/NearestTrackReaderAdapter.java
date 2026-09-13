package com.ssafy.backend.music.retrieval;

import java.util.List;
import java.util.StringJoiner;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.backend.music.dto.TrackCandidateRow;
import com.ssafy.backend.music.mapper.NearestTrackMapper;

/**
 * {@link NearestTrackReader} 의 MyBatis 어댑터 (T054, 헌법 X: BE2 계약 / 실행 분리).
 *
 * <p>좌표는 저장된 값을 그대로 옮긴다 — 재계산·재투영 없음(FR-016).
 *
 * <h2>{@code ef_search} 를 왜 매 질의마다 올리는가</h2>
 *
 * <p>2026-09-12 운영 실측: 기본값 40 이라 {@code LIMIT 200} 을 요청해도 <b>40행만 왔다.</b>
 * HNSW 가 {@code ef_search} 개를 훑고 멈추기 때문이다. 층당 후보가 1/5 로 잘리면 DP 품질이 떨어지고
 * {@code MIN_LAYER} 재질의가 헛돈다 — limit 을 키워도 같은 40행이라 재질의로는 풀리지 않는다.
 *
 * <p>비용은 웜 1.2ms → 4.0ms. 층 20개면 80ms 로 종단 예산 안이다.
 * <b>콜드는 350ms</b> 였다(첫 요청·캐시 축출). 이 값이 B-Latency 의 실재 위험이다.
 *
 * <p><b>설정은 세션 범위로 건다</b>({@code set_config(..., false)}). 트랜잭션 범위({@code SET LOCAL})로
 * 걸면 <b>다음 질의까지 살아남지 않는다</b> — 2026-09-13 실측(S15P21A405-279): {@code set_config} 는 200 을
 * 반환하는데 바로 다음 질의에서 읽으면 40(기본값)이었다. {@link Transactional} 이 붙어 있고
 * {@code TransactionSynchronizationManager} 도 활성이며 DataSource 까지 묶여 있는데도 그랬다 —
 * JDBC 커넥션에 실제 트랜잭션이 열리지 않아 문장마다 되돌려진 것이다.
 *
 * <p>세션 범위라 풀에서 빌린 커넥션에 값이 남지만, <b>이 조회는 매번 직전에 다시 걸므로</b> 어느 커넥션을
 * 받아도 결과가 같다. 이 앱의 벡터 질의는 전부 같은 탐색폭을 원한다.
 *
 * <p><b>고치기 전에는 200 을 요청해도 매번 40개만 왔다.</b> 오류가 나지 않는 경로라
 * {@code ody.nearby.candidate_size} 지표를 넣고서야 드러났다. 지표를 지우지 말 것.
 */
@Repository
public class NearestTrackReaderAdapter implements NearestTrackReader {

	/**
	 * 이 앱이 한 질의에서 요구하는 최대 행 수에 맞춘다 — 주변 탐색의
	 * {@code NearbyService.CANDIDATE_COUNT}(200) 가 그 최대다. 여정의 층 후보는 60 이라 더 작다.
	 *
	 * <p>더 올리면 정확도가 조금 오르지만 지연도 같이 오른다 — 재질의가 limit 을 키울 때를 대비해
	 * 여유를 두지 않는다. 재질의는 {@code ef_search} 로 풀리는 문제가 아니라서다.
	 *
	 * <p><b>이 값이 곧 인덱스를 훑는 비용이다.</b> limit 을 내려도 훑는 일은 그대로라 절감폭이
	 * 제한된다(S15P21A405-281 실측: 층 limit 200→60 에 질의당 101.3→88.0ms).
	 */
	private static final int EF_SEARCH = 200;

	private final NearestTrackMapper mapper;

	public NearestTrackReaderAdapter(NearestTrackMapper mapper) {
		this.mapper = mapper;
	}

	@Override
	@Transactional(readOnly = true)
	public List<TrackCandidate> findNearest(float[] point, int limit) {
		mapper.raiseEfSearch(Math.max(EF_SEARCH, limit));
		return mapper.findNearest(toVectorLiteral(point), limit).stream()
				.map(row -> new TrackCandidate(row.getMusicId(), row.getMbid(), row.getTitle(),
						row.getArtist(), row.getDuration(), row.toVec(), row.getDist()))
				.toList();
	}

	/**
	 * {@code [a,b,...]} 형태의 pgvector 리터럴. <b>바인드 파라미터로 나간다</b> —
	 * 서브쿼리로 넘기면 플래너가 InitPlan 으로 접어 인덱스를 못 쓸 수 있다(핸드오프 §3.2 함정 1).
	 */
	private static String toVectorLiteral(float[] point) {
		StringJoiner sj = new StringJoiner(",", "[", "]");
		for (float v : point) {
			sj.add(Float.toString(v));
		}
		return sj.toString();
	}
}
