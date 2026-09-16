package com.ssafy.backend.realtime.dto.nearby;

import java.util.List;

/** 주변사람 전체 목록과 이후 실시간 변경의 기준 순번. */
public record NearbySnapshot(long anchorMusicId, long snapshotSeq, List<NearbyPerson> people) {
}
