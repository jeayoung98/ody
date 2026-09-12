package com.ssafy.backend.music.dto;

import lombok.Getter;
import lombok.Setter;

/** music_genre + genre 조인 row (곡 하나에 0..n건). */
@Getter
@Setter
public class MusicGenreRow {

	private Long musicId;
	private String name;
}
