# 19 videoid API — plan

## 코드 위치

```
data/videoid/__init__.py     패키지 표시
data/videoid/resolver.py     판정 로직. 네트워크 함수는 주입 가능(search_fn/video_fn)
data/videoid/lookup.py       sqlite 캐시 + CLI 한 곡 조회
data/videoid/api.py          http.server 기반 GET /videoid · /health
data/tests/test_videoid_resolver.py   네트워크 없는 검증
```

`scripts/` 는 이식 원본이라 수정 금지이므로 새 디렉터리를 만들었다. `pipeline/`·`ingest/` 는 배치용이고
이건 요청 시점 서빙이라 섞지 않는다.

## 의존

| 항목 | 값 |
| --- | --- |
| Python | 3.12 (`data/.venv`) |
| 런타임 의존 | `yt-dlp` 하나. HTTP 서버·캐시·유사도는 표준 라이브러리(`http.server`·`sqlite3`·`difflib`) |
| `requirements.txt` | `yt-dlp` 추가 필요 — 현재 목록에 없다 |
| 환경변수 | `ODY_VIDEOID_CACHE` 캐시 파일 경로 (기본 `data/videoid/cache.sqlite`) |
| 백엔드 설정 | `ody.videoid.base-url` (`application.yml:27` prod, `:120` test 는 `http://localhost:8001`) |

## 인터페이스 계약

호출자는 백엔드 `VideoIdApiClient` 다. 그쪽이 읽는 것은 `best.videoId` 하나뿐이고
`@JsonIgnoreProperties(ignoreUnknown = true)` 라 응답 필드 추가는 안전하다. **필드 이름을 바꾸거나
`best` 를 없애면 백엔드가 깨진다.**

Python 안에서 쓸 때의 진입점은 둘이다.

```python
from videoid.api import resolve_request      # 백엔드와 같은 모양의 dict
from videoid.lookup import lookup            # 판정 원본 dict (candidates_checked 포함)
```

## 점수 계산

`resolver._guess_score` 가중합. 전부 0..1 로 잘린다.

| 항 | 가중 | 근거 |
| --- | --- | --- |
| 곡명 유사도 | 0.60 | `difflib.SequenceMatcher`. 아티스트 접두와 `(Official Audio)` 류 접미를 떼고 비교 |
| 채널 일치 | 0.25 | 공식 채널 규칙 통과 0.25 · 부분포함 0.18 · 그 외 유사도 비례 |
| 영상 제목에 아티스트 포함 | 0.05 | |
| 길이 근접 | 0.15 / 0.10 / 0.05 | ±2초 / ±5초 / ±15초. `duration` 없으면 0 |

`duration` 이 없으면 최대 0.85 다. 0.6 은 넘을 수 있으므로 추측은 여전히 나온다.

## 성능 예산

| 경로 | 왕복 | 비고 |
| --- | --- | --- |
| 캐시 히트 | 0 | sqlite 조회만 |
| 캐시 미스, 앨범 있음 | 검색 2 + 영상 최대 3 | `ytsearch12` 두 쿼리 |
| 캐시 미스, 앨범 없음 | 검색 1 + 영상 최대 3 | |

백엔드는 연결 2초 / 읽기 3초에서 끊는다(`VideoIdApiClient:29-30`). 캐시 미스는 그 안에 못 들어올 수
있다 — 백엔드는 `Optional.empty()` 로 받고 저장하지 않으므로 다음 호출에 다시 시도한다. 캐시가 채워지면
히트한다.

## 리스크

| 리스크 | 완화 |
| --- | --- |
| 추측 오탐으로 다른 곡이 재생된다 | `confidence` 를 내려보내 호출자가 저장 여부를 결정. 한국 곡 오탐률은 미측정 (spec 미해결 항목) |
| 캐시 미스 시 백엔드 타임아웃 | 임베드 확인 예산 3회로 제한. 영구 해결은 배치 선적재 |
| yt-dlp 가 YouTube 변경으로 깨진다 | 검색 실패를 `retry_pending` 으로 구분해 재생 불가와 섞지 않는다 |
| `ALGORITHM_VERSION` 을 안 올리고 로직만 바꾼다 | 판정 로직 수정 시 상수 갱신을 리뷰 항목으로 둔다 |
