package com.ssafy.backend.music.like;

import java.time.OffsetDateTime;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.ssafy.backend.music.dto.MusicDetail;

/**
 * 좋아요 목록의 한 곡. 곡 필드는 {@link MusicDetail} 을 그대로 평평하게 싣고 {@code likedAt} 만 더한다 [S15P21A405-650].
 *
 * <p>FE 는 이 목록을 <b>플레이리스트 컴포넌트</b>로 그린다. 플레이리스트 상세(/playlist/detail)의 곡도
 * {@code MusicDetail} 이라, 모양을 맞춰야 같은 어댑터로 한 줄을 만들고 좌표로 별자리를, {@code albumMbid} 로
 * 커버를 그릴 수 있다. 예전에는 필드를 골라 담은 전용 레코드였는데, 화면이 필요로 할 때마다 한 칸씩
 * {@code MusicDetail} 을 복사하게 돼서 걷어냈다. 서비스가 이미 {@code MusicDetail} 로 조회하고 있어 조회는 늘지 않는다.
 *
 * <p>곡 식별자 JSON 키는 {@code id} 다({@code MusicDetail} 과 같다). 이전 모양의 {@code musicId} 는 없다.
 */
public record LikedMusicItem(
        @JsonUnwrapped MusicDetail music,
        OffsetDateTime likedAt) {
}
