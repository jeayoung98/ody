package com.ssafy.backend.music.like;

import java.time.OffsetDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Param;

public interface MusicLikeMapper {

    boolean musicExists(@Param("musicId") long musicId);

    int insert(@Param("email") String email, @Param("musicId") long musicId);

    int delete(@Param("email") String email, @Param("musicId") long musicId);

    OffsetDateTime findLikedAt(@Param("email") String email, @Param("musicId") long musicId);

    List<MusicLikeRow> findAllByEmail(@Param("email") String email);
}
