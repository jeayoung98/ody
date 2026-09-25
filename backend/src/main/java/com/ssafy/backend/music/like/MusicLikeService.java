package com.ssafy.backend.music.like;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.MusicDetail;

@Service
public class MusicLikeService {

    private final MusicLikeMapper mapper;
    private final MusicDetailReader musicReader;

    public MusicLikeService(MusicLikeMapper mapper, MusicDetailReader musicReader) {
        this.mapper = mapper;
        this.musicReader = musicReader;
    }

    @Transactional
    public MusicLikeResponse change(MusicLikeRequest request, String email) {
        if (request == null || request.musicId() == null || request.liked() == null) {
            throw new CustomException(GlobalErrorCode.INVALID_INPUT);
        }
        long musicId = request.musicId();
        if (!mapper.musicExists(musicId)) {
            throw new CustomException(MusicErrorCode.MUSIC_NOT_FOUND);
        }

        if (request.liked()) {
            mapper.insert(email, musicId);
        } else {
            mapper.delete(email, musicId);
        }
        OffsetDateTime likedAt = request.liked() ? mapper.findLikedAt(email, musicId) : null;
        return new MusicLikeResponse(musicId, request.liked(), likedAt);
    }

    @Transactional(readOnly = true)
    public LikedMusicResponse findAll(String email) {
        List<MusicLikeRow> likes = mapper.findAllByEmail(email);
        if (likes.isEmpty()) {
            return new LikedMusicResponse(List.of());
        }

        List<Long> ids = likes.stream().map(MusicLikeRow::getMusicId).toList();
        Map<Long, MusicDetail> byId = new HashMap<>();
        for (MusicDetail music : musicReader.findDetailsByIds(ids)) {
            byId.put(music.id(), music);
        }

        List<LikedMusicItem> items = likes.stream()
                .filter(like -> byId.containsKey(like.getMusicId()))
                .map(like -> toItem(byId.get(like.getMusicId()), like.getLikedAt()))
                .toList();
        return new LikedMusicResponse(items);
    }

    private static LikedMusicItem toItem(MusicDetail music, OffsetDateTime likedAt) {
        return new LikedMusicItem(
                music.id(), music.title(), music.artist(), music.duration(),
                music.youtubeUrl(), music.videoId(), music.location(), music.playCnt(), likedAt);
    }
}
