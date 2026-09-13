package com.ssafy.backend.music.retrieval;

import java.util.Locale;

/**
 * 같은 녹음 판정 (핸드오프 §1 "참조 구현에는 있었지만 DB 에는 없는 것").
 *
 * <p><b>여정(004)·곡 상세(003)·주변 탐색(005)이 함께 쓴다</b> — 같은 규칙이 두 벌이 되면 갈라진다(005 FR-023).
 * 그래서 어느 기능 패키지도 아닌 {@code retrieval} 에 둔다.
 *
 * <p>참조 구현은 {@code canonical}(같은 녹음 그룹 id)을 들고 있었지만 <b>DB 에는 그 컬럼이 없다.</b>
 * 대신 두 가지로 판정한다 — 거리가 {@code tau_dup} 미만이거나, 정규화 키가 같거나.
 *
 * <p>키는 {@code lower(trim(title))} + {@code lower(trim(artist))} 로 충분하다(핸드오프 §1).
 * 둘 중 하나가 비어 있으면 키를 만들지 않고 <b>거리 판정만</b> 쓴다 — 적재 시 제목이 빈 곡이 3,977개 있어
 * 빈 문자열로 키를 만들면 서로 무관한 곡들이 한 덩어리가 된다.
 */
public final class SameRecording {

	private SameRecording() {
	}

	/**
	 * 정규화 키. 제목·아티스트 중 하나라도 비어 있으면 {@code null} 이다 —
	 * 호출자는 {@code null} 키를 서로 같다고 보면 안 된다.
	 */
	public static String key(String title, String artist) {
		if (title == null || artist == null) {
			return null;
		}
		String t = title.trim().toLowerCase(Locale.ROOT);
		String a = artist.trim().toLowerCase(Locale.ROOT);
		if (t.isEmpty() || a.isEmpty()) {
			return null;
		}
		return t + '\0' + a;
	}

	/** 두 키가 같은 녹음을 가리키는가. {@code null} 키는 절대 같지 않다. */
	public static boolean sameKey(String left, String right) {
		return left != null && left.equals(right);
	}
}
