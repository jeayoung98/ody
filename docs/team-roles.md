# 팀 역할 분담 및 개발 진행 방식

## 1. 현재 프로젝트 상태

ODY는 기획만 존재하는 상태가 아니라, **음악 공간을 구성하기 위한 데이터 파이프라인과 기본 인프라가 이미 상당 부분 구축된 상태**에서 서비스 개발을 시작한다.

현재 데이터 영역에서는 다음 작업이 진행되었다.

```
AcousticBrainz
2,946만 제출본
        ↓ Feature 정제
2,929개
  ↓
389개
  ↓
270개
        ↓
PCA 16차원
        ↓
약 740만 곡 Cohort
        ↓
Catalog 정제
약 662만 곡 Serving Dataset
```

또한 Melon / MLHD 데이터를 이용한 음악 공간 검증과 카탈로그 정제 실험을 수행했고, 현재 Human Listening Evaluation 등 추가 실험을 진행하고 있다.

인프라 역시 기본적인 서비스 운영 환경을 이미 구축하고 있으며, 앞으로는 **서비스 기능 개발과 실제 데이터를 연결하는 것**이 중요한 단계다.

따라서 이후 개발은 6명이 기능을 무작위로 나누는 방식보다 아래 네 Workstream을 중심으로 진행한다.

```
1. Data / Retrieval / Platform
2. Core Service
3. Discovery
4. Realtime
```

---

## 2. 전체 역할

| 담당 | 역할 | 주요 책임 |
| --- | --- | --- |
| **BE4 재영** | **Data / Retrieval / Platform** | 데이터, PCA, 검색, 실험, Serving Artifact, 기존 Infra |
| **BE1 준서** | **Core Backend** | Auth, User, Onboarding, Playlist, MyPage |
| **BE2 효정** | **Discovery Backend** | 음악 지도, PC 탐색, Nearby, Journey |
| **BE3 지원** | **Realtime Backend** | Presence, Nearby User, Reaction, Follow |
| **FE1 주하** | **Exploration Frontend** | 음악 지도, PC Layer, Nearby, Journey |
| **FE2 유진** | **Service / Realtime Frontend** | Auth, Onboarding, Playlist, Detail, Realtime UI |

각 담당자는 자신의 영역의 **Primary Owner**다.

Owner는 모든 구현을 혼자 한다는 뜻이 아니라,

- 해당 기능의 설계를 이해하고
- Contract를 관리하고
- 구현 상태를 알고 있으며
- 변경 시 관련 팀원과 협의할 책임

을 가진다는 의미다.

---

## 3. BE4 재영 — Data / Retrieval / Platform

### 담당

ODY의 **음악 공간과 이를 실제 서비스에서 사용할 수 있도록 만드는 기반**을 담당한다.

#### Data

```
Raw Data
 ↓
Feature Selection
 ↓
Preprocessing
 ↓
PCA
 ↓
Catalog
 ↓
Serving Artifact
```

담당 내용:

- AcousticBrainz 데이터 처리
- Feature Selection
- PCA
- 데이터 품질 검증
- Catalog 정제
- 데이터 버전 관리
- Serving Artifact 생성

#### Retrieval

662만 곡을 실제 서비스에서 검색할 수 있도록 검색 구조를 담당한다.

```
Track
 ↓
PC1 ~ PC16
 ↓
KNN / ANN
 ↓
Candidate
 ↓
Filtering / Reranking
 ↓
Top K
```

주요 업무:

- Exact KNN 기준선
- ANN 후보 비교
- Search Index
- Distance Metric
- Search Postprocessing
- Recall@K
- p50 / p95 Latency
- Memory / Index Build Time Benchmark

#### Evaluation

음악 공간과 검색 결과가 실제로 의미 있는지 검증한다.

현재 및 향후 실험:

- Melon Validation
- MLHD Validation
- Human Listening Evaluation
- Same-Genre Hard Negative
- Journey Evaluation
- PC Weight / Reranking 실험

#### Platform / Infra

기본 인프라는 이미 BE4가 상당 부분 구축한 상태다.

앞으로는 모든 인프라 작업을 BE4가 직접 처리하는 것이 아니라 **전체 구조와 기준을 관리하는 역할**로 전환한다.

BE4가 계속 관리:

- 전체 Infra Architecture
- Data/Search 배포 구조
- Monitoring 구조
- 성능 측정 기준
- 부하 테스트 기준

각 기능에서 필요한 세부 운영은 담당 Backend와 함께 관리한다.

---

## 4. BE1 준서 — Core Backend

### 담당

일반적인 서비스 기능과 Backend의 기본 구조를 담당한다.

```
Auth
User
Onboarding
Playlist
MyPage
Privacy
```

### 주요 업무

- 회원가입 / 로그인
- User
- Onboarding
- Playlist
- MyPage
- Privacy
- DB Schema
- Migration
- 공통 Exception
- 공통 Response
- Backend Convention

기존 인프라 위에서 Backend Application이 안정적으로 배포될 수 있도록 필요한 CI/CD 유지도 함께 담당한다.

---

## 5. BE2 효정 — Discovery Backend

### 담당

ODY에서 사용자가 실제로 **음악을 탐색하는 핵심 Backend 기능**을 담당한다.

### PC 탐색

```
Genre
 ↓
PC1-PC2
 ↓
영역 선택
 ↓
PC3-PC4
 ↓
영역 선택
 ↓
...
 ↓
PC15-PC16
```

이전 Layer에서 선택한 조건은 계속 누적된다.

중요:

```
candidate(N+1) ⊆ candidate(N)
```

사용자 탐색 중 PCA를 다시 계산하지 않는다.

### Nearby

특정 곡 주변의 음악을 탐색한다.

```
Track
 ↓
BE4 Search
 ↓
Neighbor Candidates
 ↓
Discovery Logic
 ↓
API Response
```

#### 역할 구분

**BE4 재영**

```
Search Engine
Distance
Index
Evaluation
```

**BE2 효정**

```
Discovery Business Logic
Genre / Range Filter
Search 호출
API
Response
```

### Journey

```
Start Track
 ↓
Vector Path
 ↓
Intermediate Point
 ↓
Neighbor Search
 ↓
Journey Track List
```

BE4와 검색/거리 로직을 함께 검토하고, 사용자에게 제공되는 Journey API는 BE2가 담당한다.

---

## 6. BE3 지원 — Realtime Backend

### 담당

ODY의 사용자 간 실시간 경험을 담당한다.

```
Presence
 ↓
Nearby User
 ↓
Reaction
 ↓
Follow
```

### 주요 기술

- WebSocket
- Redis
- Presence TTL
- Nearby User
- Reaction Event
- Follow Session
- Reconnect
- 실시간 상태 동기화

### Follow의 의미

ODY의 Follow는 SNS의 팔로우 관계가 아니다.

한 사용자가 현재 탐색하고 있는 음악 공간을 다른 사용자가 실시간으로 같이 탐색하는 기능이다.

예:

```
Leader
PC1-PC2 이동
    ↓
영역 선택
    ↓
PC3-PC4 이동
    ↓
Track 선택
        WebSocket
            ↓
Follower
같은 탐색 상태 반영
```

---

## 7. FE1 주하 — Exploration Frontend

### 담당

ODY의 가장 핵심적인 시각화 영역을 담당한다.

```
Music Map
PC Exploration
Range Selection
Nearby Music
Journey
```

주요 구현:

- 대량 Point Rendering
- Zoom / Pan
- Range Selection
- PC Layer Transition
- 현재 선택 상태 표시
- Breadcrumb
- Nearby Track 표현
- Journey Visualization

BE2 효정과 가장 강하게 협업한다.

---

## 8. FE2 유진 — Service / Realtime Frontend

### 일반 서비스

```
Login
Onboarding
Music Detail
Playlist
MyPage
```

BE1 준서와 협업한다.

### Realtime

```
Nearby User
Reaction
Follow
Follow State
```

BE3 지원과 협업한다.

Follow로 전달받은 탐색 상태를 실제 음악 지도에 적용해야 하기 때문에 FE1과도 인터페이스를 맞춘다.

---

## 9. 협업 구조

ODY는 다음 세 조합을 중심으로 개발한다.

### Core

```
BE1 준서 ↔ FE2 유진
Auth
User
Onboarding
Playlist
```

### Discovery

```
        BE4 재영
 Data / Retrieval
        ↕
        BE2 효정
Discovery Backend
        ↕
        FE1 주하
Exploration UI
```

**ODY의 핵심 개발 라인이다.**

### Realtime

```
BE3 지원 ↔ FE2 유진
  │
  └────→ FE1 주하
Presence
Reaction
Follow
Map Sync
```

---

## 10. Data Version은 고정하고 개발한다

BE4 재영 에서는 계속 실험이 진행된다.

하지만 실험 때문에 Backend와 Frontend 개발 기준이 계속 바뀌면 안 된다.

따라서 현재 Serving Dataset을 하나의 Baseline으로 고정한다.

```
Service Baseline
v2.1-pca16
6,624,399 tracks
```

서비스 개발자는 기본적으로 이 버전을 사용한다.

### 새로운 실험

새로운 실험은 별도의 Candidate Version으로 진행한다.

```
v2.1
 │
 ├─ weighted-distance experiment
 │
 ├─ genre-penalty experiment
 │
 └─ human-feedback experiment
```

실험 결과가 기존보다 좋다는 것이 검증되면:

```
Experiment
 ↓
Evaluation
 ↓
Gate
 ↓
Promote
 ↓
새 Serving Version
```

으로 변경한다.

즉 **실험과 서비스 개발을 분리한다.**

---

## 11. 개발 방식

기능을 전부 만든 뒤 마지막에 연결하지 않는다.

작은 End-to-End 흐름을 하나씩 완성하는 **Vertical Slice 방식**으로 진행한다.

### Slice 1 — ODY 기본 탐색

첫 번째 목표는 이것 하나다.

```
Login
 ↓
Onboarding
 ↓
Genre 선택
 ↓
PC1-PC2
 ↓
영역 선택
 ↓
PC3-PC4
 ↓
Track 선택
 ↓
Music Detail
```

실제 v2.1 데이터를 사용해 Frontend → Backend → Data까지 연결한다.

**담당**

- **BE4 재영** : v2.1 Serving Artifact / Data Contract / Backend에서 Data 조회 가능하게 구성
- **BE1 준서** : Auth / User / Onboarding
- **BE2 효정** : Genre / PC1-PC2 API / PC3-PC4 API
- **BE3 지원** : WebSocket / Presence Prototype
- **FE1 주하** : PC1-PC2 Rendering / 영역 선택 / PC3-PC4 이동
- **FE2 유진** : Login / Onboarding / Music Detail

### Slice 2 — 주변 음악

```
Track 선택
 ↓
Nearby
 ↓
KNN Search
 ↓
Top K
 ↓
Track Detail
 ↓
Playlist
```

중심 담당:

```
BE4 재영 ↔ BE2 효정 ↔ FE1 주하
```

BE1 준서 / FE2 유진 는 Playlist를 연결한다.

### Slice 3 — Journey

```
Start
 ↓
Destination
 ↓
Journey 생성
 ↓
중간 Track
 ↓
Visualization
```

담당:

- **BE4 재영** : 거리 / 검색 / 품질 평가
- **BE2 효정** : Journey Logic / API
- **FE1 주하** : Journey Visualization

### Slice 4 — Realtime

```
Presence
 ↓
Nearby User
 ↓
Reaction
 ↓
Follow
```

담당:

- BE3 지원
- FE2 유진
- FE1 주하 (Map Sync)

---

## 12. 각자 개발할 때 지킬 것

### 기능별 Contract를 먼저 맞춘다

Frontend와 Backend가 각자 추측해서 구현하지 않는다.

예:

```
contracts/openapi/
contracts/websocket/
contracts/data/
```

- **Discovery** : BE2 효정 + FE1 주하 + BE4 재영
- **Core** : BE1 준서 + FE2 유진
- **Realtime** : BE3 지원 + FE2 유진 + FE1 주하

---

## 13. PR 리뷰

모든 사람이 모든 PR을 리뷰하지 않는다.

| 작업 | Primary Reviewer |
| --- | --- |
| Core Backend | 다른 Backend 1명 |
| Discovery Backend | BE4 재영 |
| Data / Search | BE2 효정 |
| Realtime | BE1 준서 또는 BE4 재영 |
| Map Frontend | FE2 유진 |
| Service Frontend | FE1 주하 |

특히:

```
BE4 재영 ↔ BE2 효정
```

는 서로 리뷰한다.

Data/Search와 실제 Discovery Service가 서로 다른 방향으로 발전하는 것을 방지하기 위해서다.

---

## 14. 성능과 실험 결과도 기능으로 본다

ODY에서는 "기능이 동작한다"만으로 Done으로 보지 않는다.

가능한 기능은 정량 지표도 남긴다.

- **Data** : 2,929 → 389 → 270 → PCA16
- **Search** : Recall@K / p50 / p95 / Memory
- **Backend** : API p50 / API p95 / TPS
- **Realtime** : Concurrent Connections / Event p50 / p95 / p99 / Reconnect
- **Human Evaluation** : Similarity / Transition / Failure Type

---

## 15. 최종적으로 각자의 프로젝트 성과

각자가 단순히 "OO 기능을 구현했습니다."로 끝나지 않는 것을 목표로 한다.

- **BE1 준서** : 서비스 Core와 안정적인 Backend 구조를 구축했다.
- **BE2 효정** : 수백만 곡의 고차원 음악 공간을 실제 탐색 API로 구현했다.
- **BE3 지원** : 실시간 음악 공간 공유를 위한 Presence / Follow 시스템을 구축했다.
- **BE4 재영** : 2,946만 건의 데이터에서 음악 공간을 구축하고 검증했으며, 662만 곡을 대상으로 검색 가능한 Retrieval/Serving 환경과 Platform을 구축했다.
- **FE1 주하** : 고차원 음악 공간을 사용자가 이해하고 직접 탐색할 수 있는 인터랙티브 지도 UI로 구현했다.
- **FE2 유진** : 음악 탐색을 사용자 계정·플레이리스트·실시간 상호작용과 연결하는 서비스 UX를 구현했다.

---

## 우리가 가장 먼저 만들 것

모든 기능을 동시에 완성하는 것이 첫 목표가 아니다.

우선 팀 전체가 하나의 실제 흐름을 완성한다.

> **로그인 → 온보딩 → 장르 → PC1-PC2 → 영역 선택 → PC3-PC4 → 곡 선택**

이 흐름을 실제 662만 곡 데이터로 먼저 연결한다.

그 이후:

> **Nearby → Journey → Realtime**

순으로 확장한다.

이 방식으로 진행하면 각자의 작업이 독립적으로 끝나는 것이 아니라, 매 단계마다 실제 ODY 서비스 하나가 완성된다.
