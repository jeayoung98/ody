package com.ssafy.backend.realtime.port;

import java.util.Optional;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.ssafy.backend.music.dto.MusicDetailRow;
import com.ssafy.backend.music.mapper.MusicDetailMapper;

/**
 * 이미 구현된 MusicDetailMapper 사용
 * music.location(VECTOR(16)) 은  pc1~pc16 으로 전달받아서
 * 여기서 double[16](pc[0]=PC1) 로 옮겨 CoordinateMapper 입력 형태로 맞춤
 * realtime 은 music 매퍼 실행 계층에만 얇게 결합하고 곡 도메인 로직은 갖지 않는다.
 *
 * 참고: findById 는 상세 컬럼까지 읽지만 PK 단건 조회라 비용 미미. 좌표 전용 경량 쿼리가
 * 필요해지면 BE2 매퍼에 findLocationPc 를 추가해 교체(현재는 재사용 우선).
 */
@Component
@Profile("realtime")
public class MusicLocationAdapter implements MusicLocationPort {

	private final MusicDetailMapper musicDetailMapper;

	public MusicLocationAdapter(MusicDetailMapper musicDetailMapper) {
		this.musicDetailMapper = musicDetailMapper;
	}

	/**
	 * 곡의 PC 좌표를 조회한다.
	 * @param musicId 곡 ID
	 * @return 길이 16 의 PC 좌표 배열(pc[0]=PC1 … pc[15]=PC16). 존재하지 않는 곡이면 empty.
	 */
	@Override
	public Optional<double[]> findLocation(long musicId) {
		MusicDetailRow row = musicDetailMapper.findById(musicId);
		if (row == null) {
			return Optional.empty();
		}
		return Optional.of(new double[] {
				row.getPc1(), row.getPc2(), row.getPc3(), row.getPc4(),
				row.getPc5(), row.getPc6(), row.getPc7(), row.getPc8(),
				row.getPc9(), row.getPc10(), row.getPc11(), row.getPc12(),
				row.getPc13(), row.getPc14(), row.getPc15(), row.getPc16()
		});
	}
}
