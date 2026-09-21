package com.ssafy.backend.music.like;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.Location;
import com.ssafy.backend.music.dto.MusicDetail;

class MusicLikeServiceTests {

    private final MusicLikeMapper mapper = mock(MusicLikeMapper.class);
    private final MusicDetailReader musicReader = mock(MusicDetailReader.class);
    private final MusicLikeService service = new MusicLikeService(mapper, musicReader);

    @Test
    void like_isIdempotentTargetState() {
        OffsetDateTime likedAt = OffsetDateTime.parse("2026-09-21T10:00:00+09:00");
        when(mapper.musicExists(7)).thenReturn(true);
        when(mapper.findLikedAt("me@example.com", 7)).thenReturn(likedAt);

        MusicLikeResponse response = service.change(new MusicLikeRequest(7L, true), "me@example.com");

        verify(mapper).insert("me@example.com", 7);
        assertThat(response).isEqualTo(new MusicLikeResponse(7, true, likedAt));
    }

    @Test
    void unlike_deletesTargetState() {
        when(mapper.musicExists(7)).thenReturn(true);

        MusicLikeResponse response = service.change(new MusicLikeRequest(7L, false), "me@example.com");

        verify(mapper).delete("me@example.com", 7);
        assertThat(response.liked()).isFalse();
        assertThat(response.likedAt()).isNull();
    }

    @Test
    void unknownMusic_throwsNotFound() {
        when(mapper.musicExists(404)).thenReturn(false);

        assertThatThrownBy(() -> service.change(new MusicLikeRequest(404L, true), "me@example.com"))
                .isInstanceOf(CustomException.class)
                .extracting(error -> ((CustomException) error).getErrorCode())
                .isEqualTo(MusicErrorCode.MUSIC_NOT_FOUND);
        verify(mapper, never()).insert("me@example.com", 404);
    }

    @Test
    void likedMusic_preservesLikeOrderAfterBatchLookup() {
        MusicLikeRow newer = row(2, "2026-09-21T11:00:00+09:00");
        MusicLikeRow older = row(1, "2026-09-21T10:00:00+09:00");
        when(mapper.findAllByEmail("me@example.com")).thenReturn(List.of(newer, older));
        when(musicReader.findDetailsByIds(List.of(2L, 1L))).thenReturn(List.of(music(1), music(2)));

        LikedMusicResponse response = service.findAll("me@example.com");

        assertThat(response.items()).extracting(LikedMusicItem::musicId).containsExactly(2L, 1L);
    }

    private static MusicLikeRow row(long id, String time) {
        MusicLikeRow row = new MusicLikeRow();
        row.setMusicId(id);
        row.setLikedAt(OffsetDateTime.parse(time));
        return row;
    }

    private static MusicDetail music(long id) {
        Location location = new Location(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        return new MusicDetail(id, "mbid-" + id, "title-" + id, "artist", 120.0, 180,
                "album", "album-mbid-" + id, 2026, "https://youtube.test/" + id, "video" + id, location, 0, 0);
    }
}
