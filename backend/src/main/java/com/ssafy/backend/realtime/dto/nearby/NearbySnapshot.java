package com.ssafy.backend.realtime.dto.nearby;

import java.util.List;

/**
 * 주변사람 전체 목록과 이후 실시간 변경의 기준 순번.
 *
 * 여기의 snapshotSeq 는 소켓 메시지에 붙는 번호와 같은 값이다. 이 목록을 만든 시점까지
 * 몇 개를 보냈는지를 담으므로, 이 값보다 작거나 같은 번호로 온 주변사람 변경은 이미 목록에
 * 반영된 것이라 버리면 된다.
 *
 * 따라가기 응답({@code RideResponse})에도 같은 이름의 값이 있지만 그쪽은 다른 것을 센다 —
 * 인솔자의 재생 정보가 몇 번 바뀌었는지다. 이름이 같다고 같은 규칙을 옮기면 안 된다.
 */
public record NearbySnapshot(long anchorMusicId, long snapshotSeq, List<NearbyPerson> people) {
}
