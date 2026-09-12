package com.ssafy.backend.music.retrieval;

/**
 * 좌표 최근접 조회 결과 한 건 (핸드오프 §3.2·§4.3).
 *
 * <p>후처리·산출에 필요한 최소 필드만 담는다. {@code MusicDetail} 을 쓰지 않는 이유는 장르 때문이다 —
 * 핸드오프가 <b>"장르는 조인하지 않는다"</b>(29종 멜론 코드를 FE 10종으로 접는 매핑이 아직 없다)고
 * 명시했고, 후보는 층당 200개씩 n회 뽑으므로 조인 비용이 그대로 지연이 된다.
 *
 * <p>응답에 나가는 곡 상세는 산출이 끝난 뒤 {@code JourneyTrackReader} 가 따로 채운다.
 * 이 record 는 <b>산출 내부 표현</b>이고 클라이언트에 나가지 않는다.
 *
 * @param vec  16차원 좌표. DP 가 수십만 번 거리 계산에 쓰므로 배열로 든다 —
 *             {@code Location}(16필드 record)은 응답 직렬화용이고 수치 계산에는 맞지 않는다.
 *             <b>record 의 기본 {@code equals}/{@code hashCode} 는 배열 동일성 기준이다.</b>
 *             후보를 집합에 넣을 때는 {@code id} 로 비교한다
 * @param dist 질의 지점과의 L2 거리. 조회가 거리 오름차순으로 주지만 <b>근사라 순서가 흔들릴 수 있어</b>
 *             호출자가 (거리, id) 로 안정 정렬한다(FR-013)
 */
public record TrackCandidate(
		long id,
		String mbid,
		String title,
		String artist,
		Integer duration,
		float[] vec,
		double dist) {

	/** 이 곡과 다른 좌표 사이 L2 거리. */
	public double distanceTo(float[] other) {
		double sum = 0.0;
		for (int i = 0; i < vec.length; i++) {
			double d = vec[i] - other[i];
			sum += d * d;
		}
		return Math.sqrt(sum);
	}
}
