package com.ssafy.backend.taste.music;

import java.util.List;

import org.apache.ibatis.annotations.Param;

public interface TasteMusicMapper {

    List<TasteMusicRow> findLikedMusic(@Param("email") String email);
}
