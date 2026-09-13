# 주말 정성 확인 — 유사도 (v2.1)

생성: 2026-09-06 12:53 · 번들: `serving/v2.1-pca16` (6,624,399 곡) · 후처리 규칙: τ_dup 1.6624 · artist cap 3 · 길이 30–1200s · τ_far 4.912

> **원칙**: 정성 결과로 좌표·규칙을 즉석 수정하지 않는다. 관찰만 기록하고 변경은 월요일 결정. 음원 링크는 YouTube **검색** URL 만 (재생·다운로드·임베드 없음).

## 거리 눈금 (16-D 유클리드)

| 구간 | 거리 | 근거 |
|---|---|---|
| 같은 곡 (같은 녹음의 다른 제출본) | < 1 (median 0.58) | 감사 A7: 같은 MBID 제출본 거리 median 0.58 · p90 5.18 |
| 같은 녹음으로 접는 문턱 τ_dup | 1.66 | 후처리 규칙 (다른 곡 최근접 p1) |
| 일반 이웃 (top-10 끝) | ~3 (nn10 median 3.03 · p90 4.91=τ_far) | 서빙 진단 D3 |
| 비슷한 곡 (플레이리스트 동반 정답쌍) | ~10.7 (median) | 검증 v2 정답쌍 거리 median |
| 무관 | ~14 이상 | 역방향 점검 문턱 (정답쌍 19.2% 가 >14) |

**읽는 법**: top-10 은 거의 항상 거리 2–4 안이다 (지도가 촘촘해서). 그러므로 '거리가 작다' 자체는 정보가 아니고, **같은 분위기로 이어 들을 수 있는가**만 사람이 판단한다. 정답쌍(✓) 은 멜론 플레이리스트에서 함께 등장한 곡 — 6.6M 곡 중 top-10 에 들 확률은 구조적으로 낮다 (Hit@10 5.4%). ✓ 가 없어도 실패가 아니다.

## 사람 채점 기준

- **점수 __/10** = top-10 중 '이 쿼리 다음에 이어 틀어도 어색하지 않은 곡' 수 (분위기·템포·편성 기준. 같은 가수/같은 장르일 필요 없음).
- **결함 표시**: `dup`(같은 곡 다른 판), `spoken`(말/비음악), `wrong-mood`(분위기 정반대), `meta`(제목·아티스트 결측/오염) 중 해당하는 것을 메모 칸에.
- 후처리 후 표(기본)를 채점한다. 원본 top-10 은 접힌 표로 참고만.

## 20곡 쿼리

| # | 묶음 | 아티스트 — 제목 | 플리 등장 | 정답쌍(지도 내) | top-10 내 ✓ | 10위 거리 | 점수 |
|---|---|---|---|---|---|---|---|
| Q1 | 발라드 | 2AM — 전활 받지 않는 너에게 (You Wouldn't Answer My Calls) | 309 | 192 | 0 | 2.95 | __/10 |
| Q2 | 발라드 | 2PM — 비가와 | 14 | 21 | 0 | 3.57 | __/10 |
| Q3 | 발라드 | Se7en — Last of Diary | 3 | 2 | 0 | 4.02 | __/10 |
| Q4 | 댄스 | WIN (Who Is Next) — Go Up (Team A) | 49 | 68 | 0 | 3.12 | __/10 |
| Q5 | 댄스 | B1A4 — Intro - Prologue | 8 | 14 | 0 | 2.89 | __/10 |
| Q6 | 댄스 | PRODUCE 48 — NEKKOYA (PICK ME) | 8 | 5 | 0 | 4.22 | __/10 |
| Q7 | 락 | King Krule — Baby Blue | 153 | 272 | 0 | 3.03 | __/10 |
| Q8 | 락 | Owl City — Silhouette | 116 | 140 | 0 | 2.47 | __/10 |
| Q9 | 힙합 | Drake — Passionfruit | 408 | 691 | 0 | 3.91 | __/10 |
| Q10 | 힙합 | Zion.T — Babay | 374 | 223 | 0 | 3.36 | __/10 |
| Q11 | R&B | DEAN — D (half moon) | 1,334 | 514 | 0 | 3.37 | __/10 |
| Q12 | R&B | Chrisette Michele — Love Is You | 433 | 410 | 0 | 2.37 | __/10 |
| Q13 | 재즈 | Wouter Hamel — March, April, May | 299 | 323 | 0 | 2.51 | __/10 |
| Q14 | 재즈 | Olivia Ong — You and Me | 226 | 178 | 0 | 3.61 | __/10 |
| Q15 | 클래식 | Joep Beving — Ab Ovo | 21 | 13 | 1 | 2.76 | __/10 |
| Q16 | 클래식 | Jackie Evancho — Someday at Christmas | 20 | 95 | 0 | 3.47 | __/10 |
| Q17 | OST | Nujabes — Aruarian Dance | 545 | 466 | 0 | 3.97 | __/10 |
| Q18 | 한국 곡 | CHEEZE — Madeleine Love | 1,415 | 411 | 0 | 3.07 | __/10 |
| Q19 | 한국 곡 | 성시경 — 거리에서 | 1,226 | 266 | 0 | 2.34 | __/10 |
| Q20 | 한국 곡 | 태연 — Rain | 1,108 | 332 | 0 | 3.47 | __/10 |

### Q1 [발라드] 2AM — 전활 받지 않는 너에게 (You Wouldn't Answer My Calls)

- 쿼리: 리프 `root.0.1.2.0.3.3` · 노드 `root.0.1` · 멜론 장르 발라드 · 길이 232.9s · 플레이리스트 등장 309 · [YouTube 검색](https://www.youtube.com/results?search_query=2AM+%EC%A0%84%ED%99%9C+%EB%B0%9B%EC%A7%80+%EC%95%8A%EB%8A%94+%EB%84%88%EC%97%90%EA%B2%8C+%28You+Wouldn%27t+Answer+My+Calls%29)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Looking Back | Aksel | 2.52 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Aksel+Looking+Back) |
| 2 | No Way Out | Jen Wood | 2.61 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jen+Wood+No+Way+Out) |
| 3 | Ventura (For Neal Casal) | Leeroy Stagger | 2.67 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Leeroy+Stagger+Ventura+%28For+Neal+Casal%29) |
| 4 | Mein Gesicht | Various | 2.79 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Various+Mein+Gesicht) |
| 5 | Complete | Blutengel | 2.80 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Blutengel+Complete) |
| 6 | Strojvůdce | Chinaski | 2.83 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Chinaski+Strojv%C5%AFdce) |
| 7 | Crazy Love | Mindy Gledhill | 2.83 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Mindy+Gledhill+Crazy+Love) |
| 8 | Last Dance | Jamie-Lee | 2.83 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jamie-Lee+Last+Dance) |
| 9 | Quae Laetitia | Krypteria | 2.94 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Krypteria+Quae+Laetitia) |
| 10 | Beatrice | Dizzy | 2.95 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Dizzy+Beatrice) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Looking Back | Aksel | 2.52 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Aksel+Looking+Back) |
| 2 | No Way Out | Jen Wood | 2.61 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jen+Wood+No+Way+Out) |
| 3 | Ventura (For Neal Casal) | Leeroy Stagger | 2.67 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Leeroy+Stagger+Ventura+%28For+Neal+Casal%29) |
| 4 | Mein Gesicht | Various | 2.79 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Various+Mein+Gesicht) |
| 5 | Complete | Blutengel | 2.80 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Blutengel+Complete) |
| 6 | Strojvůdce | Chinaski | 2.83 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Chinaski+Strojv%C5%AFdce) |
| 7 | Crazy Love | Mindy Gledhill | 2.83 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Mindy+Gledhill+Crazy+Love) |
| 8 | Last Dance | Jamie-Lee | 2.83 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jamie-Lee+Last+Dance) |
| 9 | Quae Laetitia | Krypteria | 2.94 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Krypteria+Quae+Laetitia) |
| 10 | Beatrice | Dizzy | 2.95 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Dizzy+Beatrice) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q2 [발라드] 2PM — 비가와

- 쿼리: 리프 `root.1.3.1.1.0.0` · 노드 `root.1.3` · 멜론 장르 발라드 · 길이 234.5s · 플레이리스트 등장 14 · [YouTube 검색](https://www.youtube.com/results?search_query=2PM+%EB%B9%84%EA%B0%80%EC%99%80)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | YOU MAY KNOW (1996 September Rec. DEMO) | DOUBLE | 3.31 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=DOUBLE+YOU+MAY+KNOW+%281996+September+Rec.+DEMO%29) |
| 2 | Grab the Moment (Norway) | JOWST | 3.33 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=JOWST+Grab+the+Moment+%28Norway%29) |
| 3 | Filmic | The Wrong Object | 3.40 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Wrong+Object+Filmic) |
| 4 | This Is Not a Love Song | Omar | 3.42 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Omar+This+Is+Not+a+Love+Song) |
| 5 | VALSA DAS ESTAÇÕES | Ayom | 3.48 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Ayom+VALSA+DAS+ESTA%C3%87%C3%95ES) |
| 6 | When You Love Somebody | Craig T. Cooper | 3.48 | root.3.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Craig+T.+Cooper+When+You+Love+Somebody) |
| 7 | Rescue Mission | Jakub Miřejovský | 3.49 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jakub+Mi%C5%99ejovsk%C3%BD+Rescue+Mission) |
| 8 | André Rio&Roberto Menescal&Luciano Magno - Bye Bye, Brasil | Roberto Menescal | 3.54 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Roberto+Menescal+Andr%C3%A9+Rio%26Roberto+Menescal%26Luciano+Magno+-+Bye+Bye%2C+Brasil) |
| 9 | Euro Cowboy | Special EFX | 3.55 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Special+EFX+Euro+Cowboy) |
| 10 | Carnaval na Marim | Alceu Valença | 3.57 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Alceu+Valen%C3%A7a+Carnaval+na+Marim) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | YOU MAY KNOW (1996 September Rec. DEMO) | DOUBLE | 3.31 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=DOUBLE+YOU+MAY+KNOW+%281996+September+Rec.+DEMO%29) |
| 2 | Grab the Moment (Norway) | JOWST | 3.33 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=JOWST+Grab+the+Moment+%28Norway%29) |
| 3 | Filmic | The Wrong Object | 3.40 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Wrong+Object+Filmic) |
| 4 | This Is Not a Love Song | Omar | 3.42 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Omar+This+Is+Not+a+Love+Song) |
| 5 | VALSA DAS ESTAÇÕES | Ayom | 3.48 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Ayom+VALSA+DAS+ESTA%C3%87%C3%95ES) |
| 6 | When You Love Somebody | Craig T. Cooper | 3.48 | root.3.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Craig+T.+Cooper+When+You+Love+Somebody) |
| 7 | Rescue Mission | Jakub Miřejovský | 3.49 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jakub+Mi%C5%99ejovsk%C3%BD+Rescue+Mission) |
| 8 | André Rio&Roberto Menescal&Luciano Magno - Bye Bye, Brasil | Roberto Menescal | 3.54 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Roberto+Menescal+Andr%C3%A9+Rio%26Roberto+Menescal%26Luciano+Magno+-+Bye+Bye%2C+Brasil) |
| 9 | Euro Cowboy | Special EFX | 3.55 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Special+EFX+Euro+Cowboy) |
| 10 | Carnaval na Marim | Alceu Valença | 3.57 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Alceu+Valen%C3%A7a+Carnaval+na+Marim) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q3 [발라드] Se7en — Last of Diary

- 쿼리: 리프 `root.1.0.2.0.2.3` · 노드 `root.1.0` · 멜론 장르 발라드 · 길이 279.4s · 플레이리스트 등장 3 · [YouTube 검색](https://www.youtube.com/results?search_query=Se7en+Last+of+Diary)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | What a Siren is For | Stereochemistry | 2.97 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Stereochemistry+What+a+Siren+is+For) |
| 2 | ÒòÎª | ËÕ»ÛÂ× | 3.27 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=%C3%8B%C3%95%C2%BB%C3%9B%C3%82%C3%97+%C3%92%C3%B2%C3%8E%C2%AA) |
| 3 | High Is More Fly | Hetouht | 3.35 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Hetouht+High+Is+More+Fly) |
| 4 | Universal Frequencies (Beech Boys) | His Name Is Alive | 3.70 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=His+Name+Is+Alive+Universal+Frequencies+%28Beech+Boys%29) |
| 5 | Borderline (An Ode to Self Care) | Christelle Bofale | 3.75 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Christelle+Bofale+Borderline+%28An+Ode+to+Self+Care%29) |
| 6 | Red Light | Ellis | 3.76 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Ellis+Red+Light) |
| 7 | Don't Let Me Down | Adam Levine & Jesse Carmichael | 3.77 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Adam+Levine+%26+Jesse+Carmichael+Don%27t+Let+Me+Down) |
| 8 | No Me Without You | Robbie Seay Band | 3.92 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Robbie+Seay+Band+No+Me+Without+You) |
| 9 | Now and Then | The Proclaimers | 3.99 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Proclaimers+Now+and+Then) |
| 10 | Light in Your Eyes | Voice Male | 4.02 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Voice+Male+Light+in+Your+Eyes) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | What a Siren is For | Stereochemistry | 2.97 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Stereochemistry+What+a+Siren+is+For) |
| 2 | ÒòÎª | ËÕ»ÛÂ× | 3.27 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=%C3%8B%C3%95%C2%BB%C3%9B%C3%82%C3%97+%C3%92%C3%B2%C3%8E%C2%AA) |
| 3 | High Is More Fly | Hetouht | 3.35 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Hetouht+High+Is+More+Fly) |
| 4 | Universal Frequencies (Beech Boys) | His Name Is Alive | 3.70 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=His+Name+Is+Alive+Universal+Frequencies+%28Beech+Boys%29) |
| 5 | Borderline (An Ode to Self Care) | Christelle Bofale | 3.75 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Christelle+Bofale+Borderline+%28An+Ode+to+Self+Care%29) |
| 6 | Red Light | Ellis | 3.76 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Ellis+Red+Light) |
| 7 | Don't Let Me Down | Adam Levine & Jesse Carmichael | 3.77 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Adam+Levine+%26+Jesse+Carmichael+Don%27t+Let+Me+Down) |
| 8 | No Me Without You | Robbie Seay Band | 3.92 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Robbie+Seay+Band+No+Me+Without+You) |
| 9 | Now and Then | The Proclaimers | 3.99 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Proclaimers+Now+and+Then) |
| 10 | Light in Your Eyes | Voice Male | 4.02 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Voice+Male+Light+in+Your+Eyes) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q4 [댄스] WIN (Who Is Next) — Go Up (Team A)

- 쿼리: 리프 `root.2.0.2.1.0.1` · 노드 `root.2.0` · 멜론 장르 댄스 · 길이 213.1s · 플레이리스트 등장 49 · [YouTube 검색](https://www.youtube.com/results?search_query=WIN+%28Who+Is+Next%29+Go+Up+%28Team+A%29)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Someday Motel | nyankobrq & 迷海月 | 2.65 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=nyankobrq+%26+%E8%BF%B7%E6%B5%B7%E6%9C%88+Someday+Motel) |
| 2 | This Town Needs Fun | forests | 2.82 | root.2.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=forests+This+Town+Needs+Fun) |
| 3 | Time Is The Space Between Us | Tim Christensen | 2.84 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Tim+Christensen+Time+Is+The+Space+Between+Us) |
| 4 | Westside Angst | that dog. | 2.95 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=that+dog.+Westside+Angst) |
| 5 | Reset (16volt mix) | Left Spine Down | 3.04 | root.2.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Left+Spine+Down+Reset+%2816volt+mix%29) |
| 6 | So Much Is Lost (Lost in Space mix) | Paradise Lost | 3.05 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Paradise+Lost+So+Much+Is+Lost+%28Lost+in+Space+mix%29) |
| 7 | Move It On Over | 3 Hanks | 3.05 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=3+Hanks+Move+It+On+Over) |
| 8 | MEGLADON | Trippie Redd | 3.06 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Trippie+Redd+MEGLADON) |
| 9 | Basement Ghost Singing | Armor for Sleep | 3.10 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Armor+for+Sleep+Basement+Ghost+Singing) |
| 10 | Lifejacket | Black Knight feat. Json & Shamaya | 3.12 | root.2.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Black+Knight+feat.+Json+%26+Shamaya+Lifejacket) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Someday Motel | nyankobrq & 迷海月 | 2.65 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=nyankobrq+%26+%E8%BF%B7%E6%B5%B7%E6%9C%88+Someday+Motel) |
| 2 | This Town Needs Fun | forests | 2.82 | root.2.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=forests+This+Town+Needs+Fun) |
| 3 | Time Is The Space Between Us | Tim Christensen | 2.84 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Tim+Christensen+Time+Is+The+Space+Between+Us) |
| 4 | Westside Angst | that dog. | 2.95 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=that+dog.+Westside+Angst) |
| 5 | Reset (16volt mix) | Left Spine Down | 3.04 | root.2.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Left+Spine+Down+Reset+%2816volt+mix%29) |
| 6 | So Much Is Lost (Lost in Space mix) | Paradise Lost | 3.05 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Paradise+Lost+So+Much+Is+Lost+%28Lost+in+Space+mix%29) |
| 7 | Move It On Over | 3 Hanks | 3.05 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=3+Hanks+Move+It+On+Over) |
| 8 | MEGLADON | Trippie Redd | 3.06 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Trippie+Redd+MEGLADON) |
| 9 | Basement Ghost Singing | Armor for Sleep | 3.10 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Armor+for+Sleep+Basement+Ghost+Singing) |
| 10 | Lifejacket | Black Knight feat. Json & Shamaya | 3.12 | root.2.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Black+Knight+feat.+Json+%26+Shamaya+Lifejacket) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q5 [댄스] B1A4 — Intro - Prologue

- 쿼리: 리프 `root.0.0.1.0.1.3` · 노드 `root.0.0` · 멜론 장르 댄스 · 길이 66.5s · 플레이리스트 등장 8 · [YouTube 검색](https://www.youtube.com/results?search_query=B1A4+Intro+-+Prologue)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Variations on La Danza (1951, from “A Hound for Trouble”) | Carl Stalling | 2.66 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Carl+Stalling+Variations+on+La+Danza+%281951%2C+from+%E2%80%9CA+Hound+for+Trouble%E2%80%9D%29) |
| 2 | Sorry Again, Mate | Field Music | 2.75 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Field+Music+Sorry+Again%2C+Mate) |
| 3 | Which Way? | Jerry Goldsmith | 2.77 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jerry+Goldsmith+Which+Way%3F) |
| 4 | Salt of the Sea | Wilfred Burns | 2.81 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Wilfred+Burns+Salt+of+the+Sea) |
| 5 | Scolding Wife Reprise | Fiddler's Green | 2.84 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Fiddler%27s+Green+Scolding+Wife+Reprise) |
| 6 | Song of Healing | Zelda Reorchestrated | 2.85 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Zelda+Reorchestrated+Song+of+Healing) |
| 7 | 涙の意味、願いの行方 | 佐野広明 | 2.88 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=%E4%BD%90%E9%87%8E%E5%BA%83%E6%98%8E+%E6%B6%99%E3%81%AE%E6%84%8F%E5%91%B3%E3%80%81%E9%A1%98%E3%81%84%E3%81%AE%E8%A1%8C%E6%96%B9) |
| 8 | Under Fire | Angelo Badalamenti | 2.89 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Angelo+Badalamenti+Under+Fire) |
| 9 | String Quartet 1 | The Chameleons | 2.89 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Chameleons+String+Quartet+1) |
| 10 | The Smallest Church in Sussex (Brass version) | British Sea Power | 2.89 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=British+Sea+Power+The+Smallest+Church+in+Sussex+%28Brass+version%29) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Variations on La Danza (1951, from “A Hound for Trouble”) | Carl Stalling | 2.66 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Carl+Stalling+Variations+on+La+Danza+%281951%2C+from+%E2%80%9CA+Hound+for+Trouble%E2%80%9D%29) |
| 2 | Sorry Again, Mate | Field Music | 2.75 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Field+Music+Sorry+Again%2C+Mate) |
| 3 | Which Way? | Jerry Goldsmith | 2.77 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jerry+Goldsmith+Which+Way%3F) |
| 4 | Salt of the Sea | Wilfred Burns | 2.81 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Wilfred+Burns+Salt+of+the+Sea) |
| 5 | Scolding Wife Reprise | Fiddler's Green | 2.84 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Fiddler%27s+Green+Scolding+Wife+Reprise) |
| 6 | Song of Healing | Zelda Reorchestrated | 2.85 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Zelda+Reorchestrated+Song+of+Healing) |
| 7 | 涙の意味、願いの行方 | 佐野広明 | 2.88 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=%E4%BD%90%E9%87%8E%E5%BA%83%E6%98%8E+%E6%B6%99%E3%81%AE%E6%84%8F%E5%91%B3%E3%80%81%E9%A1%98%E3%81%84%E3%81%AE%E8%A1%8C%E6%96%B9) |
| 8 | Under Fire | Angelo Badalamenti | 2.89 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Angelo+Badalamenti+Under+Fire) |
| 9 | String Quartet 1 | The Chameleons | 2.89 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Chameleons+String+Quartet+1) |
| 10 | The Smallest Church in Sussex (Brass version) | British Sea Power | 2.89 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=British+Sea+Power+The+Smallest+Church+in+Sussex+%28Brass+version%29) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q6 [댄스] PRODUCE 48 — NEKKOYA (PICK ME)

- 쿼리: 리프 `root.3.3.2.0.2.3` · 노드 `root.3.3` · 멜론 장르 댄스 · 길이 279.5s · 플레이리스트 등장 8 · [YouTube 검색](https://www.youtube.com/results?search_query=PRODUCE+48+NEKKOYA+%28PICK+ME%29)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Talking Hands | Domino & Aki | 3.64 | root.2.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Domino+%26+Aki+Talking+Hands) |
| 2 | Broken Empires (Chaos Vector Remix) | Hocico | 3.86 | root.2.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Hocico+Broken+Empires+%28Chaos+Vector+Remix%29) |
| 3 | 불타오르네 (FIRE) | BTS | 3.97 | root.3.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=BTS+%EB%B6%88%ED%83%80%EC%98%A4%EB%A5%B4%EB%84%A4+%28FIRE%29) |
| 4 | Animal (feat. Jean-Baptiste, Nyah) [Radio Edit] | DJ Sammy | 4.04 | root.3.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=DJ+Sammy+Animal+%28feat.+Jean-Baptiste%2C+Nyah%29+%5BRadio+Edit%5D) |
| 5 | 11. Iridium - Scarnoise | Various Artists | 4.05 | root.3.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Various+Artists+11.+Iridium+-+Scarnoise) |
| 6 | Scarnoise | Iridium | 4.05 | root.3.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Iridium+Scarnoise) |
| 7 | Together | Maor Levi | 4.09 | root.3.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Maor+Levi+Together) |
| 8 | Game Changers | TeddyLoid with 中田ヤスタカ | 4.19 | root.3.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=TeddyLoid+with+%E4%B8%AD%E7%94%B0%E3%83%A4%E3%82%B9%E3%82%BF%E3%82%AB+Game+Changers) |
| 9 | The Spell | Volition | 4.21 | root.2.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Volition+The+Spell) |
| 10 | まぼろし☆まぼろし ft. Nanocat | コウ！ | 4.22 | root.2.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=%E3%82%B3%E3%82%A6%EF%BC%81+%E3%81%BE%E3%81%BB%E3%82%99%E3%82%8D%E3%81%97%E2%98%86%E3%81%BE%E3%81%BB%E3%82%99%E3%82%8D%E3%81%97+ft.+Nanocat) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | 내꺼야 (PICK ME) | PRODUCE 48 | 1.52 | root.3.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=PRODUCE+48+%EB%82%B4%EA%BA%BC%EC%95%BC+%28PICK+ME%29) |
| 2 | Talking Hands | Domino & Aki | 3.64 | root.2.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Domino+%26+Aki+Talking+Hands) |
| 3 | Broken Empires (Chaos Vector Remix) | Hocico | 3.86 | root.2.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Hocico+Broken+Empires+%28Chaos+Vector+Remix%29) |
| 4 | 불타오르네 (FIRE) | BTS | 3.97 | root.3.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=BTS+%EB%B6%88%ED%83%80%EC%98%A4%EB%A5%B4%EB%84%A4+%28FIRE%29) |
| 5 | Animal (feat. Jean-Baptiste, Nyah) [Radio Edit] | DJ Sammy | 4.04 | root.3.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=DJ+Sammy+Animal+%28feat.+Jean-Baptiste%2C+Nyah%29+%5BRadio+Edit%5D) |
| 6 | 11. Iridium - Scarnoise | Various Artists | 4.05 | root.3.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Various+Artists+11.+Iridium+-+Scarnoise) |
| 7 | Scarnoise | Iridium | 4.05 | root.3.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Iridium+Scarnoise) |
| 8 | Together | Maor Levi | 4.09 | root.3.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Maor+Levi+Together) |
| 9 | Game Changers | TeddyLoid with 中田ヤスタカ | 4.19 | root.3.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=TeddyLoid+with+%E4%B8%AD%E7%94%B0%E3%83%A4%E3%82%B9%E3%82%BF%E3%82%AB+Game+Changers) |
| 10 | The Spell | Volition | 4.21 | root.2.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Volition+The+Spell) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q7 [락] King Krule — Baby Blue

- 쿼리: 리프 `root.1.1.1.1.2.3` · 노드 `root.1.1` · 멜론 장르 록/메탈(해외) · 길이 215.5s · 플레이리스트 등장 153 · [YouTube 검색](https://www.youtube.com/results?search_query=King+Krule+Baby+Blue)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Don't Smoke in Bed | Jacintha | 2.37 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jacintha+Don%27t+Smoke+in+Bed) |
| 2 | Save Your Love for Me | Eliane Elias | 2.61 | root.1.1 | 재즈 |  | [YouTube 검색](https://www.youtube.com/results?search_query=Eliane+Elias+Save+Your+Love+for+Me) |
| 3 | Chinatown | Shakey Graves | 2.63 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Shakey+Graves+Chinatown) |
| 4 | Bostad | Olle Vikström | 2.82 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Olle+Vikstr%C3%B6m+Bostad) |
| 5 | Quiet Side | Abram Shook | 2.88 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Abram+Shook+Quiet+Side) |
| 6 | Wake Up in Paris | The Hot Sardines | 2.94 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Hot+Sardines+Wake+Up+in+Paris) |
| 7 | Visitor | The Bony King of Nowhere | 2.97 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Bony+King+of+Nowhere+Visitor) |
| 8 | Golden Phones | Thee Oh Sees | 2.98 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Thee+Oh+Sees+Golden+Phones) |
| 9 | hand of fate: playback | 鷺巣詩郎 | 3.03 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=%E9%B7%BA%E5%B7%A3%E8%A9%A9%E9%83%8E+hand+of+fate%3A+playback) |
| 10 | Take Care of Us | Revelations | 3.03 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Revelations+Take+Care+of+Us) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Don't Smoke in Bed | Jacintha | 2.37 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jacintha+Don%27t+Smoke+in+Bed) |
| 2 | Save Your Love for Me | Eliane Elias | 2.61 | root.1.1 | 재즈 |  | [YouTube 검색](https://www.youtube.com/results?search_query=Eliane+Elias+Save+Your+Love+for+Me) |
| 3 | Chinatown | Shakey Graves | 2.63 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Shakey+Graves+Chinatown) |
| 4 | Bostad | Olle Vikström | 2.82 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Olle+Vikstr%C3%B6m+Bostad) |
| 5 | Quiet Side | Abram Shook | 2.88 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Abram+Shook+Quiet+Side) |
| 6 | Wake Up in Paris | The Hot Sardines | 2.94 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Hot+Sardines+Wake+Up+in+Paris) |
| 7 | Visitor | The Bony King of Nowhere | 2.97 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Bony+King+of+Nowhere+Visitor) |
| 8 | Golden Phones | Thee Oh Sees | 2.98 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Thee+Oh+Sees+Golden+Phones) |
| 9 | hand of fate: playback | 鷺巣詩郎 | 3.03 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=%E9%B7%BA%E5%B7%A3%E8%A9%A9%E9%83%8E+hand+of+fate%3A+playback) |
| 10 | Take Care of Us | Revelations | 3.03 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Revelations+Take+Care+of+Us) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q8 [락] Owl City — Silhouette

- 쿼리: 리프 `root.0.1.1.2.2.0` · 노드 `root.0.1` · 멜론 장르 록/메탈(해외) · 길이 251.9s · 플레이리스트 등장 116 · [YouTube 검색](https://www.youtube.com/results?search_query=Owl+City+Silhouette)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Hyssop | Anna Westin | 2.25 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Anna+Westin+Hyssop) |
| 2 | Fantastic Place | Marillion | 2.30 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Marillion+Fantastic+Place) |
| 3 | The Last to Kow | Gary Burton | 2.36 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Gary+Burton+The+Last+to+Kow) |
| 4 | Ci parliamo da grandi | Eros Ramazzotti | 2.36 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Eros+Ramazzotti+Ci+parliamo+da+grandi) |
| 5 | Find Your Kindness | Rend Collective Experiment | 2.37 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Rend+Collective+Experiment+Find+Your+Kindness) |
| 6 | Music Box Blues | Trans-Siberian Orchestra | 2.38 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Trans-Siberian+Orchestra+Music+Box+Blues) |
| 7 | Looking Forward, Looking Back | Chandeen | 2.39 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Chandeen+Looking+Forward%2C+Looking+Back) |
| 8 | That's What My Love Is For | Anne Murray/Aaron Neville | 2.39 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Anne+Murray%2FAaron+Neville+That%27s+What+My+Love+Is+For) |
| 9 | Afscheid | Wim Soutaer | 2.42 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Wim+Soutaer+Afscheid) |
| 10 | Birdie | Father John Misty | 2.47 | root.1.0 | 포크/블루스/컨트리(해외) |  | [YouTube 검색](https://www.youtube.com/results?search_query=Father+John+Misty+Birdie) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Hyssop | Anna Westin | 2.25 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Anna+Westin+Hyssop) |
| 2 | Fantastic Place | Marillion | 2.30 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Marillion+Fantastic+Place) |
| 3 | The Last to Kow | Gary Burton | 2.36 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Gary+Burton+The+Last+to+Kow) |
| 4 | Ci parliamo da grandi | Eros Ramazzotti | 2.36 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Eros+Ramazzotti+Ci+parliamo+da+grandi) |
| 5 | Find Your Kindness | Rend Collective Experiment | 2.37 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Rend+Collective+Experiment+Find+Your+Kindness) |
| 6 | Music Box Blues | Trans-Siberian Orchestra | 2.38 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Trans-Siberian+Orchestra+Music+Box+Blues) |
| 7 | Looking Forward, Looking Back | Chandeen | 2.39 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Chandeen+Looking+Forward%2C+Looking+Back) |
| 8 | That's What My Love Is For | Anne Murray/Aaron Neville | 2.39 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Anne+Murray%2FAaron+Neville+That%27s+What+My+Love+Is+For) |
| 9 | Afscheid | Wim Soutaer | 2.42 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Wim+Soutaer+Afscheid) |
| 10 | Birdie | Father John Misty | 2.47 | root.1.0 | 포크/블루스/컨트리(해외) |  | [YouTube 검색](https://www.youtube.com/results?search_query=Father+John+Misty+Birdie) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q9 [힙합] Drake — Passionfruit

- 쿼리: 리프 `root.1.3.3.3.0.0` · 노드 `root.1.3` · 멜론 장르 랩/힙합(해외) · 길이 298.9s · 플레이리스트 등장 408 · [YouTube 검색](https://www.youtube.com/results?search_query=Drake+Passionfruit)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Color Her Sunshine | Ta-ku | 3.44 | root.1.3 | 랩/힙합(해외) |  | [YouTube 검색](https://www.youtube.com/results?search_query=Ta-ku+Color+Her+Sunshine) |
| 2 | Solace | Eschaton | 3.56 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Eschaton+Solace) |
| 3 | Eglantine | Miftah Bravenda | 3.72 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Miftah+Bravenda+Eglantine) |
| 4 | Time Machine (feat Qi Yama) | Joji | 3.75 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Joji+Time+Machine+%28feat+Qi+Yama%29) |
| 5 | Doin Forever | Haywyre | 3.77 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Haywyre+Doin+Forever) |
| 6 | Deptford Bus | Silvestre | 3.78 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Silvestre+Deptford+Bus) |
| 7 | Bouquet de Hoes | OG Brax | 3.82 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=OG+Brax+Bouquet+de+Hoes) |
| 8 | Paralleluniversen | Curse | 3.87 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Curse+Paralleluniversen) |
| 9 | Yasminah (See Your Face Again) | Fred again.. | 3.90 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Fred+again..+Yasminah+%28See+Your+Face+Again%29) |
| 10 | 2 | H.E.R. | 3.91 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=H.E.R.+2) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Color Her Sunshine | Ta-ku | 3.44 | root.1.3 | 랩/힙합(해외) |  | [YouTube 검색](https://www.youtube.com/results?search_query=Ta-ku+Color+Her+Sunshine) |
| 2 | Solace | Eschaton | 3.56 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Eschaton+Solace) |
| 3 | Eglantine | Miftah Bravenda | 3.72 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Miftah+Bravenda+Eglantine) |
| 4 | Time Machine (feat Qi Yama) | Joji | 3.75 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Joji+Time+Machine+%28feat+Qi+Yama%29) |
| 5 | Doin Forever | Haywyre | 3.77 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Haywyre+Doin+Forever) |
| 6 | Deptford Bus | Silvestre | 3.78 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Silvestre+Deptford+Bus) |
| 7 | Bouquet de Hoes | OG Brax | 3.82 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=OG+Brax+Bouquet+de+Hoes) |
| 8 | Paralleluniversen | Curse | 3.87 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Curse+Paralleluniversen) |
| 9 | Yasminah (See Your Face Again) | Fred again.. | 3.90 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Fred+again..+Yasminah+%28See+Your+Face+Again%29) |
| 10 | 2 | H.E.R. | 3.91 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=H.E.R.+2) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q10 [힙합] Zion.T — Babay

- 쿼리: 리프 `root.3.1.1.0.0.2` · 노드 `root.3.1` · 멜론 장르 랩/힙합 · 길이 246.0s · 플레이리스트 등장 374 · [YouTube 검색](https://www.youtube.com/results?search_query=Zion.T+Babay)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Animal | Alvaro Soler | 2.32 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Alvaro+Soler+Animal) |
| 2 | Animal | Alvaro Soler | 2.35 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Alvaro+Soler+Animal) |
| 3 | Skaczesz | Jacek Lachowicz | 2.78 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jacek+Lachowicz+Skaczesz) |
| 4 | Everything Is Going Fine feat. TiRon | Ayomari | 2.94 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Ayomari+Everything+Is+Going+Fine+feat.+TiRon) |
| 5 | Antwerps testament | Tourist LeMC | 3.09 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Tourist+LeMC+Antwerps+testament) |
| 6 | gec 2 Ü (remix) | 100 gecs feat. Dorian Electra | 3.13 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=100+gecs+feat.+Dorian+Electra+gec+2+%C3%9C+%28remix%29) |
| 7 | Happy Ending | Tech N9ne | 3.20 | root.3.1 | 랩/힙합(해외) |  | [YouTube 검색](https://www.youtube.com/results?search_query=Tech+N9ne+Happy+Ending) |
| 8 | Mä en jaksa | Pyhimys | 3.34 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Pyhimys+M%C3%A4+en+jaksa) |
| 9 | 64 | El Capitán feat. DJ Rusan | 3.34 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=El+Capit%C3%A1n+feat.+DJ+Rusan+64) |
| 10 | Vent Og Se | Ankerstjerne feat. Lille | 3.36 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Ankerstjerne+feat.+Lille+Vent+Og+Se) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Animal | Alvaro Soler | 2.32 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Alvaro+Soler+Animal) |
| 2 | Animal | Alvaro Soler | 2.35 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Alvaro+Soler+Animal) |
| 3 | Skaczesz | Jacek Lachowicz | 2.78 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jacek+Lachowicz+Skaczesz) |
| 4 | Everything Is Going Fine feat. TiRon | Ayomari | 2.94 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Ayomari+Everything+Is+Going+Fine+feat.+TiRon) |
| 5 | Antwerps testament | Tourist LeMC | 3.09 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Tourist+LeMC+Antwerps+testament) |
| 6 | gec 2 Ü (remix) | 100 gecs feat. Dorian Electra | 3.13 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=100+gecs+feat.+Dorian+Electra+gec+2+%C3%9C+%28remix%29) |
| 7 | Happy Ending | Tech N9ne | 3.20 | root.3.1 | 랩/힙합(해외) |  | [YouTube 검색](https://www.youtube.com/results?search_query=Tech+N9ne+Happy+Ending) |
| 8 | Mä en jaksa | Pyhimys | 3.34 | root.3.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Pyhimys+M%C3%A4+en+jaksa) |
| 9 | 64 | El Capitán feat. DJ Rusan | 3.34 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=El+Capit%C3%A1n+feat.+DJ+Rusan+64) |
| 10 | Vent Og Se | Ankerstjerne feat. Lille | 3.36 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Ankerstjerne+feat.+Lille+Vent+Og+Se) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q11 [R&B] DEAN — D (half moon)

- 쿼리: 리프 `root.1.3.0.2.3.0` · 노드 `root.1.3` · 멜론 장르 R&B/Soul · 길이 229.4s · 플레이리스트 등장 1,334 · [YouTube 검색](https://www.youtube.com/results?search_query=DEAN+D+%28half+moon%29)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Wu Baby | IDER | 2.91 | root.3.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=IDER+Wu+Baby) |
| 2 | Benefits From Mutual Relationships | Lord Jah-Monte Ogbon | 2.99 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Lord+Jah-Monte+Ogbon+Benefits+From+Mutual+Relationships) |
| 3 | Dark Rider | NINA | 3.00 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=NINA+Dark+Rider) |
| 4 | Dear Life | Romina | 3.02 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Romina+Dear+Life) |
| 5 | Pleasure | Montaigne | 3.08 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Montaigne+Pleasure) |
| 6 | For a Better Day | Avicii | 3.24 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Avicii+For+a+Better+Day) |
| 7 | This Is The Moment (feat. Steven Bradford) | 9 Theory | 3.27 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=9+Theory+This+Is+The+Moment+%28feat.+Steven+Bradford%29) |
| 8 | Rhythm & Light | The Aggrolites | 3.33 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Aggrolites+Rhythm+%26+Light) |
| 9 | A.M. | A-bee | 3.34 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=A-bee+A.M.) |
| 10 | Premonitions | Miya Folick | 3.37 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Miya+Folick+Premonitions) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Wu Baby | IDER | 2.91 | root.3.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=IDER+Wu+Baby) |
| 2 | Benefits From Mutual Relationships | Lord Jah-Monte Ogbon | 2.99 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Lord+Jah-Monte+Ogbon+Benefits+From+Mutual+Relationships) |
| 3 | Dark Rider | NINA | 3.00 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=NINA+Dark+Rider) |
| 4 | Dear Life | Romina | 3.02 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Romina+Dear+Life) |
| 5 | Pleasure | Montaigne | 3.08 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Montaigne+Pleasure) |
| 6 | For a Better Day | Avicii | 3.24 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Avicii+For+a+Better+Day) |
| 7 | This Is The Moment (feat. Steven Bradford) | 9 Theory | 3.27 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=9+Theory+This+Is+The+Moment+%28feat.+Steven+Bradford%29) |
| 8 | Rhythm & Light | The Aggrolites | 3.33 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Aggrolites+Rhythm+%26+Light) |
| 9 | A.M. | A-bee | 3.34 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=A-bee+A.M.) |
| 10 | Premonitions | Miya Folick | 3.37 | root.1.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Miya+Folick+Premonitions) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q12 [R&B] Chrisette Michele — Love Is You

- 쿼리: 리프 `root.0.3.0.2.2.2` · 노드 `root.0.3` · 멜론 장르 R&B/Soul(해외) · 길이 197.5s · 플레이리스트 등장 433 · [YouTube 검색](https://www.youtube.com/results?search_query=Chrisette+Michele+Love+Is+You)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | June In January | Benny Carter | 1.70 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Benny+Carter+June+In+January) |
| 2 | Tell Me More And More And Then | Billie Holiday | 1.83 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Billie+Holiday+Tell+Me+More+And+More+And+Then) |
| 3 | Tell Me More | Billie Holiday | 1.92 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Billie+Holiday+Tell+Me+More) |
| 4 | Tell Me More and More and Then Some | Billie Holiday and Her Orchestra | 1.94 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Billie+Holiday+and+Her+Orchestra+Tell+Me+More+and+More+and+Then+Some) |
| 5 | Brother, Can You Spare A Dime | Sophia Shorai | 2.19 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Sophia+Shorai+Brother%2C+Can+You+Spare+A+Dime) |
| 6 | Abdullah | Fats Waller | 2.24 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Fats+Waller+Abdullah) |
| 7 | Danser Encore | Calogero | 2.34 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Calogero+Danser+Encore) |
| 8 | Sa jeunesse | Nana Mouskouri | 2.35 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Nana+Mouskouri+Sa+jeunesse) |
| 9 | Girl Friends | Sonny Boy Williamson | 2.36 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Sonny+Boy+Williamson+Girl+Friends) |
| 10 | Oh, Darling | San Fermin | 2.37 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=San+Fermin+Oh%2C+Darling) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | June In January | Benny Carter | 1.70 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Benny+Carter+June+In+January) |
| 2 | Tell Me More And More And Then | Billie Holiday | 1.83 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Billie+Holiday+Tell+Me+More+And+More+And+Then) |
| 3 | Tell Me More | Billie Holiday | 1.92 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Billie+Holiday+Tell+Me+More) |
| 4 | Tell Me More and More and Then Some | Billie Holiday and Her Orchestra | 1.94 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Billie+Holiday+and+Her+Orchestra+Tell+Me+More+and+More+and+Then+Some) |
| 5 | Brother, Can You Spare A Dime | Sophia Shorai | 2.19 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Sophia+Shorai+Brother%2C+Can+You+Spare+A+Dime) |
| 6 | Abdullah | Fats Waller | 2.24 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Fats+Waller+Abdullah) |
| 7 | Danser Encore | Calogero | 2.34 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Calogero+Danser+Encore) |
| 8 | Sa jeunesse | Nana Mouskouri | 2.35 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Nana+Mouskouri+Sa+jeunesse) |
| 9 | Girl Friends | Sonny Boy Williamson | 2.36 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Sonny+Boy+Williamson+Girl+Friends) |
| 10 | Oh, Darling | San Fermin | 2.37 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=San+Fermin+Oh%2C+Darling) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q13 [재즈] Wouter Hamel — March, April, May

- 쿼리: 리프 `root.0.2.0.2.3.2` · 노드 `root.0.2` · 멜론 장르 재즈 · 길이 221.4s · 플레이리스트 등장 299 · [YouTube 검색](https://www.youtube.com/results?search_query=Wouter+Hamel+March%2C+April%2C+May)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Ain't Nothin' Wrong With Good Lovin' | The O'Jays | 2.17 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+O%27Jays+Ain%27t+Nothin%27+Wrong+With+Good+Lovin%27) |
| 2 | Santa Claus Is Coming to Town | Wynton Marsalis | 2.30 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Wynton+Marsalis+Santa+Claus+Is+Coming+to+Town) |
| 3 | Liza (All The Clouds'll Roll Away) | Thelonious Monk | 2.41 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Thelonious+Monk+Liza+%28All+The+Clouds%27ll+Roll+Away%29) |
| 4 | Liza (All The Clouds'll Roll Away) (from Show Girl) | George Gershwin | 2.41 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=George+Gershwin+Liza+%28All+The+Clouds%27ll+Roll+Away%29+%28from+Show+Girl%29) |
| 5 | No More Crying | Lloyd Jones | 2.45 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Lloyd+Jones+No+More+Crying) |
| 6 | Should Have Come Home | Shemekia Copeland | 2.46 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Shemekia+Copeland+Should+Have+Come+Home) |
| 7 | You Took Advantage of Me | Regina Carter | 2.47 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Regina+Carter+You+Took+Advantage+of+Me) |
| 8 | More And More | Carly Simon | 2.48 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Carly+Simon+More+And+More) |
| 9 | Stronger Than a Man | Bonnie Tyler | 2.50 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Bonnie+Tyler+Stronger+Than+a+Man) |
| 10 | Make a Little Love to Me | Dionne Warwick | 2.51 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Dionne+Warwick+Make+a+Little+Love+to+Me) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Ain't Nothin' Wrong With Good Lovin' | The O'Jays | 2.17 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+O%27Jays+Ain%27t+Nothin%27+Wrong+With+Good+Lovin%27) |
| 2 | Santa Claus Is Coming to Town | Wynton Marsalis | 2.30 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Wynton+Marsalis+Santa+Claus+Is+Coming+to+Town) |
| 3 | Liza (All The Clouds'll Roll Away) | Thelonious Monk | 2.41 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Thelonious+Monk+Liza+%28All+The+Clouds%27ll+Roll+Away%29) |
| 4 | Liza (All The Clouds'll Roll Away) (from Show Girl) | George Gershwin | 2.41 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=George+Gershwin+Liza+%28All+The+Clouds%27ll+Roll+Away%29+%28from+Show+Girl%29) |
| 5 | No More Crying | Lloyd Jones | 2.45 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Lloyd+Jones+No+More+Crying) |
| 6 | Should Have Come Home | Shemekia Copeland | 2.46 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Shemekia+Copeland+Should+Have+Come+Home) |
| 7 | You Took Advantage of Me | Regina Carter | 2.47 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Regina+Carter+You+Took+Advantage+of+Me) |
| 8 | More And More | Carly Simon | 2.48 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Carly+Simon+More+And+More) |
| 9 | Stronger Than a Man | Bonnie Tyler | 2.50 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Bonnie+Tyler+Stronger+Than+a+Man) |
| 10 | Make a Little Love to Me | Dionne Warwick | 2.51 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Dionne+Warwick+Make+a+Little+Love+to+Me) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q14 [재즈] Olivia Ong — You and Me

- 쿼리: 리프 `root.1.2.3.1.2.1` · 노드 `root.1.2` · 멜론 장르 재즈 · 길이 219.0s · 플레이리스트 등장 226 · [YouTube 검색](https://www.youtube.com/results?search_query=Olivia+Ong+You+and+Me)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Warning Bell | Joan as Police Woman | 2.80 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Joan+as+Police+Woman+Warning+Bell) |
| 2 | Touch the Sky | JazzyBIT | 2.95 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=JazzyBIT+Touch+the+Sky) |
| 3 | Susumu's Blues | Brian Bromberg | 3.20 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Brian+Bromberg+Susumu%27s+Blues) |
| 4 | Pity | Casiopea + Sync DNA | 3.26 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Casiopea+%2B+Sync+DNA+Pity) |
| 5 | April's Fool | Kort | 3.46 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Kort+April%27s+Fool) |
| 6 | Love of My Life | Nils Landgren | 3.49 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Nils+Landgren+Love+of+My+Life) |
| 7 | Laniakea Waltz | Lalo Schifrin | 3.56 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Lalo+Schifrin+Laniakea+Waltz) |
| 8 | Divine Whisper | David Helpling | 3.57 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=David+Helpling+Divine+Whisper) |
| 9 | Eu Entrego - Bonus Track | Ana Moura | 3.60 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Ana+Moura+Eu+Entrego+-+Bonus+Track) |
| 10 | Sandino | Charlie Haden | 3.61 | root.1.2 | 재즈 |  | [YouTube 검색](https://www.youtube.com/results?search_query=Charlie+Haden+Sandino) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Warning Bell | Joan as Police Woman | 2.80 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Joan+as+Police+Woman+Warning+Bell) |
| 2 | Touch the Sky | JazzyBIT | 2.95 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=JazzyBIT+Touch+the+Sky) |
| 3 | Susumu's Blues | Brian Bromberg | 3.20 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Brian+Bromberg+Susumu%27s+Blues) |
| 4 | Pity | Casiopea + Sync DNA | 3.26 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Casiopea+%2B+Sync+DNA+Pity) |
| 5 | April's Fool | Kort | 3.46 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Kort+April%27s+Fool) |
| 6 | Love of My Life | Nils Landgren | 3.49 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Nils+Landgren+Love+of+My+Life) |
| 7 | Laniakea Waltz | Lalo Schifrin | 3.56 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Lalo+Schifrin+Laniakea+Waltz) |
| 8 | Divine Whisper | David Helpling | 3.57 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=David+Helpling+Divine+Whisper) |
| 9 | Eu Entrego - Bonus Track | Ana Moura | 3.60 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Ana+Moura+Eu+Entrego+-+Bonus+Track) |
| 10 | Sandino | Charlie Haden | 3.61 | root.1.2 | 재즈 |  | [YouTube 검색](https://www.youtube.com/results?search_query=Charlie+Haden+Sandino) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q15 [클래식] Joep Beving — Ab Ovo

- 쿼리: 리프 `root.1.0.1.1.0.1` · 노드 `root.1.0` · 멜론 장르 클래식 · 길이 288.3s · 플레이리스트 등장 21 · [YouTube 검색](https://www.youtube.com/results?search_query=Joep+Beving+Ab+Ovo)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Invitation | Wear Your Wounds | 2.24 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Wear+Your+Wounds+Invitation) |
| 2 | Cripple Crow | Caleb R.K. Williams | 2.28 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Caleb+R.K.+Williams+Cripple+Crow) |
| 3 | Anona | Otto A. Totland | 2.38 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Otto+A.+Totland+Anona) |
| 4 | Katsura River | Lake of Madder | 2.42 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Lake+of+Madder+Katsura+River) |
| 5 | ghost boy | Xu | 2.50 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Xu+ghost+boy) |
| 6 | Reconcillation | Cliff Eidelman | 2.53 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Cliff+Eidelman+Reconcillation) |
| 7 | Century Seasons | Jonn Serrie | 2.55 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jonn+Serrie+Century+Seasons) |
| 8 | I Never Wanted To Write These Words Down For You | MAINE | 2.60 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=MAINE+I+Never+Wanted+To+Write+These+Words+Down+For+You) |
| 9 | Midwayer | Joep Beving | 2.67 | root.1.0 | 클래식 | ✓ | [YouTube 검색](https://www.youtube.com/results?search_query=Joep+Beving+Midwayer) |
| 10 | Neon Dawn | Otto A. Totland | 2.76 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Otto+A.+Totland+Neon+Dawn) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Invitation | Wear Your Wounds | 2.24 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Wear+Your+Wounds+Invitation) |
| 2 | Cripple Crow | Caleb R.K. Williams | 2.28 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Caleb+R.K.+Williams+Cripple+Crow) |
| 3 | Anona | Otto A. Totland | 2.38 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Otto+A.+Totland+Anona) |
| 4 | Katsura River | Lake of Madder | 2.42 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Lake+of+Madder+Katsura+River) |
| 5 | ghost boy | Xu | 2.50 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Xu+ghost+boy) |
| 6 | Reconcillation | Cliff Eidelman | 2.53 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Cliff+Eidelman+Reconcillation) |
| 7 | Century Seasons | Jonn Serrie | 2.55 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jonn+Serrie+Century+Seasons) |
| 8 | I Never Wanted To Write These Words Down For You | MAINE | 2.60 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=MAINE+I+Never+Wanted+To+Write+These+Words+Down+For+You) |
| 9 | Midwayer | Joep Beving | 2.67 | root.1.0 | 클래식 | ✓ | [YouTube 검색](https://www.youtube.com/results?search_query=Joep+Beving+Midwayer) |
| 10 | Neon Dawn | Otto A. Totland | 2.76 | root.1.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Otto+A.+Totland+Neon+Dawn) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q16 [클래식] Jackie Evancho — Someday at Christmas

- 쿼리: 리프 `root.0.0.0.2.0.2` · 노드 `root.0.0` · 멜론 장르 클래식 · 길이 260.8s · 플레이리스트 등장 20 · [YouTube 검색](https://www.youtube.com/results?search_query=Jackie+Evancho+Someday+at+Christmas)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | It Might As Well Be Spring | Johnny Mathis | 3.14 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Johnny+Mathis+It+Might+As+Well+Be+Spring) |
| 2 | Loppulaulu | Tove Jansson, Mika Pohjola, Mirja Mäkelä & Eeppi Ursin | 3.18 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Tove+Jansson%2C+Mika+Pohjola%2C+Mirja+M%C3%A4kel%C3%A4+%26+Eeppi+Ursin+Loppulaulu) |
| 3 | Nico's Dream | Amina Figarova | 3.19 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Amina+Figarova+Nico%27s+Dream) |
| 4 | Maria | P.J. Proby | 3.24 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=P.J.+Proby+Maria) |
| 5 | Chosen (Feat․ Myuu & Elsie Lovelock) | The Living Tombstone | 3.28 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Living+Tombstone+Chosen+%28Feat%E2%80%A4+Myuu+%26+Elsie+Lovelock%29) |
| 6 | Noël Blanc | Jacqueline François | 3.33 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jacqueline+Fran%C3%A7ois+No%C3%ABl+Blanc) |
| 7 | Cascade | Al Di Meola | 3.39 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Al+Di+Meola+Cascade) |
| 8 | Triptych "Man, Penetration", Part 2: Night | The Archestra | 3.42 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Archestra+Triptych+%22Man%2C+Penetration%22%2C+Part+2%3A+Night) |
| 9 | Motivos | Luis Miguel | 3.46 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Luis+Miguel+Motivos) |
| 10 | Echoes Of Thought | Alex Sipiagin | 3.47 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Alex+Sipiagin+Echoes+Of+Thought) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | It Might As Well Be Spring | Johnny Mathis | 3.14 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Johnny+Mathis+It+Might+As+Well+Be+Spring) |
| 2 | Loppulaulu | Tove Jansson, Mika Pohjola, Mirja Mäkelä & Eeppi Ursin | 3.18 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Tove+Jansson%2C+Mika+Pohjola%2C+Mirja+M%C3%A4kel%C3%A4+%26+Eeppi+Ursin+Loppulaulu) |
| 3 | Nico's Dream | Amina Figarova | 3.19 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Amina+Figarova+Nico%27s+Dream) |
| 4 | Maria | P.J. Proby | 3.24 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=P.J.+Proby+Maria) |
| 5 | Chosen (Feat․ Myuu & Elsie Lovelock) | The Living Tombstone | 3.28 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Living+Tombstone+Chosen+%28Feat%E2%80%A4+Myuu+%26+Elsie+Lovelock%29) |
| 6 | Maria | P.J. Proby | 3.28 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=P.J.+Proby+Maria) |
| 7 | Noël Blanc | Jacqueline François | 3.33 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jacqueline+Fran%C3%A7ois+No%C3%ABl+Blanc) |
| 8 | Cascade | Al Di Meola | 3.39 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Al+Di+Meola+Cascade) |
| 9 | Triptych "Man, Penetration", Part 2: Night | The Archestra | 3.42 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Archestra+Triptych+%22Man%2C+Penetration%22%2C+Part+2%3A+Night) |
| 10 | Maria | P.J. Proby | 3.43 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=P.J.+Proby+Maria) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q17 [OST] Nujabes — Aruarian Dance

- 쿼리: 리프 `root.1.2.2.3.1.2` · 노드 `root.1.2` · 멜론 장르 OST · 길이 249.4s · 플레이리스트 등장 545 · [YouTube 검색](https://www.youtube.com/results?search_query=Nujabes+Aruarian+Dance)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Lucky Sue | Men I Trust | 3.52 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Men+I+Trust+Lucky+Sue) |
| 2 | Butter | Boney James | 3.65 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Boney+James+Butter) |
| 3 | Young, Latin and Proud | Helado Negro | 3.77 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Helado+Negro+Young%2C+Latin+and+Proud) |
| 4 | Bad vague | FLVKE | 3.78 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=FLVKE+Bad+vague) |
| 5 | Sumthin' Sumthin' (Mellosmoothe) | Maxwell | 3.79 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Maxwell+Sumthin%27+Sumthin%27+%28Mellosmoothe%29) |
| 6 | Arctikal | Antarctica | 3.80 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Antarctica+Arctikal) |
| 7 | Room 16-18 | Rone | 3.81 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Rone+Room+16-18) |
| 8 | Vica Pacheco - Crisantemo | FRUITS | 3.93 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=FRUITS+Vica+Pacheco+-+Crisantemo) |
| 9 | Everyone Else in the World | Stina Nordenstam | 3.96 | root.1.2 | POP |  | [YouTube 검색](https://www.youtube.com/results?search_query=Stina+Nordenstam+Everyone+Else+in+the+World) |
| 10 | Labyrinth | Direct & Essenger | 3.97 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Direct+%26+Essenger+Labyrinth) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Lucky Sue | Men I Trust | 3.52 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Men+I+Trust+Lucky+Sue) |
| 2 | Butter | Boney James | 3.65 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Boney+James+Butter) |
| 3 | Young, Latin and Proud | Helado Negro | 3.77 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Helado+Negro+Young%2C+Latin+and+Proud) |
| 4 | Bad vague | FLVKE | 3.78 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=FLVKE+Bad+vague) |
| 5 | Sumthin' Sumthin' (Mellosmoothe) | Maxwell | 3.79 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Maxwell+Sumthin%27+Sumthin%27+%28Mellosmoothe%29) |
| 6 | Arctikal | Antarctica | 3.80 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Antarctica+Arctikal) |
| 7 | Room 16-18 | Rone | 3.81 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Rone+Room+16-18) |
| 8 | Vica Pacheco - Crisantemo | FRUITS | 3.93 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=FRUITS+Vica+Pacheco+-+Crisantemo) |
| 9 | Everyone Else in the World | Stina Nordenstam | 3.96 | root.1.2 | POP |  | [YouTube 검색](https://www.youtube.com/results?search_query=Stina+Nordenstam+Everyone+Else+in+the+World) |
| 10 | Labyrinth | Direct & Essenger | 3.97 | root.1.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Direct+%26+Essenger+Labyrinth) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q18 [한국 곡] CHEEZE — Madeleine Love

- 쿼리: 리프 `root.1.1.1.0.1.1` · 노드 `root.1.1` · 멜론 장르 인디 · 길이 218.6s · 플레이리스트 등장 1,415 · [YouTube 검색](https://www.youtube.com/results?search_query=CHEEZE+Madeleine+Love)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Because He Lives | Harry Connick, Jr. | 2.40 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Harry+Connick%2C+Jr.+Because+He+Lives) |
| 2 | Fortress Around Your Heart | The Tierney Sutton Band | 2.57 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Tierney+Sutton+Band+Fortress+Around+Your+Heart) |
| 3 | Morning | Clare Fischer | 2.77 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Clare+Fischer+Morning) |
| 4 | Kello kuusi | Eero Koivistoinen | 2.84 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Eero+Koivistoinen+Kello+kuusi) |
| 5 | GUNPEI | SAKEROCK | 2.87 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=SAKEROCK+GUNPEI) |
| 6 | A Wink And A Smile | Various Artists | 2.93 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Various+Artists+A+Wink+And+A+Smile) |
| 7 | Feel Like Making Love | Marlena Shaw | 2.94 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Marlena+Shaw+Feel+Like+Making+Love) |
| 8 | Bullet | Angry Son | 3.02 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Angry+Son+Bullet) |
| 9 | Is That So | Lee Morgan | 3.02 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Lee+Morgan+Is+That+So) |
| 10 | Mat-Matt | Orrin Evans | 3.07 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Orrin+Evans+Mat-Matt) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Because He Lives | Harry Connick, Jr. | 2.40 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Harry+Connick%2C+Jr.+Because+He+Lives) |
| 2 | Fortress Around Your Heart | The Tierney Sutton Band | 2.57 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=The+Tierney+Sutton+Band+Fortress+Around+Your+Heart) |
| 3 | Morning | Clare Fischer | 2.77 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Clare+Fischer+Morning) |
| 4 | Kello kuusi | Eero Koivistoinen | 2.84 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Eero+Koivistoinen+Kello+kuusi) |
| 5 | GUNPEI | SAKEROCK | 2.87 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=SAKEROCK+GUNPEI) |
| 6 | A Wink And A Smile | Various Artists | 2.93 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Various+Artists+A+Wink+And+A+Smile) |
| 7 | Feel Like Making Love | Marlena Shaw | 2.94 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Marlena+Shaw+Feel+Like+Making+Love) |
| 8 | Bullet | Angry Son | 3.02 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Angry+Son+Bullet) |
| 9 | Is That So | Lee Morgan | 3.02 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Lee+Morgan+Is+That+So) |
| 10 | Mat-Matt | Orrin Evans | 3.07 | root.1.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Orrin+Evans+Mat-Matt) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q19 [한국 곡] 성시경 — 거리에서

- 쿼리: 리프 `root.0.0.3.2.1.3` · 노드 `root.0.0` · 멜론 장르 발라드 · 길이 280.3s · 플레이리스트 등장 1,226 · [YouTube 검색](https://www.youtube.com/results?search_query=%EC%84%B1%EC%8B%9C%EA%B2%BD+%EA%B1%B0%EB%A6%AC%EC%97%90%EC%84%9C)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | HAPPY BIRTHDAY～愛が生まれた～ | 玉置浩二 | 1.74 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=%E7%8E%89%E7%BD%AE%E6%B5%A9%E4%BA%8C+HAPPY+BIRTHDAY%EF%BD%9E%E6%84%9B%E3%81%8C%E7%94%9F%E3%81%BE%E3%82%8C%E3%81%9F%EF%BD%9E) |
| 2 | Tecnicolor | Os Mutantes | 1.93 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Os+Mutantes+Tecnicolor) |
| 3 | Ich habe diese Frau geliebt | Pete „Wyoming" Bender | 2.01 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Pete+%E2%80%9EWyoming%22+Bender+Ich+habe+diese+Frau+geliebt) |
| 4 | Highland Harry | Rebecca Wright & Donald McKay | 2.11 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Rebecca+Wright+%26+Donald+McKay+Highland+Harry) |
| 5 | Long Run | Jacob Dinesen | 2.14 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jacob+Dinesen+Long+Run) |
| 6 | Min bror | Magda Andersson & Helhjärtat | 2.21 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Magda+Andersson+%26+Helhj%C3%A4rtat+Min+bror) |
| 7 | Dépressive | Jane Birkin; Serge Gainsbourg | 2.27 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jane+Birkin%3B+Serge+Gainsbourg+D%C3%A9pressive) |
| 8 | Himlen är oskyldigt blå | Jill Johnson | 2.30 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jill+Johnson+Himlen+%C3%A4r+oskyldigt+bl%C3%A5) |
| 9 | On a Christmas Night | Chris de Burgh | 2.32 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Chris+de+Burgh+On+a+Christmas+Night) |
| 10 | Lose Your Way | Sophie B. Hawkins | 2.34 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Sophie+B.+Hawkins+Lose+Your+Way) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | HAPPY BIRTHDAY～愛が生まれた～ | 玉置浩二 | 1.74 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=%E7%8E%89%E7%BD%AE%E6%B5%A9%E4%BA%8C+HAPPY+BIRTHDAY%EF%BD%9E%E6%84%9B%E3%81%8C%E7%94%9F%E3%81%BE%E3%82%8C%E3%81%9F%EF%BD%9E) |
| 2 | Tecnicolor | Os Mutantes | 1.93 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Os+Mutantes+Tecnicolor) |
| 3 | Ich habe diese Frau geliebt | Pete „Wyoming" Bender | 2.01 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Pete+%E2%80%9EWyoming%22+Bender+Ich+habe+diese+Frau+geliebt) |
| 4 | Highland Harry | Rebecca Wright & Donald McKay | 2.11 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Rebecca+Wright+%26+Donald+McKay+Highland+Harry) |
| 5 | Long Run | Jacob Dinesen | 2.14 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jacob+Dinesen+Long+Run) |
| 6 | Min bror | Magda Andersson & Helhjärtat | 2.21 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Magda+Andersson+%26+Helhj%C3%A4rtat+Min+bror) |
| 7 | Dépressive | Jane Birkin; Serge Gainsbourg | 2.27 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jane+Birkin%3B+Serge+Gainsbourg+D%C3%A9pressive) |
| 8 | Himlen är oskyldigt blå | Jill Johnson | 2.30 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jill+Johnson+Himlen+%C3%A4r+oskyldigt+bl%C3%A5) |
| 9 | On a Christmas Night | Chris de Burgh | 2.32 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Chris+de+Burgh+On+a+Christmas+Night) |
| 10 | Lose Your Way | Sophie B. Hawkins | 2.34 | root.0.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Sophie+B.+Hawkins+Lose+Your+Way) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

### Q20 [한국 곡] 태연 — Rain

- 쿼리: 리프 `root.0.2.3.2.1.0` · 노드 `root.0.2` · 멜론 장르 뮤직테라피 · 길이 229.7s · 플레이리스트 등장 1,108 · [YouTube 검색](https://www.youtube.com/results?search_query=%ED%83%9C%EC%97%B0+Rain)
- 후처리 top-10 (10곡)

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Where's The Reset Button | Sun Devoured Earth | 2.74 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Sun+Devoured+Earth+Where%27s+The+Reset+Button) |
| 2 | Secret Sky | MICHI | 2.88 | root.2.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=MICHI+Secret+Sky) |
| 3 | Wrong Policy Is True | Dyno Luke | 3.11 | root.2.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Dyno+Luke+Wrong+Policy+Is+True) |
| 4 | He's a Pretty Good Man If You Ask Me | Buffy Sainte-Marie | 3.17 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Buffy+Sainte-Marie+He%27s+a+Pretty+Good+Man+If+You+Ask+Me) |
| 5 | XOXO | 자우림 | 3.25 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=%EC%9E%90%EC%9A%B0%EB%A6%BC+XOXO) |
| 6 | If It Wasn't for the Heartache | Jill Holler | 3.33 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jill+Holler+If+It+Wasn%27t+for+the+Heartache) |
| 7 | Jeannie's Waltz | Joe Castro | 3.35 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Joe+Castro+Jeannie%27s+Waltz) |
| 8 | Muleta | Francisca Valenzuela | 3.40 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Francisca+Valenzuela+Muleta) |
| 9 | Si tu t'appelles mélancolie | Joe Dassin | 3.42 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Joe+Dassin+Si+tu+t%27appelles+m%C3%A9lancolie) |
| 10 | She Should Have Been Home | Edwin Starr | 3.47 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Edwin+Starr+She+Should+Have+Been+Home) |

<details><summary>원본 top-10 (후처리 전)</summary>

| # | 제목 | 아티스트 | 거리 | 노드(d2) | 장르 | 정답쌍 | 듣기 |
|---|---|---|---|---|---|---|---|
| 1 | Where's The Reset Button | Sun Devoured Earth | 2.74 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Sun+Devoured+Earth+Where%27s+The+Reset+Button) |
| 2 | Secret Sky | MICHI | 2.88 | root.2.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=MICHI+Secret+Sky) |
| 3 | Wrong Policy Is True | Dyno Luke | 3.11 | root.2.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Dyno+Luke+Wrong+Policy+Is+True) |
| 4 | He's a Pretty Good Man If You Ask Me | Buffy Sainte-Marie | 3.17 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Buffy+Sainte-Marie+He%27s+a+Pretty+Good+Man+If+You+Ask+Me) |
| 5 | XOXO | 자우림 | 3.25 | root.0.3 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=%EC%9E%90%EC%9A%B0%EB%A6%BC+XOXO) |
| 6 | If It Wasn't for the Heartache | Jill Holler | 3.33 | root.0.1 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Jill+Holler+If+It+Wasn%27t+for+the+Heartache) |
| 7 | Jeannie's Waltz | Joe Castro | 3.35 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Joe+Castro+Jeannie%27s+Waltz) |
| 8 | Muleta | Francisca Valenzuela | 3.40 | root.2.0 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Francisca+Valenzuela+Muleta) |
| 9 | Si tu t'appelles mélancolie | Joe Dassin | 3.42 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Joe+Dassin+Si+tu+t%27appelles+m%C3%A9lancolie) |
| 10 | She Should Have Been Home | Edwin Starr | 3.47 | root.0.2 | — |  | [YouTube 검색](https://www.youtube.com/results?search_query=Edwin+Starr+She+Should+Have+Been+Home) |

</details>

**사람 점수: __/10** · 결함: ______ · 메모: ____________________

## 역방향 점검 — 정답쌍인데 지도에서 멀다 (거리 > 14)

지도 안에 양쪽이 있는 정답쌍 172,159 중 33,095 쌍 (19.2%) 이 거리 14 를 넘는다. 인기(플레이리스트 등장 합) 상위 3쌍, 아티스트 중복 없이:

| # | 곡 A | 곡 B | 거리 | 동반 횟수 | 노드 A → B |
|---|---|---|---|---|---|
| 1 | CHEEZE — Madeleine Love ([검색](https://www.youtube.com/results?search_query=CHEEZE+Madeleine+Love)) | Red Velvet — 빨간 맛 (Red Flavor) ([검색](https://www.youtube.com/results?search_query=Red+Velvet+%EB%B9%A8%EA%B0%84+%EB%A7%9B+%28Red+Flavor%29)) | 14.81 | 28 | `root.1.1` → `root.3.1` |
| 2 | 성시경 — 거리에서 ([검색](https://www.youtube.com/results?search_query=%EC%84%B1%EC%8B%9C%EA%B2%BD+%EA%B1%B0%EB%A6%AC%EC%97%90%EC%84%9C)) | 씨스타 — Shake It ([검색](https://www.youtube.com/results?search_query=%EC%94%A8%EC%8A%A4%ED%83%80+Shake+It)) | 14.08 | 7 | `root.0.0` → `root.3.1` |
| 3 | Mike Perry — The Ocean ([검색](https://www.youtube.com/results?search_query=Mike+Perry+The+Ocean)) | Lauv — Paris in the Rain ([검색](https://www.youtube.com/results?search_query=Lauv+Paris+in+the+Rain)) | 16.93 | 52 | `root.3.3` → `root.1.1` |

각 쌍에 대해 사람이 답할 것: **소리가 실제로 다른가 (지도가 맞음) / 소리는 비슷한데 지도가 갈라놓았나 (지도 결함)**. 두 곡을 각각 들어보고 한 줄씩:

- 쌍 1: ______
- 쌍 2: ______
- 쌍 3: ______

## 자동 관찰 — 장르 × depth-1 노드 (브릿지 표본, 숫자만)

지도 위에서 장르가 어느 사분면(depth-1)에 몰리는지. 기대치는 균등 25%. 해석·변경은 월요일.

| 장르 | n | root.0 | root.1 | root.2 | root.3 | 최대 편중 |
|---|---|---|---|---|---|---|
| 록/메탈(해외) | 12,548 | 15% | 18% | 56% | 11% | 56% (root.2) |
| POP | 11,664 | 21% | 33% | 23% | 24% | 33% (root.1) |
| 재즈 | 8,651 | 27% | 55% | 10% | 8% | 55% (root.1) |
| 랩/힙합(해외) | 6,551 | 2% | 28% | 5% | 65% | 65% (root.3) |
| R&B/Soul(해외) | 5,911 | 12% | 39% | 11% | 38% | 39% (root.1) |
| 일렉트로니카 | 5,372 | 5% | 33% | 6% | 55% | 55% (root.3) |
| OST | 4,040 | 30% | 48% | 13% | 10% | 48% (root.1) |
| 포크/블루스/컨트리(해외) | 3,239 | 31% | 45% | 18% | 5% | 45% (root.1) |
| 월드뮤직 | 1,907 | 23% | 35% | 23% | 18% | 35% (root.1) |
| J-POP | 1,662 | 10% | 22% | 44% | 24% | 44% (root.2) |
| 뉴에이지 | 914 | 50% | 45% | 3% | 3% | 50% (root.0) |
| 클래식 | 800 | 56% | 35% | 5% | 3% | 56% (root.0) |
| 뮤직테라피 | 717 | 8% | 12% | 37% | 43% | 43% (root.3) |
| CCM | 712 | 32% | 17% | 39% | 12% | 39% (root.2) |
| 기타 | 509 | 2% | 12% | 10% | 77% | 77% (root.3) |

## 관찰 메모 (월요일 결정용 — 여기서는 변경하지 않음)

- 잘 되는 묶음: ______
- 약한 묶음: ______
- 반복되는 결함 유형: ______
- 후처리 규칙 관련 관찰 (τ_dup·artist cap·τ_far 발동 적절성): ______


---
출처: Kakao Entertainment, melon (www.melon.com)
