# 정성 평가 양식 — v2.1 음악 지도 (귀로 채점)

작성일 2026-09-07 · 대상 `serving/v2.1-pca16` · 평가자 ______ · 평가일 ______ · 장비 (이어폰/헤드폰/스피커) ______ · 소요 시간 ______

> 이 양식은 **관찰을 기록**하기 위한 것이다. 채점 중 지도·규칙을 고치지 않는다. 결과는 월요일에 모아서 본다. 음원은 YouTube **검색** 링크로 찾아 듣기만 한다 (다운로드·임베드 없음).

## 1. 무엇을 평가하나

지도는 '소리가 비슷한 곡이 가까이 있다'를 목표로 만든 것이다. 그래서 묻는 질문은 하나다.

**"쿼리 곡이 끝난 직후 이 곡이 이어 나오면, 흐름이 자연스러운가?"** — 곡마다 **O / X** 로 답한다. 점수는 O 의 개수다.

### 판단에 넣는 것 (소리)

| 요소 | 보는 점 | 예 |
|---|---|---|
| 분위기·에너지 | 차분 ↔ 격렬, 어두움 ↔ 밝음 | 잔잔한 발라드 뒤에 격한 메탈이면 X |
| 템포 | 느림 ↔ 빠름 (정확한 BPM 아니라 체감) | 느린 곡 뒤 비슷하게 느린 곡이면 O 쪽 |
| 편성·음색 | 어쿠스틱(피아노·기타·현) ↔ 전자(신스·드럼머신), 밴드 ↔ 오케스트라 | 피아노 솔로 뒤 EDM 이면 X |
| 보컬 유형 | 가창 ↔ 랩 ↔ 기악(무보컬) ↔ 말 | 기악 뒤 랩이면 대체로 X |
| 음향 질감 | 라이브 소음, 로파이, 왜곡 | 스튜디오 팝 뒤 라이브 부틀렉 녹음이면 X 쪽 |

### 판단에 넣지 않는 것

- 같은 가수·같은 언어·같은 나라·같은 시대인지 — 지도는 소리만 본다. 한국 발라드 뒤에 영어 발라드가 와도 소리가 맞으면 **O**.
- 장르 이름표 — 멜론 장르가 달라도 소리가 맞으면 O, 같아도 소리가 다르면 X.
- 개인 취향·곡의 인지도·가사 내용.
- 거리 숫자 — 표의 거리는 참고용이다. 거리를 보고 판정을 맞추지 말 것.

### 결함 코드 (X 일 때, 해당하면 하나 이상)

| 코드 | 뜻 | 왜 따로 세나 |
|---|---|---|
| `dup` | 쿼리 또는 앞 순위 곡과 **같은 곡의 다른 판**(리마스터·라이브·다른 앨범) | 후처리 τ_dup 이 놓친 중복 → 규칙 재검토 재료 |
| `spoken` | 말·낭독·효과음 등 음악이 아님 | 카탈로그 정제 R2 가 놓친 비음악 |
| `mood` | 음악이지만 분위기·에너지가 정반대 | 좌표 자체의 오차 |
| `tempo` | 분위기는 비슷한데 템포가 크게 다름 | 특징 가중 관찰 |
| `meta` | 제목·아티스트가 비어 있거나 오염돼 곡을 특정할 수 없음 | 표시 필터 관찰 |
| `nf` | 검색으로 곡을 찾지 못함 → **판정 불가** (O/X 비움) | 점수 분모에서 뺀다 |

`dup` 은 X 이면서 결함이다. 같은 곡이 이어 나오면 흐름은 자연스럽지만 추천으로는 실패이므로 **X + dup** 으로 적는다.

## 2. 절차 (총 2.5~3시간, 두 번에 나눠서)

1. `output/qual_check.md` 를 연다. 쿼리 하나당 **후처리 top-10 표만** 본다. 접힌 '원본 top-10' 은 열지 않는다 (판정에 영향을 준다).
2. 쿼리 곡을 검색해 **40~60초** 듣는다. 도입부가 아니라 30초 지점부터.
3. 이웃 10곡을 순서대로 검색해 각 **20~30초** (30초 지점부터) 듣고 바로 O/X 를 적는다. 고민되면 X. 검색 상위 결과가 다른 곡(커버·리액션 영상)일 수 있으니 제목·아티스트를 확인한다.
4. X 에는 결함 코드를 붙인다. 못 찾으면 `nf` 만 적고 O/X 는 비운다.
5. 쿼리 하나 끝나면 한 줄 메모 — 이웃들의 공통 인상 (예: '전부 잔잔한 어쿠스틱, 장르는 섞임').
6. 20곡 끝나면 역방향 3쌍, 여정 2개 순서로 진행한다.
7. 기록은 **CSV 한 곳**에 한다: `output/qual_scores_template.csv` 를 복사해 `output/qual_scores.csv` 로 저장하고 `ok`(O/X) · `defect` · `note` 열만 채운다. 다른 열은 고치지 않는다. 엑셀에서 열어도 된다 (utf-8-sig).

**순서 편향 주의**: 쿼리 순서(Q1→Q20)를 바꾸지 말고, 하루에 10곡씩 나눠도 된다. 피곤하면 X 가 늘어나므로 한 번에 90분 이상 하지 않는다.

## 3. 점수 계산 (월요일 자동 집계, 손으로 안 함)

- 쿼리 점수 = O 개수 / (10 − nf 개수) × 10 → 0~10.
- 묶음(발라드·댄스…) 평균, 전체 평균, 결함 코드 빈도.
- 읽는 기준 (사전에 적어 둔다, 게이트 아님):
  - 전체 평균 **≥ 7**: 지도가 '이어 듣기'에 쓸 만함. **5~7**: 묶음별로 약한 곳 확인. **< 5**: 후처리 규칙 이전에 좌표 문제 의심.
  - `dup` 이 전체 이웃의 **≥ 5%** (10곡 이상) → τ_dup 재검토 후보. `spoken` ≥ 3곡 → R2 키워드 재검토 후보. `mood` 가 특정 묶음에 몰림 → 해당 노드 관찰.
  - 어느 경우에도 이 결과만으로 좌표·규칙을 바꾸지 않고, 월요일에 변경 여부를 결정한다.

## 4. 채점표 — 쿼리 20곡

각 표의 O/X 는 CSV 에도 같은 값으로 적는다 (CSV 가 집계 원본). 표는 눈으로 확인용.

### Q1 [발라드] 2AM — 전활 받지 않는 너에게 (You Wouldn't Answer My Calls)  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=2AM+%EC%A0%84%ED%99%9C+%EB%B0%9B%EC%A7%80+%EC%95%8A%EB%8A%94+%EB%84%88%EC%97%90%EA%B2%8C+%28You+Wouldn%27t+Answer+My+Calls%29)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Looking Back](https://www.youtube.com/results?search_query=Aksel+Looking+Back) | Aksel | 2.52 |  |  |  |
| 2 | [No Way Out](https://www.youtube.com/results?search_query=Jen+Wood+No+Way+Out) | Jen Wood | 2.61 |  |  |  |
| 3 | [Ventura (For Neal Casal)](https://www.youtube.com/results?search_query=Leeroy+Stagger+Ventura+%28For+Neal+Casal%29) | Leeroy Stagger | 2.67 |  |  |  |
| 4 | [Mein Gesicht](https://www.youtube.com/results?search_query=Various+Mein+Gesicht) | Various | 2.79 |  |  |  |
| 5 | [Complete](https://www.youtube.com/results?search_query=Blutengel+Complete) | Blutengel | 2.80 |  |  |  |
| 6 | [Strojvůdce](https://www.youtube.com/results?search_query=Chinaski+Strojv%C5%AFdce) | Chinaski | 2.83 |  |  |  |
| 7 | [Crazy Love](https://www.youtube.com/results?search_query=Mindy+Gledhill+Crazy+Love) | Mindy Gledhill | 2.83 |  |  |  |
| 8 | [Last Dance](https://www.youtube.com/results?search_query=Jamie-Lee+Last+Dance) | Jamie-Lee | 2.83 |  |  |  |
| 9 | [Quae Laetitia](https://www.youtube.com/results?search_query=Krypteria+Quae+Laetitia) | Krypteria | 2.94 |  |  |  |
| 10 | [Beatrice](https://www.youtube.com/results?search_query=Dizzy+Beatrice) | Dizzy | 2.95 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q2 [발라드] 2PM — 비가와  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=2PM+%EB%B9%84%EA%B0%80%EC%99%80)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [YOU MAY KNOW (1996 September Rec. DEMO)](https://www.youtube.com/results?search_query=DOUBLE+YOU+MAY+KNOW+%281996+September+Rec.+DEMO%29) | DOUBLE | 3.31 |  |  |  |
| 2 | [Grab the Moment (Norway)](https://www.youtube.com/results?search_query=JOWST+Grab+the+Moment+%28Norway%29) | JOWST | 3.33 |  |  |  |
| 3 | [Filmic](https://www.youtube.com/results?search_query=The+Wrong+Object+Filmic) | The Wrong Object | 3.40 |  |  |  |
| 4 | [This Is Not a Love Song](https://www.youtube.com/results?search_query=Omar+This+Is+Not+a+Love+Song) | Omar | 3.42 |  |  |  |
| 5 | [VALSA DAS ESTAÇÕES](https://www.youtube.com/results?search_query=Ayom+VALSA+DAS+ESTA%C3%87%C3%95ES) | Ayom | 3.48 |  |  |  |
| 6 | [When You Love Somebody](https://www.youtube.com/results?search_query=Craig+T.+Cooper+When+You+Love+Somebody) | Craig T. Cooper | 3.48 |  |  |  |
| 7 | [Rescue Mission](https://www.youtube.com/results?search_query=Jakub+Mi%C5%99ejovsk%C3%BD+Rescue+Mission) | Jakub Miřejovský | 3.49 |  |  |  |
| 8 | [André Rio&Roberto Menescal&Luciano Magno - Bye Bye, Brasil](https://www.youtube.com/results?search_query=Roberto+Menescal+Andr%C3%A9+Rio%26Roberto+Menescal%26Luciano+Magno+-+Bye+Bye%2C+Brasil) | Roberto Menescal | 3.54 |  |  |  |
| 9 | [Euro Cowboy](https://www.youtube.com/results?search_query=Special+EFX+Euro+Cowboy) | Special EFX | 3.55 |  |  |  |
| 10 | [Carnaval na Marim](https://www.youtube.com/results?search_query=Alceu+Valen%C3%A7a+Carnaval+na+Marim) | Alceu Valença | 3.57 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q3 [발라드] Se7en — Last of Diary  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=Se7en+Last+of+Diary)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [What a Siren is For](https://www.youtube.com/results?search_query=Stereochemistry+What+a+Siren+is+For) | Stereochemistry | 2.97 |  |  |  |
| 2 | [ÒòÎª](https://www.youtube.com/results?search_query=%C3%8B%C3%95%C2%BB%C3%9B%C3%82%C3%97+%C3%92%C3%B2%C3%8E%C2%AA) | ËÕ»ÛÂ× | 3.27 |  |  |  |
| 3 | [High Is More Fly](https://www.youtube.com/results?search_query=Hetouht+High+Is+More+Fly) | Hetouht | 3.35 |  |  |  |
| 4 | [Universal Frequencies (Beech Boys)](https://www.youtube.com/results?search_query=His+Name+Is+Alive+Universal+Frequencies+%28Beech+Boys%29) | His Name Is Alive | 3.70 |  |  |  |
| 5 | [Borderline (An Ode to Self Care)](https://www.youtube.com/results?search_query=Christelle+Bofale+Borderline+%28An+Ode+to+Self+Care%29) | Christelle Bofale | 3.75 |  |  |  |
| 6 | [Red Light](https://www.youtube.com/results?search_query=Ellis+Red+Light) | Ellis | 3.76 |  |  |  |
| 7 | [Don't Let Me Down](https://www.youtube.com/results?search_query=Adam+Levine+%26+Jesse+Carmichael+Don%27t+Let+Me+Down) | Adam Levine & Jesse Carmichael | 3.77 |  |  |  |
| 8 | [No Me Without You](https://www.youtube.com/results?search_query=Robbie+Seay+Band+No+Me+Without+You) | Robbie Seay Band | 3.92 |  |  |  |
| 9 | [Now and Then](https://www.youtube.com/results?search_query=The+Proclaimers+Now+and+Then) | The Proclaimers | 3.99 |  |  |  |
| 10 | [Light in Your Eyes](https://www.youtube.com/results?search_query=Voice+Male+Light+in+Your+Eyes) | Voice Male | 4.02 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q4 [댄스] WIN (Who Is Next) — Go Up (Team A)  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=WIN+%28Who+Is+Next%29+Go+Up+%28Team+A%29)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Someday Motel](https://www.youtube.com/results?search_query=nyankobrq+%26+%E8%BF%B7%E6%B5%B7%E6%9C%88+Someday+Motel) | nyankobrq & 迷海月 | 2.65 |  |  |  |
| 2 | [This Town Needs Fun](https://www.youtube.com/results?search_query=forests+This+Town+Needs+Fun) | forests | 2.82 |  |  |  |
| 3 | [Time Is The Space Between Us](https://www.youtube.com/results?search_query=Tim+Christensen+Time+Is+The+Space+Between+Us) | Tim Christensen | 2.84 |  |  |  |
| 4 | [Westside Angst](https://www.youtube.com/results?search_query=that+dog.+Westside+Angst) | that dog. | 2.95 |  |  |  |
| 5 | [Reset (16volt mix)](https://www.youtube.com/results?search_query=Left+Spine+Down+Reset+%2816volt+mix%29) | Left Spine Down | 3.04 |  |  |  |
| 6 | [So Much Is Lost (Lost in Space mix)](https://www.youtube.com/results?search_query=Paradise+Lost+So+Much+Is+Lost+%28Lost+in+Space+mix%29) | Paradise Lost | 3.05 |  |  |  |
| 7 | [Move It On Over](https://www.youtube.com/results?search_query=3+Hanks+Move+It+On+Over) | 3 Hanks | 3.05 |  |  |  |
| 8 | [MEGLADON](https://www.youtube.com/results?search_query=Trippie+Redd+MEGLADON) | Trippie Redd | 3.06 |  |  |  |
| 9 | [Basement Ghost Singing](https://www.youtube.com/results?search_query=Armor+for+Sleep+Basement+Ghost+Singing) | Armor for Sleep | 3.10 |  |  |  |
| 10 | [Lifejacket](https://www.youtube.com/results?search_query=Black+Knight+feat.+Json+%26+Shamaya+Lifejacket) | Black Knight feat. Json & Shamaya | 3.12 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q5 [댄스] B1A4 — Intro - Prologue  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=B1A4+Intro+-+Prologue)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Variations on La Danza (1951, from “A Hound for Trouble”)](https://www.youtube.com/results?search_query=Carl+Stalling+Variations+on+La+Danza+%281951%2C+from+%E2%80%9CA+Hound+for+Trouble%E2%80%9D%29) | Carl Stalling | 2.66 |  |  |  |
| 2 | [Sorry Again, Mate](https://www.youtube.com/results?search_query=Field+Music+Sorry+Again%2C+Mate) | Field Music | 2.75 |  |  |  |
| 3 | [Which Way?](https://www.youtube.com/results?search_query=Jerry+Goldsmith+Which+Way%3F) | Jerry Goldsmith | 2.77 |  |  |  |
| 4 | [Salt of the Sea](https://www.youtube.com/results?search_query=Wilfred+Burns+Salt+of+the+Sea) | Wilfred Burns | 2.81 |  |  |  |
| 5 | [Scolding Wife Reprise](https://www.youtube.com/results?search_query=Fiddler%27s+Green+Scolding+Wife+Reprise) | Fiddler's Green | 2.84 |  |  |  |
| 6 | [Song of Healing](https://www.youtube.com/results?search_query=Zelda+Reorchestrated+Song+of+Healing) | Zelda Reorchestrated | 2.85 |  |  |  |
| 7 | [涙の意味、願いの行方](https://www.youtube.com/results?search_query=%E4%BD%90%E9%87%8E%E5%BA%83%E6%98%8E+%E6%B6%99%E3%81%AE%E6%84%8F%E5%91%B3%E3%80%81%E9%A1%98%E3%81%84%E3%81%AE%E8%A1%8C%E6%96%B9) | 佐野広明 | 2.88 |  |  |  |
| 8 | [Under Fire](https://www.youtube.com/results?search_query=Angelo+Badalamenti+Under+Fire) | Angelo Badalamenti | 2.89 |  |  |  |
| 9 | [String Quartet 1](https://www.youtube.com/results?search_query=The+Chameleons+String+Quartet+1) | The Chameleons | 2.89 |  |  |  |
| 10 | [The Smallest Church in Sussex (Brass version)](https://www.youtube.com/results?search_query=British+Sea+Power+The+Smallest+Church+in+Sussex+%28Brass+version%29) | British Sea Power | 2.89 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q6 [댄스] PRODUCE 48 — NEKKOYA (PICK ME)  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=PRODUCE+48+NEKKOYA+%28PICK+ME%29)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Talking Hands](https://www.youtube.com/results?search_query=Domino+%26+Aki+Talking+Hands) | Domino & Aki | 3.64 |  |  |  |
| 2 | [Broken Empires (Chaos Vector Remix)](https://www.youtube.com/results?search_query=Hocico+Broken+Empires+%28Chaos+Vector+Remix%29) | Hocico | 3.86 |  |  |  |
| 3 | [불타오르네 (FIRE)](https://www.youtube.com/results?search_query=BTS+%EB%B6%88%ED%83%80%EC%98%A4%EB%A5%B4%EB%84%A4+%28FIRE%29) | BTS | 3.97 |  |  |  |
| 4 | [Animal (feat. Jean-Baptiste, Nyah) [Radio Edit]](https://www.youtube.com/results?search_query=DJ+Sammy+Animal+%28feat.+Jean-Baptiste%2C+Nyah%29+%5BRadio+Edit%5D) | DJ Sammy | 4.04 |  |  |  |
| 5 | [11. Iridium - Scarnoise](https://www.youtube.com/results?search_query=Various+Artists+11.+Iridium+-+Scarnoise) | Various Artists | 4.05 |  |  |  |
| 6 | [Scarnoise](https://www.youtube.com/results?search_query=Iridium+Scarnoise) | Iridium | 4.05 |  |  |  |
| 7 | [Together](https://www.youtube.com/results?search_query=Maor+Levi+Together) | Maor Levi | 4.09 |  |  |  |
| 8 | [Game Changers](https://www.youtube.com/results?search_query=TeddyLoid+with+%E4%B8%AD%E7%94%B0%E3%83%A4%E3%82%B9%E3%82%BF%E3%82%AB+Game+Changers) | TeddyLoid with 中田ヤスタカ | 4.19 |  |  |  |
| 9 | [The Spell](https://www.youtube.com/results?search_query=Volition+The+Spell) | Volition | 4.21 |  |  |  |
| 10 | [まぼろし☆まぼろし ft. Nanocat](https://www.youtube.com/results?search_query=%E3%82%B3%E3%82%A6%EF%BC%81+%E3%81%BE%E3%81%BB%E3%82%99%E3%82%8D%E3%81%97%E2%98%86%E3%81%BE%E3%81%BB%E3%82%99%E3%82%8D%E3%81%97+ft.+Nanocat) | コウ！ | 4.22 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q7 [락] King Krule — Baby Blue  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=King+Krule+Baby+Blue)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Don't Smoke in Bed](https://www.youtube.com/results?search_query=Jacintha+Don%27t+Smoke+in+Bed) | Jacintha | 2.37 |  |  |  |
| 2 | [Save Your Love for Me](https://www.youtube.com/results?search_query=Eliane+Elias+Save+Your+Love+for+Me) | Eliane Elias | 2.61 |  |  |  |
| 3 | [Chinatown](https://www.youtube.com/results?search_query=Shakey+Graves+Chinatown) | Shakey Graves | 2.63 |  |  |  |
| 4 | [Bostad](https://www.youtube.com/results?search_query=Olle+Vikstr%C3%B6m+Bostad) | Olle Vikström | 2.82 |  |  |  |
| 5 | [Quiet Side](https://www.youtube.com/results?search_query=Abram+Shook+Quiet+Side) | Abram Shook | 2.88 |  |  |  |
| 6 | [Wake Up in Paris](https://www.youtube.com/results?search_query=The+Hot+Sardines+Wake+Up+in+Paris) | The Hot Sardines | 2.94 |  |  |  |
| 7 | [Visitor](https://www.youtube.com/results?search_query=The+Bony+King+of+Nowhere+Visitor) | The Bony King of Nowhere | 2.97 |  |  |  |
| 8 | [Golden Phones](https://www.youtube.com/results?search_query=Thee+Oh+Sees+Golden+Phones) | Thee Oh Sees | 2.98 |  |  |  |
| 9 | [hand of fate: playback](https://www.youtube.com/results?search_query=%E9%B7%BA%E5%B7%A3%E8%A9%A9%E9%83%8E+hand+of+fate%3A+playback) | 鷺巣詩郎 | 3.03 |  |  |  |
| 10 | [Take Care of Us](https://www.youtube.com/results?search_query=Revelations+Take+Care+of+Us) | Revelations | 3.03 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q8 [락] Owl City — Silhouette  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=Owl+City+Silhouette)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Hyssop](https://www.youtube.com/results?search_query=Anna+Westin+Hyssop) | Anna Westin | 2.25 |  |  |  |
| 2 | [Fantastic Place](https://www.youtube.com/results?search_query=Marillion+Fantastic+Place) | Marillion | 2.30 |  |  |  |
| 3 | [The Last to Kow](https://www.youtube.com/results?search_query=Gary+Burton+The+Last+to+Kow) | Gary Burton | 2.36 |  |  |  |
| 4 | [Ci parliamo da grandi](https://www.youtube.com/results?search_query=Eros+Ramazzotti+Ci+parliamo+da+grandi) | Eros Ramazzotti | 2.36 |  |  |  |
| 5 | [Find Your Kindness](https://www.youtube.com/results?search_query=Rend+Collective+Experiment+Find+Your+Kindness) | Rend Collective Experiment | 2.37 |  |  |  |
| 6 | [Music Box Blues](https://www.youtube.com/results?search_query=Trans-Siberian+Orchestra+Music+Box+Blues) | Trans-Siberian Orchestra | 2.38 |  |  |  |
| 7 | [Looking Forward, Looking Back](https://www.youtube.com/results?search_query=Chandeen+Looking+Forward%2C+Looking+Back) | Chandeen | 2.39 |  |  |  |
| 8 | [That's What My Love Is For](https://www.youtube.com/results?search_query=Anne+Murray%2FAaron+Neville+That%27s+What+My+Love+Is+For) | Anne Murray/Aaron Neville | 2.39 |  |  |  |
| 9 | [Afscheid](https://www.youtube.com/results?search_query=Wim+Soutaer+Afscheid) | Wim Soutaer | 2.42 |  |  |  |
| 10 | [Birdie](https://www.youtube.com/results?search_query=Father+John+Misty+Birdie) | Father John Misty | 2.47 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q9 [힙합] Drake — Passionfruit  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=Drake+Passionfruit)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Color Her Sunshine](https://www.youtube.com/results?search_query=Ta-ku+Color+Her+Sunshine) | Ta-ku | 3.44 |  |  |  |
| 2 | [Solace](https://www.youtube.com/results?search_query=Eschaton+Solace) | Eschaton | 3.56 |  |  |  |
| 3 | [Eglantine](https://www.youtube.com/results?search_query=Miftah+Bravenda+Eglantine) | Miftah Bravenda | 3.72 |  |  |  |
| 4 | [Time Machine (feat Qi Yama)](https://www.youtube.com/results?search_query=Joji+Time+Machine+%28feat+Qi+Yama%29) | Joji | 3.75 |  |  |  |
| 5 | [Doin Forever](https://www.youtube.com/results?search_query=Haywyre+Doin+Forever) | Haywyre | 3.77 |  |  |  |
| 6 | [Deptford Bus](https://www.youtube.com/results?search_query=Silvestre+Deptford+Bus) | Silvestre | 3.78 |  |  |  |
| 7 | [Bouquet de Hoes](https://www.youtube.com/results?search_query=OG+Brax+Bouquet+de+Hoes) | OG Brax | 3.82 |  |  |  |
| 8 | [Paralleluniversen](https://www.youtube.com/results?search_query=Curse+Paralleluniversen) | Curse | 3.87 |  |  |  |
| 9 | [Yasminah (See Your Face Again)](https://www.youtube.com/results?search_query=Fred+again..+Yasminah+%28See+Your+Face+Again%29) | Fred again.. | 3.90 |  |  |  |
| 10 | [2](https://www.youtube.com/results?search_query=H.E.R.+2) | H.E.R. | 3.91 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q10 [힙합] Zion.T — Babay  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=Zion.T+Babay)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Animal](https://www.youtube.com/results?search_query=Alvaro+Soler+Animal) | Alvaro Soler | 2.32 |  |  |  |
| 2 | [Animal](https://www.youtube.com/results?search_query=Alvaro+Soler+Animal) | Alvaro Soler | 2.35 |  |  |  |
| 3 | [Skaczesz](https://www.youtube.com/results?search_query=Jacek+Lachowicz+Skaczesz) | Jacek Lachowicz | 2.78 |  |  |  |
| 4 | [Everything Is Going Fine feat. TiRon](https://www.youtube.com/results?search_query=Ayomari+Everything+Is+Going+Fine+feat.+TiRon) | Ayomari | 2.94 |  |  |  |
| 5 | [Antwerps testament](https://www.youtube.com/results?search_query=Tourist+LeMC+Antwerps+testament) | Tourist LeMC | 3.09 |  |  |  |
| 6 | [gec 2 Ü (remix)](https://www.youtube.com/results?search_query=100+gecs+feat.+Dorian+Electra+gec+2+%C3%9C+%28remix%29) | 100 gecs feat. Dorian Electra | 3.13 |  |  |  |
| 7 | [Happy Ending](https://www.youtube.com/results?search_query=Tech+N9ne+Happy+Ending) | Tech N9ne | 3.20 |  |  |  |
| 8 | [Mä en jaksa](https://www.youtube.com/results?search_query=Pyhimys+M%C3%A4+en+jaksa) | Pyhimys | 3.34 |  |  |  |
| 9 | [64](https://www.youtube.com/results?search_query=El+Capit%C3%A1n+feat.+DJ+Rusan+64) | El Capitán feat. DJ Rusan | 3.34 |  |  |  |
| 10 | [Vent Og Se](https://www.youtube.com/results?search_query=Ankerstjerne+feat.+Lille+Vent+Og+Se) | Ankerstjerne feat. Lille | 3.36 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q11 [R&B] DEAN — D (half moon)  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=DEAN+D+%28half+moon%29)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Wu Baby](https://www.youtube.com/results?search_query=IDER+Wu+Baby) | IDER | 2.91 |  |  |  |
| 2 | [Benefits From Mutual Relationships](https://www.youtube.com/results?search_query=Lord+Jah-Monte+Ogbon+Benefits+From+Mutual+Relationships) | Lord Jah-Monte Ogbon | 2.99 |  |  |  |
| 3 | [Dark Rider](https://www.youtube.com/results?search_query=NINA+Dark+Rider) | NINA | 3.00 |  |  |  |
| 4 | [Dear Life](https://www.youtube.com/results?search_query=Romina+Dear+Life) | Romina | 3.02 |  |  |  |
| 5 | [Pleasure](https://www.youtube.com/results?search_query=Montaigne+Pleasure) | Montaigne | 3.08 |  |  |  |
| 6 | [For a Better Day](https://www.youtube.com/results?search_query=Avicii+For+a+Better+Day) | Avicii | 3.24 |  |  |  |
| 7 | [This Is The Moment (feat. Steven Bradford)](https://www.youtube.com/results?search_query=9+Theory+This+Is+The+Moment+%28feat.+Steven+Bradford%29) | 9 Theory | 3.27 |  |  |  |
| 8 | [Rhythm & Light](https://www.youtube.com/results?search_query=The+Aggrolites+Rhythm+%26+Light) | The Aggrolites | 3.33 |  |  |  |
| 9 | [A.M.](https://www.youtube.com/results?search_query=A-bee+A.M.) | A-bee | 3.34 |  |  |  |
| 10 | [Premonitions](https://www.youtube.com/results?search_query=Miya+Folick+Premonitions) | Miya Folick | 3.37 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q12 [R&B] Chrisette Michele — Love Is You  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=Chrisette+Michele+Love+Is+You)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [June In January](https://www.youtube.com/results?search_query=Benny+Carter+June+In+January) | Benny Carter | 1.70 |  |  |  |
| 2 | [Tell Me More And More And Then](https://www.youtube.com/results?search_query=Billie+Holiday+Tell+Me+More+And+More+And+Then) | Billie Holiday | 1.83 |  |  |  |
| 3 | [Tell Me More](https://www.youtube.com/results?search_query=Billie+Holiday+Tell+Me+More) | Billie Holiday | 1.92 |  |  |  |
| 4 | [Tell Me More and More and Then Some](https://www.youtube.com/results?search_query=Billie+Holiday+and+Her+Orchestra+Tell+Me+More+and+More+and+Then+Some) | Billie Holiday and Her Orchestra | 1.94 |  |  |  |
| 5 | [Brother, Can You Spare A Dime](https://www.youtube.com/results?search_query=Sophia+Shorai+Brother%2C+Can+You+Spare+A+Dime) | Sophia Shorai | 2.19 |  |  |  |
| 6 | [Abdullah](https://www.youtube.com/results?search_query=Fats+Waller+Abdullah) | Fats Waller | 2.24 |  |  |  |
| 7 | [Danser Encore](https://www.youtube.com/results?search_query=Calogero+Danser+Encore) | Calogero | 2.34 |  |  |  |
| 8 | [Sa jeunesse](https://www.youtube.com/results?search_query=Nana+Mouskouri+Sa+jeunesse) | Nana Mouskouri | 2.35 |  |  |  |
| 9 | [Girl Friends](https://www.youtube.com/results?search_query=Sonny+Boy+Williamson+Girl+Friends) | Sonny Boy Williamson | 2.36 |  |  |  |
| 10 | [Oh, Darling](https://www.youtube.com/results?search_query=San+Fermin+Oh%2C+Darling) | San Fermin | 2.37 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q13 [재즈] Wouter Hamel — March, April, May  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=Wouter+Hamel+March%2C+April%2C+May)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Ain't Nothin' Wrong With Good Lovin'](https://www.youtube.com/results?search_query=The+O%27Jays+Ain%27t+Nothin%27+Wrong+With+Good+Lovin%27) | The O'Jays | 2.17 |  |  |  |
| 2 | [Santa Claus Is Coming to Town](https://www.youtube.com/results?search_query=Wynton+Marsalis+Santa+Claus+Is+Coming+to+Town) | Wynton Marsalis | 2.30 |  |  |  |
| 3 | [Liza (All The Clouds'll Roll Away)](https://www.youtube.com/results?search_query=Thelonious+Monk+Liza+%28All+The+Clouds%27ll+Roll+Away%29) | Thelonious Monk | 2.41 |  |  |  |
| 4 | [Liza (All The Clouds'll Roll Away) (from Show Girl)](https://www.youtube.com/results?search_query=George+Gershwin+Liza+%28All+The+Clouds%27ll+Roll+Away%29+%28from+Show+Girl%29) | George Gershwin | 2.41 |  |  |  |
| 5 | [No More Crying](https://www.youtube.com/results?search_query=Lloyd+Jones+No+More+Crying) | Lloyd Jones | 2.45 |  |  |  |
| 6 | [Should Have Come Home](https://www.youtube.com/results?search_query=Shemekia+Copeland+Should+Have+Come+Home) | Shemekia Copeland | 2.46 |  |  |  |
| 7 | [You Took Advantage of Me](https://www.youtube.com/results?search_query=Regina+Carter+You+Took+Advantage+of+Me) | Regina Carter | 2.47 |  |  |  |
| 8 | [More And More](https://www.youtube.com/results?search_query=Carly+Simon+More+And+More) | Carly Simon | 2.48 |  |  |  |
| 9 | [Stronger Than a Man](https://www.youtube.com/results?search_query=Bonnie+Tyler+Stronger+Than+a+Man) | Bonnie Tyler | 2.50 |  |  |  |
| 10 | [Make a Little Love to Me](https://www.youtube.com/results?search_query=Dionne+Warwick+Make+a+Little+Love+to+Me) | Dionne Warwick | 2.51 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q14 [재즈] Olivia Ong — You and Me  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=Olivia+Ong+You+and+Me)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Warning Bell](https://www.youtube.com/results?search_query=Joan+as+Police+Woman+Warning+Bell) | Joan as Police Woman | 2.80 |  |  |  |
| 2 | [Touch the Sky](https://www.youtube.com/results?search_query=JazzyBIT+Touch+the+Sky) | JazzyBIT | 2.95 |  |  |  |
| 3 | [Susumu's Blues](https://www.youtube.com/results?search_query=Brian+Bromberg+Susumu%27s+Blues) | Brian Bromberg | 3.20 |  |  |  |
| 4 | [Pity](https://www.youtube.com/results?search_query=Casiopea+%2B+Sync+DNA+Pity) | Casiopea + Sync DNA | 3.26 |  |  |  |
| 5 | [April's Fool](https://www.youtube.com/results?search_query=Kort+April%27s+Fool) | Kort | 3.46 |  |  |  |
| 6 | [Love of My Life](https://www.youtube.com/results?search_query=Nils+Landgren+Love+of+My+Life) | Nils Landgren | 3.49 |  |  |  |
| 7 | [Laniakea Waltz](https://www.youtube.com/results?search_query=Lalo+Schifrin+Laniakea+Waltz) | Lalo Schifrin | 3.56 |  |  |  |
| 8 | [Divine Whisper](https://www.youtube.com/results?search_query=David+Helpling+Divine+Whisper) | David Helpling | 3.57 |  |  |  |
| 9 | [Eu Entrego - Bonus Track](https://www.youtube.com/results?search_query=Ana+Moura+Eu+Entrego+-+Bonus+Track) | Ana Moura | 3.60 |  |  |  |
| 10 | [Sandino](https://www.youtube.com/results?search_query=Charlie+Haden+Sandino) | Charlie Haden | 3.61 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q15 [클래식] Joep Beving — Ab Ovo  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=Joep+Beving+Ab+Ovo)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Invitation](https://www.youtube.com/results?search_query=Wear+Your+Wounds+Invitation) | Wear Your Wounds | 2.24 |  |  |  |
| 2 | [Cripple Crow](https://www.youtube.com/results?search_query=Caleb+R.K.+Williams+Cripple+Crow) | Caleb R.K. Williams | 2.28 |  |  |  |
| 3 | [Anona](https://www.youtube.com/results?search_query=Otto+A.+Totland+Anona) | Otto A. Totland | 2.38 |  |  |  |
| 4 | [Katsura River](https://www.youtube.com/results?search_query=Lake+of+Madder+Katsura+River) | Lake of Madder | 2.42 |  |  |  |
| 5 | [ghost boy](https://www.youtube.com/results?search_query=Xu+ghost+boy) | Xu | 2.50 |  |  |  |
| 6 | [Reconcillation](https://www.youtube.com/results?search_query=Cliff+Eidelman+Reconcillation) | Cliff Eidelman | 2.53 |  |  |  |
| 7 | [Century Seasons](https://www.youtube.com/results?search_query=Jonn+Serrie+Century+Seasons) | Jonn Serrie | 2.55 |  |  |  |
| 8 | [I Never Wanted To Write These Words Down For You](https://www.youtube.com/results?search_query=MAINE+I+Never+Wanted+To+Write+These+Words+Down+For+You) | MAINE | 2.60 |  |  |  |
| 9 | [Midwayer](https://www.youtube.com/results?search_query=Joep+Beving+Midwayer) | Joep Beving | 2.67 |  |  |  |
| 10 | [Neon Dawn](https://www.youtube.com/results?search_query=Otto+A.+Totland+Neon+Dawn) | Otto A. Totland | 2.76 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q16 [클래식] Jackie Evancho — Someday at Christmas  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=Jackie+Evancho+Someday+at+Christmas)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [It Might As Well Be Spring](https://www.youtube.com/results?search_query=Johnny+Mathis+It+Might+As+Well+Be+Spring) | Johnny Mathis | 3.14 |  |  |  |
| 2 | [Loppulaulu](https://www.youtube.com/results?search_query=Tove+Jansson%2C+Mika+Pohjola%2C+Mirja+M%C3%A4kel%C3%A4+%26+Eeppi+Ursin+Loppulaulu) | Tove Jansson, Mika Pohjola, Mirja Mäkelä & Eeppi Ursin | 3.18 |  |  |  |
| 3 | [Nico's Dream](https://www.youtube.com/results?search_query=Amina+Figarova+Nico%27s+Dream) | Amina Figarova | 3.19 |  |  |  |
| 4 | [Maria](https://www.youtube.com/results?search_query=P.J.+Proby+Maria) | P.J. Proby | 3.24 |  |  |  |
| 5 | [Chosen (Feat․ Myuu & Elsie Lovelock)](https://www.youtube.com/results?search_query=The+Living+Tombstone+Chosen+%28Feat%E2%80%A4+Myuu+%26+Elsie+Lovelock%29) | The Living Tombstone | 3.28 |  |  |  |
| 6 | [Noël Blanc](https://www.youtube.com/results?search_query=Jacqueline+Fran%C3%A7ois+No%C3%ABl+Blanc) | Jacqueline François | 3.33 |  |  |  |
| 7 | [Cascade](https://www.youtube.com/results?search_query=Al+Di+Meola+Cascade) | Al Di Meola | 3.39 |  |  |  |
| 8 | [Triptych "Man, Penetration", Part 2: Night](https://www.youtube.com/results?search_query=The+Archestra+Triptych+%22Man%2C+Penetration%22%2C+Part+2%3A+Night) | The Archestra | 3.42 |  |  |  |
| 9 | [Motivos](https://www.youtube.com/results?search_query=Luis+Miguel+Motivos) | Luis Miguel | 3.46 |  |  |  |
| 10 | [Echoes Of Thought](https://www.youtube.com/results?search_query=Alex+Sipiagin+Echoes+Of+Thought) | Alex Sipiagin | 3.47 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q17 [OST] Nujabes — Aruarian Dance  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=Nujabes+Aruarian+Dance)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Lucky Sue](https://www.youtube.com/results?search_query=Men+I+Trust+Lucky+Sue) | Men I Trust | 3.52 |  |  |  |
| 2 | [Butter](https://www.youtube.com/results?search_query=Boney+James+Butter) | Boney James | 3.65 |  |  |  |
| 3 | [Young, Latin and Proud](https://www.youtube.com/results?search_query=Helado+Negro+Young%2C+Latin+and+Proud) | Helado Negro | 3.77 |  |  |  |
| 4 | [Bad vague](https://www.youtube.com/results?search_query=FLVKE+Bad+vague) | FLVKE | 3.78 |  |  |  |
| 5 | [Sumthin' Sumthin' (Mellosmoothe)](https://www.youtube.com/results?search_query=Maxwell+Sumthin%27+Sumthin%27+%28Mellosmoothe%29) | Maxwell | 3.79 |  |  |  |
| 6 | [Arctikal](https://www.youtube.com/results?search_query=Antarctica+Arctikal) | Antarctica | 3.80 |  |  |  |
| 7 | [Room 16-18](https://www.youtube.com/results?search_query=Rone+Room+16-18) | Rone | 3.81 |  |  |  |
| 8 | [Vica Pacheco - Crisantemo](https://www.youtube.com/results?search_query=FRUITS+Vica+Pacheco+-+Crisantemo) | FRUITS | 3.93 |  |  |  |
| 9 | [Everyone Else in the World](https://www.youtube.com/results?search_query=Stina+Nordenstam+Everyone+Else+in+the+World) | Stina Nordenstam | 3.96 |  |  |  |
| 10 | [Labyrinth](https://www.youtube.com/results?search_query=Direct+%26+Essenger+Labyrinth) | Direct & Essenger | 3.97 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q18 [한국 곡] CHEEZE — Madeleine Love  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=CHEEZE+Madeleine+Love)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Because He Lives](https://www.youtube.com/results?search_query=Harry+Connick%2C+Jr.+Because+He+Lives) | Harry Connick, Jr. | 2.40 |  |  |  |
| 2 | [Fortress Around Your Heart](https://www.youtube.com/results?search_query=The+Tierney+Sutton+Band+Fortress+Around+Your+Heart) | The Tierney Sutton Band | 2.57 |  |  |  |
| 3 | [Morning](https://www.youtube.com/results?search_query=Clare+Fischer+Morning) | Clare Fischer | 2.77 |  |  |  |
| 4 | [Kello kuusi](https://www.youtube.com/results?search_query=Eero+Koivistoinen+Kello+kuusi) | Eero Koivistoinen | 2.84 |  |  |  |
| 5 | [GUNPEI](https://www.youtube.com/results?search_query=SAKEROCK+GUNPEI) | SAKEROCK | 2.87 |  |  |  |
| 6 | [A Wink And A Smile](https://www.youtube.com/results?search_query=Various+Artists+A+Wink+And+A+Smile) | Various Artists | 2.93 |  |  |  |
| 7 | [Feel Like Making Love](https://www.youtube.com/results?search_query=Marlena+Shaw+Feel+Like+Making+Love) | Marlena Shaw | 2.94 |  |  |  |
| 8 | [Bullet](https://www.youtube.com/results?search_query=Angry+Son+Bullet) | Angry Son | 3.02 |  |  |  |
| 9 | [Is That So](https://www.youtube.com/results?search_query=Lee+Morgan+Is+That+So) | Lee Morgan | 3.02 |  |  |  |
| 10 | [Mat-Matt](https://www.youtube.com/results?search_query=Orrin+Evans+Mat-Matt) | Orrin Evans | 3.07 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q19 [한국 곡] 성시경 — 거리에서  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=%EC%84%B1%EC%8B%9C%EA%B2%BD+%EA%B1%B0%EB%A6%AC%EC%97%90%EC%84%9C)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [HAPPY BIRTHDAY～愛が生まれた～](https://www.youtube.com/results?search_query=%E7%8E%89%E7%BD%AE%E6%B5%A9%E4%BA%8C+HAPPY+BIRTHDAY%EF%BD%9E%E6%84%9B%E3%81%8C%E7%94%9F%E3%81%BE%E3%82%8C%E3%81%9F%EF%BD%9E) | 玉置浩二 | 1.74 |  |  |  |
| 2 | [Tecnicolor](https://www.youtube.com/results?search_query=Os+Mutantes+Tecnicolor) | Os Mutantes | 1.93 |  |  |  |
| 3 | [Ich habe diese Frau geliebt](https://www.youtube.com/results?search_query=Pete+%E2%80%9EWyoming%22+Bender+Ich+habe+diese+Frau+geliebt) | Pete „Wyoming" Bender | 2.01 |  |  |  |
| 4 | [Highland Harry](https://www.youtube.com/results?search_query=Rebecca+Wright+%26+Donald+McKay+Highland+Harry) | Rebecca Wright & Donald McKay | 2.11 |  |  |  |
| 5 | [Long Run](https://www.youtube.com/results?search_query=Jacob+Dinesen+Long+Run) | Jacob Dinesen | 2.14 |  |  |  |
| 6 | [Min bror](https://www.youtube.com/results?search_query=Magda+Andersson+%26+Helhj%C3%A4rtat+Min+bror) | Magda Andersson & Helhjärtat | 2.21 |  |  |  |
| 7 | [Dépressive](https://www.youtube.com/results?search_query=Jane+Birkin%3B+Serge+Gainsbourg+D%C3%A9pressive) | Jane Birkin; Serge Gainsbourg | 2.27 |  |  |  |
| 8 | [Himlen är oskyldigt blå](https://www.youtube.com/results?search_query=Jill+Johnson+Himlen+%C3%A4r+oskyldigt+bl%C3%A5) | Jill Johnson | 2.30 |  |  |  |
| 9 | [On a Christmas Night](https://www.youtube.com/results?search_query=Chris+de+Burgh+On+a+Christmas+Night) | Chris de Burgh | 2.32 |  |  |  |
| 10 | [Lose Your Way](https://www.youtube.com/results?search_query=Sophie+B.+Hawkins+Lose+Your+Way) | Sophie B. Hawkins | 2.34 |  |  |  |

쿼리 한 줄 인상: ______________________________

### Q20 [한국 곡] 태연 — Rain  ·  [쿼리 듣기](https://www.youtube.com/results?search_query=%ED%83%9C%EC%97%B0+Rain)

| # | 제목 | 아티스트 | 거리 | O/X | 결함 | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Where's The Reset Button](https://www.youtube.com/results?search_query=Sun+Devoured+Earth+Where%27s+The+Reset+Button) | Sun Devoured Earth | 2.74 |  |  |  |
| 2 | [Secret Sky](https://www.youtube.com/results?search_query=MICHI+Secret+Sky) | MICHI | 2.88 |  |  |  |
| 3 | [Wrong Policy Is True](https://www.youtube.com/results?search_query=Dyno+Luke+Wrong+Policy+Is+True) | Dyno Luke | 3.11 |  |  |  |
| 4 | [He's a Pretty Good Man If You Ask Me](https://www.youtube.com/results?search_query=Buffy+Sainte-Marie+He%27s+a+Pretty+Good+Man+If+You+Ask+Me) | Buffy Sainte-Marie | 3.17 |  |  |  |
| 5 | [XOXO](https://www.youtube.com/results?search_query=%EC%9E%90%EC%9A%B0%EB%A6%BC+XOXO) | 자우림 | 3.25 |  |  |  |
| 6 | [If It Wasn't for the Heartache](https://www.youtube.com/results?search_query=Jill+Holler+If+It+Wasn%27t+for+the+Heartache) | Jill Holler | 3.33 |  |  |  |
| 7 | [Jeannie's Waltz](https://www.youtube.com/results?search_query=Joe+Castro+Jeannie%27s+Waltz) | Joe Castro | 3.35 |  |  |  |
| 8 | [Muleta](https://www.youtube.com/results?search_query=Francisca+Valenzuela+Muleta) | Francisca Valenzuela | 3.40 |  |  |  |
| 9 | [Si tu t'appelles mélancolie](https://www.youtube.com/results?search_query=Joe+Dassin+Si+tu+t%27appelles+m%C3%A9lancolie) | Joe Dassin | 3.42 |  |  |  |
| 10 | [She Should Have Been Home](https://www.youtube.com/results?search_query=Edwin+Starr+She+Should+Have+Been+Home) | Edwin Starr | 3.47 |  |  |  |

쿼리 한 줄 인상: ______________________________

## 5. 채점표 — 역방향 3쌍 (플레이리스트에서는 함께 나오는데 지도에서는 멀다)

두 곡을 각각 30초씩 듣고 셋 중 하나를 고른다.
- **A. 소리가 다르다** → 지도가 맞다 (플레이리스트 동반은 취향·맥락 때문). CSV `ok`=A
- **B. 소리가 비슷하다** → 지도가 갈라놓았다 (지도 결함 후보). CSV `ok`=B
- **C. 판단 불가** (못 찾음·애매). CSV `ok`=C

| # | 곡 A | 곡 B | 거리 | 판정 A/B/C | 이유 한 줄 |
|---|---|---|---|---|---|
| R1 | [CHEEZE — Madeleine Love](https://www.youtube.com/results?search_query=CHEEZE+Madeleine+Love) | [Red Velvet — 빨간 맛 (Red Flavor)](https://www.youtube.com/results?search_query=Red+Velvet+%EB%B9%A8%EA%B0%84+%EB%A7%9B+%28Red+Flavor%29) | 14.81 |  |  |
| R2 | [성시경 — 거리에서](https://www.youtube.com/results?search_query=%EC%84%B1%EC%8B%9C%EA%B2%BD+%EA%B1%B0%EB%A6%AC%EC%97%90%EC%84%9C) | [씨스타 — Shake It](https://www.youtube.com/results?search_query=%EC%94%A8%EC%8A%A4%ED%83%80+Shake+It) | 14.08 |  |  |
| R3 | [Mike Perry — The Ocean](https://www.youtube.com/results?search_query=Mike+Perry+The+Ocean) | [Lauv — Paris in the Rain](https://www.youtube.com/results?search_query=Lauv+Paris+in+the+Rain) | 16.93 |  |  |

## 6. 채점표 — 여정 2개 (출발곡 → 역 1 … 역 10 → 도착곡)

순서대로 듣고, **앞 곡에서 이 곡으로 넘어가는 것이 자연스러운가**를 O/X 로 적는다 (여기서 비교 대상은 쿼리가 아니라 **바로 앞 곡**). 도착곡 행은 역 10 → 도착곡의 이어짐이다.

같은 출발·도착을 세 방식으로 만든 판이 이어진다 — 직선 보간(J1·J2), kNN 그래프 위 A* 최단 경로(A\*), 층별 DP(진행도 층 10개 + 이웃 간선 제약 + 걸음² 최소화). 각 판을 **따로** 채점하고 (어느 방식인지 의식하지 말 것), 끝에 어느 판이 더 자연스러웠는지만 한 줄 적는다.

### J1 발라드 → 댄스 · 출발: [2AM — 전활 받지 않는 너에게 (You Wouldn't Answer My Calls)](https://www.youtube.com/results?search_query=2AM+%EC%A0%84%ED%99%9C+%EB%B0%9B%EC%A7%80+%EC%95%8A%EB%8A%94+%EB%84%88%EC%97%90%EA%B2%8C+%28You+Wouldn%27t+Answer+My+Calls%29)

| 역 | 제목 | 아티스트 | 노드 | 앞 곡과 거리 | 이어짐 O/X | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Looking Back](https://www.youtube.com/results?search_query=Aksel+Looking+Back) | Aksel | `root.0.1` | 2.52 |  |  |
| 2 | [Worth It](https://www.youtube.com/results?search_query=Emma+Bale+Worth+It) | Emma Bale | `root.0.1` | 3.32 |  |  |
| 3 | [Fair Play](https://www.youtube.com/results?search_query=Konni+Kass+Fair+Play) | Konni Kass | `root.2.0` | 2.00 |  |  |
| 4 | [Green Eyes](https://www.youtube.com/results?search_query=Joseph+Green+Eyes) | Joseph | `root.0.1` | 3.13 |  |  |
| 5 | [Cinema of Soul](https://www.youtube.com/results?search_query=Wintry+Cinema+of+Soul) | Wintry | `root.2.0` | 3.98 |  |  |
| 6 | [I Won't Break](https://www.youtube.com/results?search_query=Julia+Samoylova+I+Won%27t+Break) | Julia Samoylova | `root.2.1` | 3.63 |  |  |
| 7 | [Disappear Here](https://www.youtube.com/results?search_query=Bad+Suns+Disappear+Here) | Bad Suns | `root.2.1` | 2.94 |  |  |
| 8 | [Hey](https://www.youtube.com/results?search_query=Eatliz+Hey) | Eatliz | `root.2.0` | 3.80 |  |  |
| 9 | [So Much Is Lost (Lost in Space mix)](https://www.youtube.com/results?search_query=Paradise+Lost+So+Much+Is+Lost+%28Lost+in+Space+mix%29) | Paradise Lost | `root.2.0` | 3.61 |  |  |
| 10 | [Time Is The Space Between Us](https://www.youtube.com/results?search_query=Tim+Christensen+Time+Is+The+Space+Between+Us) | Tim Christensen | `root.2.0` | 3.73 |  |  |
| 도착 | [Go Up (Team A)](https://www.youtube.com/results?search_query=WIN+%28Who+Is+Next%29+Go+Up+%28Team+A%29) | WIN (Who Is Next) | `root.2.0` | 2.84 |  |  |

끊긴 역 번호: ______ · 노드가 바뀌는 지점과 일치하는가 (예/아니오/모름): ______

### J2 한국 곡 → 해외 곡(힙합) · 출발: [CHEEZE — Madeleine Love](https://www.youtube.com/results?search_query=CHEEZE+Madeleine+Love)

| 역 | 제목 | 아티스트 | 노드 | 앞 곡과 거리 | 이어짐 O/X | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Because He Lives](https://www.youtube.com/results?search_query=Harry+Connick%2C+Jr.+Because+He+Lives) | Harry Connick, Jr. | `root.1.1` | 2.40 |  |  |
| 2 | [Senza Tempo](https://www.youtube.com/results?search_query=Maria+Devigili+Senza+Tempo) | Maria Devigili | `root.1.3` | 3.49 |  |  |
| 3 | [Low](https://www.youtube.com/results?search_query=Nellybombs+Low) | Nellybombs | `root.1.3` | 4.54 |  |  |
| 4 | [Jupiter Sunrise](https://www.youtube.com/results?search_query=MH+the+Verb+%28with+ArtHouse95%29+Jupiter+Sunrise) | MH the Verb (with ArtHouse95) | `root.1.3` | 3.87 |  |  |
| 5 | [Où Vont Tous Ces Pauvres Types ? [Louis De Funeste Remix]](https://www.youtube.com/results?search_query=Photo+Rat%C3%A9e+O%C3%B9+Vont+Tous+Ces+Pauvres+Types+%3F+%5BLouis+De+Funeste+Remix%5D) | Photo Ratée | `root.1.3` | 4.94 |  |  |
| 6 | [Airshine](https://www.youtube.com/results?search_query=Retic+Airshine) | Retic | `root.1.3` | 4.67 |  |  |
| 7 | [Detached](https://www.youtube.com/results?search_query=Wanda+%26+Nova+deViator+Detached) | Wanda & Nova deViator | `root.1.3` | 2.83 |  |  |
| 8 | [get happy](https://www.youtube.com/results?search_query=Serge+Geyzel+get+happy) | Serge Geyzel | `root.1.3` | 4.17 |  |  |
| 9 | [С чистого листа (Асталависта)](https://www.youtube.com/results?search_query=Estradarada+%D0%A1+%D1%87%D0%B8%D1%81%D1%82%D0%BE%D0%B3%D0%BE+%D0%BB%D0%B8%D1%81%D1%82%D0%B0+%28%D0%90%D1%81%D1%82%D0%B0%D0%BB%D0%B0%D0%B2%D0%B8%D1%81%D1%82%D0%B0%29) | Estradarada | `root.1.3` | 4.52 |  |  |
| 10 | [Time Machine (feat Qi Yama)](https://www.youtube.com/results?search_query=Joji+Time+Machine+%28feat+Qi+Yama%29) | Joji | `root.1.3` | 4.00 |  |  |
| 도착 | [Passionfruit](https://www.youtube.com/results?search_query=Drake+Passionfruit) | Drake | `root.1.3` | 3.75 |  |  |

끊긴 역 번호: ______ · 노드가 바뀌는 지점과 일치하는가 (예/아니오/모름): ______

### J3 발라드 → 댄스 (A*) · 출발: [2AM — 전활 받지 않는 너에게 (You Wouldn't Answer My Calls)](https://www.youtube.com/results?search_query=2AM+%EC%A0%84%ED%99%9C+%EB%B0%9B%EC%A7%80+%EC%95%8A%EB%8A%94+%EB%84%88%EC%97%90%EA%B2%8C+%28You+Wouldn%27t+Answer+My+Calls%29)

| 역 | 제목 | 아티스트 | 노드 | 앞 곡과 거리 | 이어짐 O/X | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Same Blood (feat. Joe L Barnes, Koryn Hawthorne & Mav City Gospel Choir)](https://www.youtube.com/results?search_query=Maverick+City+Music+feat.+Joe+L+Barnes+%26+Koryn+Hawthorne+Same+Blood+%28feat.+Joe+L+Barnes%2C+Koryn+Hawthorne+%26+Mav+City+Gospel+Choir%29) | Maverick City Music feat. Joe L Barnes & Koryn Hawthorne | `root.0.1` | 3.10 |  |  |
| 2 | [Casper](https://www.youtube.com/results?search_query=Bent+Knee+Casper) | Bent Knee | `root.2.0` | 2.95 |  |  |
| 3 | [Lebe deinen Hass](https://www.youtube.com/results?search_query=Ruffiction+%26+Swiss+%26+Die+Andern+Lebe+deinen+Hass) | Ruffiction & Swiss & Die Andern | `root.2.1` | 2.92 |  |  |
| 4 | [Bin auf dem Weg](https://www.youtube.com/results?search_query=Anni+Perka+Bin+auf+dem+Weg) | Anni Perka | `root.2.1` | 2.88 |  |  |
| 5 | [Lifejacket](https://www.youtube.com/results?search_query=Black+Knight+feat.+Json+%26+Shamaya+Lifejacket) | Black Knight feat. Json & Shamaya | `root.2.1` | 2.77 |  |  |
| 도착 | [Go Up (Team A)](https://www.youtube.com/results?search_query=WIN+%28Who+Is+Next%29+Go+Up+%28Team+A%29) | WIN (Who Is Next) | `root.2.0` | 3.12 |  |  |

끊긴 역 번호: ______ · 노드가 바뀌는 지점과 일치하는가 (예/아니오/모름): ______

### J4 한국 곡 → 해외 곡(힙합) (A*) · 출발: [CHEEZE — Madeleine Love](https://www.youtube.com/results?search_query=CHEEZE+Madeleine+Love)

| 역 | 제목 | 아티스트 | 노드 | 앞 곡과 거리 | 이어짐 O/X | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Mat-Matt](https://www.youtube.com/results?search_query=Orrin+Evans+Mat-Matt) | Orrin Evans | `root.1.1` | 3.07 |  |  |
| 2 | [Flat Earth Syndrome](https://www.youtube.com/results?search_query=Troy+Kingi+Flat+Earth+Syndrome) | Troy Kingi | `root.1.3` | 3.17 |  |  |
| 3 | [Low](https://www.youtube.com/results?search_query=Nellybombs+Low) | Nellybombs | `root.1.3` | 3.05 |  |  |
| 4 | [Info Trip (clean)](https://www.youtube.com/results?search_query=Bambu+Info+Trip+%28clean%29) | Bambu | `root.1.3` | 3.12 |  |  |
| 5 | [Allergic To Public Displays Of Affection](https://www.youtube.com/results?search_query=Chee+Allergic+To+Public+Displays+Of+Affection) | Chee | `root.1.3` | 2.92 |  |  |
| 6 | [get happy](https://www.youtube.com/results?search_query=Serge+Geyzel+get+happy) | Serge Geyzel | `root.1.3` | 3.48 |  |  |
| 7 | [2](https://www.youtube.com/results?search_query=H.E.R.+2) | H.E.R. | `root.1.3` | 3.60 |  |  |
| 도착 | [Passionfruit](https://www.youtube.com/results?search_query=Drake+Passionfruit) | Drake | `root.1.3` | 3.91 |  |  |

끊긴 역 번호: ______ · 노드가 바뀌는 지점과 일치하는가 (예/아니오/모름): ______

### J5 발라드 → 댄스 (층별 DP) · 출발: [2AM — 전활 받지 않는 너에게 (You Wouldn't Answer My Calls)](https://www.youtube.com/results?search_query=2AM+%EC%A0%84%ED%99%9C+%EB%B0%9B%EC%A7%80+%EC%95%8A%EB%8A%94+%EB%84%88%EC%97%90%EA%B2%8C+%28You+Wouldn%27t+Answer+My+Calls%29)

| 역 | 제목 | 아티스트 | 노드 | 앞 곡과 거리 | 이어짐 O/X | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Feraghi: Song of Exile (acoustic)](https://www.youtube.com/results?search_query=Niyaz+Feraghi%3A+Song+of+Exile+%28acoustic%29) | Niyaz | `root.0.1` | 3.10 |  |  |
| 2 | [Just a Little Bit](https://www.youtube.com/results?search_query=Eddie+Taylor+Jr.+Just+a+Little+Bit) | Eddie Taylor Jr. | `root.0.1` | 2.28 |  |  |
| 3 | [Weight of My Mistakes feat. Thiago Millores (Seal)](https://www.youtube.com/results?search_query=Fleesh+Weight+of+My+Mistakes+feat.+Thiago+Millores+%28Seal%29) | Fleesh | `root.2.0` | 2.47 |  |  |
| 4 | [Who Needs Air](https://www.youtube.com/results?search_query=The+Classic+Crime+Who+Needs+Air) | The Classic Crime | `root.2.0` | 2.29 |  |  |
| 5 | [Hey Brother](https://www.youtube.com/results?search_query=Beulah+Hey+Brother) | Beulah | `root.2.0` | 2.06 |  |  |
| 6 | [Platoon - Hardships of War](https://www.youtube.com/results?search_query=Kristian+Svensson+Platoon+-+Hardships+of+War) | Kristian Svensson | `root.2.0` | 1.99 |  |  |
| 7 | [Edwardian Romance](https://www.youtube.com/results?search_query=Moon+Wiring+Club+Edwardian+Romance) | Moon Wiring Club | `root.2.0` | 1.98 |  |  |
| 8 | [Kaleidoscope](https://www.youtube.com/results?search_query=Hurts+Kaleidoscope) | Hurts | `root.2.0` | 2.41 |  |  |
| 9 | [Gib mir mehr](https://www.youtube.com/results?search_query=Cassandra+Steen+Gib+mir+mehr) | Cassandra Steen | `root.2.0` | 2.27 |  |  |
| 10 | [Time Is The Space Between Us](https://www.youtube.com/results?search_query=Tim+Christensen+Time+Is+The+Space+Between+Us) | Tim Christensen | `root.2.0` | 2.30 |  |  |
| 도착 | [Go Up (Team A)](https://www.youtube.com/results?search_query=WIN+%28Who+Is+Next%29+Go+Up+%28Team+A%29) | WIN (Who Is Next) | `root.2.0` | 2.84 |  |  |

끊긴 역 번호: ______ · 노드가 바뀌는 지점과 일치하는가 (예/아니오/모름): ______

### J6 한국 곡 → 해외 곡(힙합) (층별 DP) · 출발: [CHEEZE — Madeleine Love](https://www.youtube.com/results?search_query=CHEEZE+Madeleine+Love)

| 역 | 제목 | 아티스트 | 노드 | 앞 곡과 거리 | 이어짐 O/X | 메모 |
|---|---|---|---|---|---|---|
| 1 | [A Wink And A Smile](https://www.youtube.com/results?search_query=Various+Artists+A+Wink+And+A+Smile) | Various Artists | `root.1.1` | 2.93 |  |  |
| 2 | [Spares of the World](https://www.youtube.com/results?search_query=Matana+Roberts+Spares+of+the+World) | Matana Roberts | `root.1.3` | 3.01 |  |  |
| 3 | [Like Young](https://www.youtube.com/results?search_query=Illinois+Jacquet+Like+Young) | Illinois Jacquet | `root.1.3` | 3.26 |  |  |
| 4 | [The Way Home](https://www.youtube.com/results?search_query=Makaya+McCraven+The+Way+Home) | Makaya McCraven | `root.1.3` | 3.24 |  |  |
| 5 | [Machine](https://www.youtube.com/results?search_query=Hundreds+Machine) | Hundreds | `root.1.3` | 3.12 |  |  |
| 6 | [Overnight Sensation](https://www.youtube.com/results?search_query=Henry+Jackman+Overnight+Sensation) | Henry Jackman | `root.1.3` | 2.35 |  |  |
| 7 | [Lilith](https://www.youtube.com/results?search_query=Plaid+feat.+Bj%C3%B6rk+Lilith) | Plaid feat. Björk | `root.1.3` | 2.63 |  |  |
| 8 | [Down](https://www.youtube.com/results?search_query=DDRKirby%28ISQ%29+Down) | DDRKirby(ISQ) | `root.1.3` | 2.60 |  |  |
| 9 | [GåApaGå](https://www.youtube.com/results?search_query=Oskar+Linnros+G%C3%A5ApaG%C3%A5) | Oskar Linnros | `root.1.3` | 2.99 |  |  |
| 10 | [Time Machine (feat Qi Yama)](https://www.youtube.com/results?search_query=Joji+Time+Machine+%28feat+Qi+Yama%29) | Joji | `root.1.3` | 2.59 |  |  |
| 도착 | [Passionfruit](https://www.youtube.com/results?search_query=Drake+Passionfruit) | Drake | `root.1.3` | 3.75 |  |  |

끊긴 역 번호: ______ · 노드가 바뀌는 지점과 일치하는가 (예/아니오/모름): ______

### J7 발라드 → 댄스 (층별 DP+축 λ=1) · 출발: [2AM — 전활 받지 않는 너에게 (You Wouldn't Answer My Calls)](https://www.youtube.com/results?search_query=2AM+%EC%A0%84%ED%99%9C+%EB%B0%9B%EC%A7%80+%EC%95%8A%EB%8A%94+%EB%84%88%EC%97%90%EA%B2%8C+%28You+Wouldn%27t+Answer+My+Calls%29)

| 역 | 제목 | 아티스트 | 노드 | 앞 곡과 거리 | 이어짐 O/X | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Looking Back](https://www.youtube.com/results?search_query=Aksel+Looking+Back) | Aksel | `root.0.1` | 2.52 |  |  |
| 2 | [Complete](https://www.youtube.com/results?search_query=Blutengel+Complete) | Blutengel | `root.0.1` | 2.86 |  |  |
| 3 | [Worth It](https://www.youtube.com/results?search_query=Emma+Bale+Worth+It) | Emma Bale | `root.0.1` | 2.54 |  |  |
| 4 | [Fair Play](https://www.youtube.com/results?search_query=Konni+Kass+Fair+Play) | Konni Kass | `root.2.0` | 2.00 |  |  |
| 5 | [Skealbma](https://www.youtube.com/results?search_query=Mari+Boine+Skealbma) | Mari Boine | `root.2.1` | 2.39 |  |  |
| 6 | [凍てつく焔](https://www.youtube.com/results?search_query=Asriel+%E5%87%8D%E3%81%A6%E3%81%A4%E3%81%8F%E7%84%94) | Asriel | `root.2.1` | 2.46 |  |  |
| 7 | [How We Do It](https://www.youtube.com/results?search_query=Canon+feat.+Thi%27sl+%26+Lecrae+How+We+Do+It) | Canon feat. Thi'sl & Lecrae | `root.2.1` | 2.79 |  |  |
| 8 | [Dream](https://www.youtube.com/results?search_query=Vanessa+Amorosi+Dream) | Vanessa Amorosi | `root.2.1` | 2.48 |  |  |
| 9 | [I Hate Everything About You (Acoustic Version)](https://www.youtube.com/results?search_query=Three+Days+Grace+I+Hate+Everything+About+You+%28Acoustic+Version%29) | Three Days Grace | `root.2.0` | 2.82 |  |  |
| 10 | [Time Is The Space Between Us](https://www.youtube.com/results?search_query=Tim+Christensen+Time+Is+The+Space+Between+Us) | Tim Christensen | `root.2.0` | 2.81 |  |  |
| 도착 | [Go Up (Team A)](https://www.youtube.com/results?search_query=WIN+%28Who+Is+Next%29+Go+Up+%28Team+A%29) | WIN (Who Is Next) | `root.2.0` | 2.84 |  |  |

끊긴 역 번호: ______ · 노드가 바뀌는 지점과 일치하는가 (예/아니오/모름): ______

### J8 한국 곡 → 해외 곡(힙합) (층별 DP+축 λ=1) · 출발: [CHEEZE — Madeleine Love](https://www.youtube.com/results?search_query=CHEEZE+Madeleine+Love)

| 역 | 제목 | 아티스트 | 노드 | 앞 곡과 거리 | 이어짐 O/X | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Mat-Matt](https://www.youtube.com/results?search_query=Orrin+Evans+Mat-Matt) | Orrin Evans | `root.1.1` | 3.07 |  |  |
| 2 | [Noël Jazz](https://www.youtube.com/results?search_query=Lina+Boudreau+No%C3%ABl+Jazz) | Lina Boudreau | `root.1.3` | 2.76 |  |  |
| 3 | [Flat Earth Syndrome](https://www.youtube.com/results?search_query=Troy+Kingi+Flat+Earth+Syndrome) | Troy Kingi | `root.1.3` | 3.04 |  |  |
| 4 | [Low](https://www.youtube.com/results?search_query=Nellybombs+Low) | Nellybombs | `root.1.3` | 3.05 |  |  |
| 5 | [Info Trip (clean)](https://www.youtube.com/results?search_query=Bambu+Info+Trip+%28clean%29) | Bambu | `root.1.3` | 3.12 |  |  |
| 6 | [Distress Call](https://www.youtube.com/results?search_query=Below+Bangkok+Distress+Call) | Below Bangkok | `root.1.3` | 2.91 |  |  |
| 7 | [Late at Night (feat. Aisjah)](https://www.youtube.com/results?search_query=Simon+Says+Late+at+Night+%28feat.+Aisjah%29) | Simon Says | `root.1.3` | 2.55 |  |  |
| 8 | [I Want You Around](https://www.youtube.com/results?search_query=Snoh+Aalegra+I+Want+You+Around) | Snoh Aalegra | `root.1.3` | 3.71 |  |  |
| 9 | [Western Sky](https://www.youtube.com/results?search_query=Agency-X+Western+Sky) | Agency-X | `root.1.3` | 3.21 |  |  |
| 10 | [Solace](https://www.youtube.com/results?search_query=Eschaton+Solace) | Eschaton | `root.1.3` | 3.32 |  |  |
| 도착 | [Passionfruit](https://www.youtube.com/results?search_query=Drake+Passionfruit) | Drake | `root.1.3` | 3.56 |  |  |

끊긴 역 번호: ______ · 노드가 바뀌는 지점과 일치하는가 (예/아니오/모름): ______

### J9 발라드 → 댄스 (곡률 DP) · 출발: [2AM — 전활 받지 않는 너에게 (You Wouldn't Answer My Calls)](https://www.youtube.com/results?search_query=2AM+%EC%A0%84%ED%99%9C+%EB%B0%9B%EC%A7%80+%EC%95%8A%EB%8A%94+%EB%84%88%EC%97%90%EA%B2%8C+%28You+Wouldn%27t+Answer+My+Calls%29)

| 역 | 제목 | 아티스트 | 노드 | 앞 곡과 거리 | 이어짐 O/X | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Run Rudolph Run](https://www.youtube.com/results?search_query=Harry+Gregson%E2%80%90Williams+%26+Stephanie+Economou+Run+Rudolph+Run) | Harry Gregson‐Williams & Stephanie Economou | `root.0.1` | 3.13 |  |  |
| 2 | [Wherever You Will Go](https://www.youtube.com/results?search_query=The+Calling+Wherever+You+Will+Go) | The Calling | `root.0.1` | 2.19 |  |  |
| 3 | [Basket Case](https://www.youtube.com/results?search_query=Bastille+Basket+Case) | Bastille | `root.0.1` | 2.05 |  |  |
| 4 | [Wwiii](https://www.youtube.com/results?search_query=Rufus+Wainwright+Wwiii) | Rufus Wainwright | `root.0.1` | 2.39 |  |  |
| 5 | [Hey Brother](https://www.youtube.com/results?search_query=Beulah+Hey+Brother) | Beulah | `root.2.0` | 2.71 |  |  |
| 6 | [Platoon - Hardships of War](https://www.youtube.com/results?search_query=Kristian+Svensson+Platoon+-+Hardships+of+War) | Kristian Svensson | `root.2.0` | 1.99 |  |  |
| 7 | [Edwardian Romance](https://www.youtube.com/results?search_query=Moon+Wiring+Club+Edwardian+Romance) | Moon Wiring Club | `root.2.0` | 1.98 |  |  |
| 8 | [Kaleidoscope](https://www.youtube.com/results?search_query=Hurts+Kaleidoscope) | Hurts | `root.2.0` | 2.41 |  |  |
| 9 | [Gib mir mehr](https://www.youtube.com/results?search_query=Cassandra+Steen+Gib+mir+mehr) | Cassandra Steen | `root.2.0` | 2.27 |  |  |
| 10 | [Time Is The Space Between Us](https://www.youtube.com/results?search_query=Tim+Christensen+Time+Is+The+Space+Between+Us) | Tim Christensen | `root.2.0` | 2.30 |  |  |
| 도착 | [Go Up (Team A)](https://www.youtube.com/results?search_query=WIN+%28Who+Is+Next%29+Go+Up+%28Team+A%29) | WIN (Who Is Next) | `root.2.0` | 2.84 |  |  |

끊긴 역 번호: ______ · 노드가 바뀌는 지점과 일치하는가 (예/아니오/모름): ______

### J10 발라드 → 댄스 (축 우선 DP (≤τ_far, λ=2)) · 출발: [2AM — 전활 받지 않는 너에게 (You Wouldn't Answer My Calls)](https://www.youtube.com/results?search_query=2AM+%EC%A0%84%ED%99%9C+%EB%B0%9B%EC%A7%80+%EC%95%8A%EB%8A%94+%EB%84%88%EC%97%90%EA%B2%8C+%28You+Wouldn%27t+Answer+My+Calls%29)

| 역 | 제목 | 아티스트 | 노드 | 앞 곡과 거리 | 이어짐 O/X | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Looking Back](https://www.youtube.com/results?search_query=Aksel+Looking+Back) | Aksel | `root.0.1` | 2.52 |  |  |
| 2 | [Complete](https://www.youtube.com/results?search_query=Blutengel+Complete) | Blutengel | `root.0.1` | 2.86 |  |  |
| 3 | [Worth It](https://www.youtube.com/results?search_query=Emma+Bale+Worth+It) | Emma Bale | `root.0.1` | 2.54 |  |  |
| 4 | [Fair Play](https://www.youtube.com/results?search_query=Konni+Kass+Fair+Play) | Konni Kass | `root.2.0` | 2.00 |  |  |
| 5 | [All Black](https://www.youtube.com/results?search_query=Good+Charlotte+All+Black) | Good Charlotte | `root.2.1` | 2.71 |  |  |
| 6 | [I Won't Break](https://www.youtube.com/results?search_query=Julia+Samoylova+I+Won%27t+Break) | Julia Samoylova | `root.2.1` | 1.71 |  |  |
| 7 | [Bin auf dem Weg](https://www.youtube.com/results?search_query=Anni+Perka+Bin+auf+dem+Weg) | Anni Perka | `root.2.1` | 2.94 |  |  |
| 8 | [Daylight](https://www.youtube.com/results?search_query=Blue+October+Daylight) | Blue October | `root.2.0` | 2.65 |  |  |
| 9 | [17 Hours](https://www.youtube.com/results?search_query=GOWNS+17+Hours) | GOWNS | `root.2.0` | 2.32 |  |  |
| 10 | [Time Is The Space Between Us](https://www.youtube.com/results?search_query=Tim+Christensen+Time+Is+The+Space+Between+Us) | Tim Christensen | `root.2.0` | 3.01 |  |  |
| 도착 | [Go Up (Team A)](https://www.youtube.com/results?search_query=WIN+%28Who+Is+Next%29+Go+Up+%28Team+A%29) | WIN (Who Is Next) | `root.2.0` | 2.84 |  |  |

끊긴 역 번호: ______ · 노드가 바뀌는 지점과 일치하는가 (예/아니오/모름): ______

### J11 한국 곡 → 해외 곡 (근거리 정답쌍) (직선 보간) · 출발: [CHEEZE — Madeleine Love](https://www.youtube.com/results?search_query=CHEEZE+Madeleine+Love)

| 역 | 제목 | 아티스트 | 노드 | 앞 곡과 거리 | 이어짐 O/X | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Because He Lives](https://www.youtube.com/results?search_query=Harry+Connick%2C+Jr.+Because+He+Lives) | Harry Connick, Jr. | `root.1.1` | 2.40 |  |  |
| 2 | [Garota de Ipanema](https://www.youtube.com/results?search_query=Martina+DaSilva+Garota+de+Ipanema) | Martina DaSilva | `root.1.1` | 2.47 |  |  |
| 3 | [Sympatheticus](https://www.youtube.com/results?search_query=%C3%96nder+Focan+Sympatheticus) | Önder Focan | `root.1.1` | 3.33 |  |  |
| 4 | [Things Are So Slow](https://www.youtube.com/results?search_query=Barbara+Dane+Things+Are+So+Slow) | Barbara Dane | `root.1.1` | 3.30 |  |  |
| 5 | [伯爵茶](https://www.youtube.com/results?search_query=%E5%BC%B5%E5%AD%B8%E5%8F%8B+%E4%BC%AF%E7%88%B5%E8%8C%B6) | 張學友 | `root.1.1` | 2.68 |  |  |
| 6 | [Cuando, Cuando, Que Sera?](https://www.youtube.com/results?search_query=Cal+Tjader+Cuando%2C+Cuando%2C+Que+Sera%3F) | Cal Tjader | `root.1.1` | 3.48 |  |  |
| 7 | [Three Thousand Miles Back Home](https://www.youtube.com/results?search_query=Kenny+Burrell+Three+Thousand+Miles+Back+Home) | Kenny Burrell | `root.1.1` | 3.95 |  |  |
| 8 | [From Now On (We're One)](https://www.youtube.com/results?search_query=Tuck+%26+Patti+From+Now+On+%28We%27re+One%29) | Tuck & Patti | `root.1.1` | 3.06 |  |  |
| 9 | [36 Questions, Jonathan Groff, Jessie Shelton - The Truth](https://www.youtube.com/results?search_query=36+Questions+36+Questions%2C+Jonathan+Groff%2C+Jessie+Shelton+-+The+Truth) | 36 Questions | `root.1.0` | 3.15 |  |  |
| 10 | [For You, For Me, Forevermore](https://www.youtube.com/results?search_query=Coleman+Hawkins+For+You%2C+For+Me%2C+Forevermore) | Coleman Hawkins | `root.1.1` | 3.16 |  |  |
| 도착 | [Paris in the Rain](https://www.youtube.com/results?search_query=Lauv+Paris+in+the+Rain) | Lauv | `root.1.1` | 2.54 |  |  |

끊긴 역 번호: ______ · 노드가 바뀌는 지점과 일치하는가 (예/아니오/모름): ______

### J12 한국 곡 → 해외 곡 (근거리 정답쌍) (축 우선 DP (≤τ_far, λ=2)) · 출발: [CHEEZE — Madeleine Love](https://www.youtube.com/results?search_query=CHEEZE+Madeleine+Love)

| 역 | 제목 | 아티스트 | 노드 | 앞 곡과 거리 | 이어짐 O/X | 메모 |
|---|---|---|---|---|---|---|
| 1 | [Fortress Around Your Heart](https://www.youtube.com/results?search_query=The+Tierney+Sutton+Band+Fortress+Around+Your+Heart) | The Tierney Sutton Band | `root.1.1` | 2.57 |  |  |
| 2 | [Because He Lives](https://www.youtube.com/results?search_query=Harry+Connick%2C+Jr.+Because+He+Lives) | Harry Connick, Jr. | `root.1.1` | 2.55 |  |  |
| 3 | [Santa Baby](https://www.youtube.com/results?search_query=Herb+Alpert+Santa+Baby) | Herb Alpert | `root.0.2` | 2.81 |  |  |
| 4 | [Sympatheticus](https://www.youtube.com/results?search_query=%C3%96nder+Focan+Sympatheticus) | Önder Focan | `root.1.1` | 2.42 |  |  |
| 5 | [Sonhos Do Brasil](https://www.youtube.com/results?search_query=Kenny+Garrett+%2F+John+Scofield+%2F+Michael+Brecker+%2F+David+Friesen+Sonhos+Do+Brasil) | Kenny Garrett / John Scofield / Michael Brecker / David Frie | `root.1.1` | 3.32 |  |  |
| 6 | [Strange Orbit Of Life](https://www.youtube.com/results?search_query=Chris+Conway+Strange+Orbit+Of+Life) | Chris Conway | `root.1.1` | 2.27 |  |  |
| 7 | [Sheik of Araby](https://www.youtube.com/results?search_query=Big+Al+Dupree+Sheik+of+Araby) | Big Al Dupree | `root.1.1` | 2.40 |  |  |
| 8 | [Poor Butterfly](https://www.youtube.com/results?search_query=Coleman+Hawkins+Poor+Butterfly) | Coleman Hawkins | `root.1.1` | 2.56 |  |  |
| 9 | [Namoro](https://www.youtube.com/results?search_query=Project+2000+Namoro) | Project 2000 | `root.1.0` | 2.63 |  |  |
| 10 | [36 Questions, Jonathan Groff, Jessie Shelton - The Truth](https://www.youtube.com/results?search_query=36+Questions+36+Questions%2C+Jonathan+Groff%2C+Jessie+Shelton+-+The+Truth) | 36 Questions | `root.1.0` | 2.67 |  |  |
| 도착 | [Paris in the Rain](https://www.youtube.com/results?search_query=Lauv+Paris+in+the+Rain) | Lauv | `root.1.1` | 2.51 |  |  |

끊긴 역 번호: ______ · 노드가 바뀌는 지점과 일치하는가 (예/아니오/모름): ______

## 7. 마지막 — 전체 인상 (자유 서술, 5줄 이내)

- 가장 잘 맞은 묶음: ______
- 가장 안 맞은 묶음: ______
- 반복해서 보인 결함: ______
- 지도에 대해 새로 알게 된 것: ______
- 월요일에 논의할 것: ______


---
출처: Kakao Entertainment, melon (www.melon.com)
