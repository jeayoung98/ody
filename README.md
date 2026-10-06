<div align="center">

<img src="docs/assets/readme/ody로고.png" alt="ODY 로고" width="160">

# ODY

**소리의 성질로 그린 음악 지도**

약 662만 곡을 하나의 공간에 펼쳐 두고,<br>
내 위치에서 가고 싶은 곳까지 직접 탐색하는 음악 탐색 서비스

<img src="docs/assets/readme/ody메인화면.png" alt="ODY 대표 화면" width="860">

</div>

<br>

## 1. 프로젝트 소개

**ODY**는 공개 음향 분석 데이터(AcousticBrainz)로 약 662만 곡을 **16차원 좌표 공간**에 배치한 음악 지도 서비스입니다.

사용자는 지도 위에서 지금 듣는 곡을 기준으로 **내 위치**를 확인하고, 장르에서 세부 음향 특성까지 단계적으로 파고들며 음악을 찾습니다.<br>
두 곡 사이를 잇는 **여정**을 만들고, 플레이리스트를 **별자리**로 그려 보고, 같은 공간을 탐색 중인 다른 사용자를 **실시간으로 따라가며** 새로운 음악을 발견할 수 있습니다.

<br>

---

## 2. 기획 배경

### 문제

> 사용자는 자신이 어떤 음악을 좋아하는지는 알지만, **그 취향이 음악 전체에서 어디쯤에 있는지**는 알기 어렵습니다.

- **추천의 근거가 보이지 않습니다.**<br>
  스트리밍 서비스의 추천은 결과 목록만 보여 줄 뿐, 그 곡이 왜 추천됐는지, 내가 지금 어디에 있는지는 알려 주지 않습니다.
- **방향을 정할 수 없습니다.**<br>
  추천이 좁게 느껴져도 어느 쪽으로 넓혀야 할지 지정할 방법이 없고, 낯선 장르는 시작할 지점조차 없습니다.
- **취향 공유가 단절돼 있습니다.**<br>
  다른 사람의 취향은 완성된 플레이리스트로만 볼 수 있고, 지금 나와 비슷한 음악을 듣는 사람이 누구인지, 어디를 탐색 중인지는 알 수 없습니다.

### ODY의 접근

> 추천 결과를 목록으로 건네는 대신, **추천이 이루어지는 공간 전체를 지도로 보여 주고 사용자가 그 위에서 목적지를 직접 고르게** 합니다.

| 목표 | 방법 |
| :--- | :--- |
| **취향의 가시화** | 취향을 지도 위 좌표로 표현해 내 위치를 눈으로 확인 |
| **방향의 선택권** | 다음 곡을 서비스가 정하지 않고, 사용자가 목적지를 정해 경로를 따라 이동 |
| **깊이 탐색** | 장르 → 음향 특성(PC 레이어) 순으로 단계적으로 파고들기 |
| **너비 탐색** | 임베딩 공간에서 가까운 곡을 함께 제시 |
| **소리로 확인** | 수치나 그래프가 아니라 실제 음원 재생으로 차이 판단 |
| **취향 기반 연결** | 같은 영역에 있는 사용자를 보여 주고 함께 탐색 |

### 타깃 사용자

- 추천을 그대로 듣기보다 **추천의 근거를 확인하고 방향을 직접 정하고 싶은** 사용자
- 요즘 듣는 음악이 비슷하게 느껴져 **낯선 영역으로 가 보고 싶은** 사용자
- 취향이 비슷한 **다른 사용자를 발견하고 함께 탐색하고 싶은** 사용자

<br>

---

## 3. 주요 기능

### 3.1 주변 탐색

- 곡을 선택하면 아티스트, 발매 연도, 장르, 앨범 커버, 지도상 위치를 보여 줍니다.
- **주변 탐색**: 16차원 음악 공간에서 가장 가까운 곡들을 함께 보여 줍니다.

<p align="center">
  <img src="docs/assets/readme/주변탐색.gif" alt="음악 상세와 주변 탐색" width="760">
</p>

<br>

### 3.2 여정 — 두 곡 사이를 잇는 경로

- 출발 곡과 도착 곡을 고르면, 그 사이를 **자연스럽게 이어 주는 곡들**을 순서대로 만들어 줍니다.
- 두 곡이 멀수록 경유하는 곡이 많아지고, 가까우면 짧은 여정이 됩니다.
- 만든 여정은 순서대로 재생하거나 플레이리스트로 저장할 수 있습니다.

<p align="center">
  <img src="docs/assets/readme/여정.gif" alt="여정 생성" width="760">
</p>

<br>

### 3.3 별자리 작품 콘테스트

- 회차마다 주제(예: 고양이)가 주어지고, 사용자는 곡들을 이어 별자리를 만들고 작품으로 제출합니다.
- **AI가 작품이 주제를 얼마나 닮았는지 채점**하고, 다른 사용자들이 감상하며 좋아요를 누릅니다.
- AI 점수와 좋아요를 합친 **리더보드**로 순위를 겨룹니다. 좋아요는 회차당 3표입니다.

<p align="center">
  <img src="docs/assets/readme/별자리콘테스트.gif" alt="별자리 작품 콘테스트" width="760">
</p>

<br>

### 3.4 따라가기 (동승)

- 공개 계정 사용자의 탐색에 **동승**해, 인솔자가 레이어를 옮기고 곡을 고르는 대로 내 화면이 함께 움직입니다.
- 인솔자가 보고 있는 곡 상세가 내 화면에도 함께 뜨고, 따라가는 인원 수가 표시됩니다.
- 하차하면 하차한 자리에서 내 탐색을 이어 갑니다. 인솔자가 접속을 끊거나 비공개로 바꾸면 자동으로 끝납니다.

<p align="center">
  <img src="docs/assets/readme/따라가기.gif" alt="따라가기" width="760">
</p>

<br>

---

## 4. 핵심 기술 · 차별점

### 4.1 2,946만 건에서 만든 음악 공간

<p align="center">
  <img src="docs/assets/readme/data-pipeline.png" alt="데이터 파이프라인" width="760">
</p>

- 곡마다 수천 개인 음향 측정값에서 의미 있는 특성 270개를 골라내고, **PCA로 16차원 좌표**를 만듭니다.
- 대용량 처리는 2노드 HDFS 위에서 **Spark on YARN**으로 배치 처리합니다.
- **서비스 기준 데이터 버전(v2.1-pca16)을 고정**하고, 새 실험은 별도 후보 버전으로 진행합니다.<br>
  평가와 게이트를 통과한 경우에만 새 서빙 버전으로 올려 실험과 서비스 개발이 서로 흔들지 않게 합니다.

  ```text
  Experiment → Evaluation → Gate → Promote
  ```

<br>

### 4.2 레이어는 '확대'가 아니라 '필터'

- 주성분은 **전체 곡을 대상으로 한 번만 계산해 고정**합니다.<br>
  사용자가 탐색하는 중에 PCA를 다시 계산하지 않기 때문에, **어떤 경로로 들어와도 같은 곡은 같은 위치**에 있습니다.
- 지도는 PC 두 축씩 짝지은 **8개 레이어**(PC1·PC2 … PC15·PC16)로 이루어지며, 설명력이 큰 순서로 적용됩니다.
- 영역을 고를 때마다 후보가 좁혀집니다. 사용자에게는 확대처럼 보이지만, 실제로는 조건이 누적되는 필터입니다.

  ```text
  candidate(N+1) ⊆ candidate(N)
  ```

<br>

### 4.3 16차원 최근접 검색

- 곡 좌표를 PostgreSQL **pgvector `vector(16)`** 로 저장하고 **HNSW 인덱스**로 최근접 곡을 찾습니다.
- Exact KNN 기준선과 비교해 검색 품질(Recall@K)과 지연 시간(p50/p95)을 측정합니다.

<br>

### 4.4 여정 경로 생성 — 축 통로 + Viterbi

- 출발 곡과 도착 곡을 잇는 축을 기준으로, 축에서 크게 벗어나지 않는 곡들로 **통로**를 만듭니다.
- 통로를 진행도에 따라 여러 층으로 나눈 뒤, **Viterbi 알고리즘**으로 아래 비용이 가장 작은 곡 순서를 고릅니다. 곡 사이 간격이 고르고 흐름이 자연스러워집니다.

  ```text
  cost = 걸음 크기² + λ·축 이탈²
  ```

- 경유 곡 수는 두 곡 사이 **거리에 비례**하게 정해, 가까운 두 곡 사이가 엉뚱한 곡으로 채워지지 않게 합니다.

<br>

### 4.5 별자리 — 모양이 곧 플레이리스트

- 별자리는 레이어와 무관한 **고정 2D 좌표(PC1·PC2 축)** 에 놓여, 누가 어느 레이어에서 열어도 같은 모양으로 보입니다.<br>
  덕분에 사용자가 만든 "모양"이 작품으로 성립합니다.
- **그린 모양으로 곡 찾기**: 사용자가 찍은 점들을 음악 공간에 맞춰 이동·회전·균일 확대/축소(좌우 반전 제외)한 뒤, 모양이 가장 닮은 곡 배치를 찾습니다.<br>
  닮은 정도는 **Procrustes 기반 점수(0~100)** 로 평가합니다.
- 작품 채점과 취향 분석 리포트에는 LLM(SSAFY GMS 게이트웨이)을 사용합니다.

<br>

### 4.6 실시간 탐색 공유

- **STOMP over WebSocket**으로 접속 상태, 화면 영역, 반응, 따라가기 이벤트를 주고받습니다.
- 접속 상태·주변 사용자·동승 상태는 **Redis**에 TTL과 함께 두고, 여러 단계로 이루어진 상태 변경은 **Lua 스크립트**로 원자적으로 처리합니다.
- heartbeat와 재동기화(resync)로 연결이 끊겼다 다시 붙어도 현재 상태를 맞춥니다.

<br>

---

## 5. 기술 스택

### Backend

| 분류 | 기술 |
| :--- | :--- |
| **Language · Framework** | Java 17, Spring Boot 4.1.1, Gradle 9.7.1 |
| **Web · Realtime** | Spring Web MVC, Spring WebSocket (STOMP), Bean Validation |
| **Security** | Spring Security, OAuth2 Client, JJWT 0.12.6, Google API Client |
| **Data Access** | Spring JDBC, MyBatis 4.1.0, Spring Data Redis, Spring Data Neo4j |
| **API 문서** | springdoc-openapi 3.1.1 (Swagger UI) |
| **Observability** | Spring Boot Actuator, Micrometer Prometheus |
| **Test** | JUnit 5, H2 |

### Frontend

| 분류 | 기술 |
| :--- | :--- |
| **Language · Framework** | TypeScript 5, React 19.2.8, Next.js 16.3.4 (App Router) |
| **Runtime** | Node.js 24.20.0 |
| **State · Data Fetching** | Zustand 5, TanStack Query 5 |
| **Realtime** | @stomp/stompjs 7.3.0 |
| **Styling · UI** | Tailwind CSS 4, dnd-kit, Chart.js 4.5.1 |

### Data

| 분류 | 기술 |
| :--- | :--- |
| **Distributed Processing** | Apache Spark 4.2.0 on YARN, Hadoop HDFS |
| **Language · Libraries** | Python, NumPy, pandas, PyArrow, scikit-learn |
| **Dataset** | AcousticBrainz, MusicBrainz |
| **Validation Data** | Melon, MLHD |

### Database

| 분류 | 기술 |
| :--- | :--- |
| **RDBMS (Source of Truth)** | PostgreSQL 17.11 + pgvector 0.7.0 (`vector(16)`, HNSW) |
| **Graph** | Neo4j 5.26.30 Community |
| **In-memory** | Redis 7.4.11 |

### Infra · DevOps

| 분류 | 기술 |
| :--- | :--- |
| **CI/CD** | GitLab, Jenkins (Blue-Green 배포) |
| **Container** | Docker, Docker Compose |
| **Web Server · TLS** | Nginx, Certbot |
| **Monitoring** | Prometheus 3.14.0, Grafana 13.2.0, Node Exporter 1.12.1 |
| **Performance Test** | k6 |

### External Services

| 서비스 | 용도 |
| :--- | :--- |
| **Google OAuth** | 소셜 로그인 |
| **YouTube IFrame Player** | 앱 내 음악 재생 |
| **videoid API (yt-dlp)** | 곡 → 재생 가능한 YouTube 영상 매칭 |
| **SSAFY GMS (OpenAI 호환 게이트웨이)** | 별자리 작품 AI 채점, 취향 분석 리포트 |
| **Cover Art Archive** | 앨범 커버 이미지 |

### Collaboration

| 분류 | 도구 |
| :--- | :--- |
| **형상 관리** | GitLab |
| **이슈 관리** | Jira |
| **문서** | Notion |
| **디자인** | <!-- TODO: Figma 등 --> |

<br>

---

## 6. 시스템 아키텍처

<p align="center">
  <img src="docs/assets/readme/ody아키텍쳐.png" alt="시스템 아키텍처" width="900">
</p>

### 구성 요소

| 구성 | 역할 |
| :--- | :--- |
| **Nginx** (app-node) | HTTPS 종료, `/` → Next.js, `/api` → Backend, `/ws` → WebSocket 라우팅 |
| **Next.js** | 프론트엔드 (standalone Node 서버) |
| **Spring Boot** | REST API · STOMP WebSocket 서버. Blue(8081) / Green(8082) 두 슬롯을 번갈아 배포 |
| **PostgreSQL + pgvector** | 서비스 데이터의 원본(Source of Truth), 16차원 곡 좌표와 최근접 검색 |
| **Redis** | 접속 상태·주변 사용자·동승 등 실시간 상태 |
| **Neo4j** | 그래프 투영(graph projection) |
| **HDFS · YARN · Spark** | 음악 데이터 대용량 배치 처리 (master · app 2노드) |
| **Jenkins** | GitLab 브랜치별 빌드·테스트·배포 파이프라인 |
| **Prometheus · Grafana** | 서버·애플리케이션 지표 수집과 대시보드 |
