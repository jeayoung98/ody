# S1 dry-run — 카탈로그 제외 규칙 (rules 260c79d11e91d2b2)

총 제외 **1,926,555** / 6,624,399 = **29.08%** (중단 임계 40%) 

| 규칙 | 적중 | 비율 | 단독 적중 | 근거 |
|:--|--:|--:|--:|:--|
| R1_length | 1,095,960 | 16.544% | 881,687 | D1 적용(2026-09-07 사용자 결정, v5 에서 실행): 곡 길이 60s~6min 만 남긴다. 예외 태그 없음 — 클래식·앰비언트 롱폼도 자른다. 실측 적중 1,095,960(짧은 181,232 · 긴 914,728). A1: <30s 99,950 (1.35%). >20min 29,966 중 태그 있는 13,143곡의 35.7%가 클래식/오페라/앰비언트 → 예외 유지. 미태그 >20min 표본에 롱폼 앰비언트/일렉트로닉 정상 음악 다수 → 미태그 곡은 상한 30min(1800s) 적용(사용자 결정). 태그 있는 비예외 곡은 20min 상한. |
| R2_nonmusic | 0 | 0.000% | 0 | A5: 12개 키워드 적중 합집합 35,901. comedy(20,876)·spoken word(단독 5,376)·field recording(단독 1,083)은 dry-run 표본에서 음악 오적중(Hobart Smith, Biosphere, The Streets 등 — 두 태그는 음악 장르 표기로도 쓰임) → 제외에서 빼고 flag 컬럼(사용자 결정). 나머지 9개 유지. |
| R3_no_key | 0 | 0.000% | 0 | D7(서빙 진단): 키 없는 곡 3.2%. 여기서는 title·artist 원문 모두 결측인 곡만. |
| R4_cohort | 0 | 0.000% | 0 | work/v2_cohort.json (CONFIRMED_BY_GATE_V2). 매니페스트가 이미 코호트만 담아 적중 0 예상 — 명시용. |
| R5_dup_canonical | 471,469 | 7.117% | 369,136 | v5: 거리 보호 해제 — 같은 canonical recording 이면 좌표 거리와 무관하게 대표 1곡만 남긴다. canonical redirect 후 같은 canonical 복수 mbid → 대표 1행. dry-run v1: 멤버 763,015 (10.3%), 멤버-대표 좌표 거리 median 6.31 — MB 병합 ≠ 같은 소리. R6 와 동일한 거리 보호 4.0 추가 (A7 같은 녹음 87%가 4 이내). 보호 시 접힘 ≈241,660 (3.3%). |
| R6_dup_version | 392,438 | 5.924% | 310,728 | v5: 거리 보호 해제 — 같은 아티스트·정규화 제목이면 전부 접는다. live·remix·acoustic 은 distinct_modifiers 로 여전히 별개 묶음이다. A6: 2곡+ 묶음 706,401 / 접힘 후보 1,520,985 (20.5%) / 거리>4 보호 918,463 (60.4%) / 접힘 예상 602,522 (8.1%). 임계 4.0 근거 = A7 같은 MBID 제출본 거리 median 0.58·p90 5.18 (진짜 같은 녹음의 87%는 4 이내) vs A6 묶음 멤버 거리 median 5.34 (제목 같아도 대부분 다른 연주). 미분류 괄호 719,842곡은 키에 남겨 접지 않음(보수). |
| R7_samplerate | 12,504 | 0.189% | 7,400 | v5: 표시에서 제외로 전환. 44.1kHz 미만은 인코딩 품질이 좌표를 흔든다. A2: <44100 18,047곡 (0.24%), 좌표 편향 최대 |0.46| std (pc3) < 0.5 → 제외 대신 flag_low_sr 컬럼. |
| R8_silence | 6,625 | 0.100% | 2,474 | v5: 음량 하위 0.1% 는 dynamic_complexity·무음률 조건 없이 제외한다. A3: average_loudness 하위 0.1% 7,405곡 중 silence_rate_60dB>0.9 116곡 (dynamic_complexity<0.1 은 0곡). 표본: Headspace 명상, John Cage, 무음 히든트랙. |
| R9_corrupt | 3,756 | 0.057% | 2,029 | v5: 표시에서 제외로 전환. 극단 특징 5개 이상. A4: ≥5 특징 적중 4,762곡 표본이 실험·노이즈 음악(손상 아님) → 제외하지 않고 flag_clipped 컬럼만(사용자 결정). |
| R10_title_noise | 33,645 | 0.508% | 5,919 | catalog_v2 실측(2026-09-14): 전체 적중 48,952 / R1~R9 미적중 신규 제외 33,646 (0.454%). 패턴별 신규 제외 untitled 11,746 · empty_or_punct 5,198 · track_number 3,005 · structural_only 13,381 · unknown_title 316. 총 제외 813,753 (10.99%) < 중단 임계 15%. 정규식은 Python re 와 Java rlike 에서 같게 동작하도록 ·\d·\w 를 쓰지 않고 ASCII 범위로 적는다. 넣지 않은 패턴: 'untitled' 부분 일치(D'Angelo 'Untitled (How Does It Feel)'), 숫자만 제목(Prince '1999', Taylor Swift '22'), silence/talk/Part N/video/'01 - 제목' 파일명형 — 실제 곡 적중. 운영 DB 에서 수동 삭제했던 untitled 를 규칙으로 옮긴 것(규칙 2·9). |
| R11_test_signal | 693 | 0.010% | 386 | 캘리브레이션·측정 신호는 음악이 아니고 좌표가 극단으로 튄다. 목표 적중 206(2026-09-16 이전 세션 실측). |
| R12_spoken_nonmusic | 23,008 | 0.347% | 16,373 | v3 에서 flag 로 돌렸던 세 태그를 v5 에서 제외로 되돌린다(사용자 결정 2026-09-16). 적중 목표 23,008. 근거 파일은 work/audit_A5_hits.parquet. |
| R13_audiobook | 8,949 | 0.135% | 5,358 | 낭독물은 음악 좌표계에 들어가면 이웃 품질을 해친다. 태그(audiobook)와 제목·아티스트 표기를 함께 본다. 목표 적중 7,732. |
| R15_static | 5,666 | 0.086% | 2,871 | 드론·단일 톤·정지성 녹음. 세 변동성 특징이 모두 하위 1% 면 무조건, 모두 하위 2% 이고 onset_rate 도 하위 5% 면 제외. 목표 적중 2,933 + 15,178. |
| R16_title_nonmusic | 76,857 | 1.160% | 33,452 | 제목이 비음악임을 직접 말하는 행. R10 이 '제목 전체가 잡음'인 경우만 잡는 것과 달리 제목 안 단어를 본다. 목표 적중 74,136 · 신규 35,195. |
| R17_artist_unknown | 62,341 | 0.941% | 46,589 | 아티스트를 식별할 수 없으면 검색·이웃·여정 어디에도 쓸 수 없다. 목표 적중 62,295 · 신규 48,056. |

겹침: R1_length & R5_dup_canonical 92,274, R1_length & R6_dup_version 77,782, R10_title_noise & R16_title_nonmusic 25,127, R16_title_nonmusic & R1_length 23,557, R17_artist_unknown & R1_length 12,919, R16_title_nonmusic & R5_dup_canonical 11,680, R10_title_noise & R1_length 11,007, R10_title_noise & R5_dup_canonical 10,004, R12_spoken_nonmusic & R1_length 4,208, R1_length & R8_silence 3,743, R13_audiobook & R1_length 2,485, R15_static & R1_length 2,424

R1 >20min: 예외태그 0 · 미태그 0 (그중 <30min 유지 0) · R5 멤버 471,469 / 보호 0 / 접힘 471,469 (거리 median 8.28) · R6 묶음 208,508 / 멤버 392,438 / 보호 0 / 접힘 392,438 · R8 분위값 0.0001

### R1_length 표본

| 아티스트 | 제목 | 길이 | SR | 코덱 |
|:--|:--|--:|--:|:--|
| Stephen Marley | Inna Di Red (Feat. Ben Harper) | 381.5 | 44100 | alac |
| Autechre | Cavity Job | 370.4 | 44100 | mp3 |
| Cincinnati Pops "Big Band" Orchestra | When the Saints Go Marchin' In | 573.4 | 44100 | flac |
| The Slow Voyage | Exotic Mirror | 497.6 | 44100 | mp3 |
| Edward Ka-Spel | Inferno | 534.4 | 44100 | mp3 |
| Malcolm Strachan | Uncle Bobby's Last Orders | 404.0 | 44100 | mp3 |
| Robert Fripp | Time Stands Still | 561.5 | 44100 | flac |
| James McMurtry & The Heartless Bastards | No More Buffalo | 412.1 | 44100 | mp3 |
| Ahmad Jamal | Angel Eyes | 410.9 | 44100 | flac |
| All Them Witches | Born Under a Bad Sign | 578.9 | 44100 | flac |

### R5_dup_canonical 표본

| 아티스트 | 제목 | 길이 | SR | 코덱 |
|:--|:--|--:|--:|:--|
| Pavement | Kris Kraft | 158.6 | 44100 | flac |
| moe. | Okayalright | 261.7 | 44100 | flac |
| God Dethroned | serpent king | 181.3 | 44100 | mp3 |
| The Legendary Pink Dots | Defeated | 123.7 | 44100 | aac |
| W.A.S.P. | Inside the Electric Circus | 271.5 | 44100 | alac |
| Vangelis | Longing | 225.4 | 44100 | flac |
| Porcupine Tree | Degree Zero of Liberty | 105.1 | 44100 | flac |
| Project One | Smokin' | 313.6 | 44100 | flac |
| Ismael Quintana | Oyelo Que Te Conviene | 305.8 | 44100 | mp3 |
| Memphis Slim | I Believe I'll Settle Down | 185.2 | 48000 | aac |

### R6_dup_version 표본

| 아티스트 | 제목 | 길이 | SR | 코덱 |
|:--|:--|--:|--:|:--|
| Choirboys | Never Gonna Die | 242.9 | 44100 | mp3 |
| Jean Sibelius | Tapiola, Op. 112 | 1076.0 | 44100 | flac |
| Brandy | I Wanna Be Down | 242.3 | 44100 | alac |
| Tears for Fears | Everybody Wants to Rule the World (extended mix) | 281.9 | 44100 | flac |
| Nancy Wilson | Tonight May Have to Last Me All My Life | 171.5 | 44100 | mp3 |
| Uriah Heep | Sympathy | 283.5 | 44100 | mp3 |
| Charlie Parker | La cucaracha | 163.2 | 44100 | mp3 |
| Kyau & Albert | Always a Fool (club mix) | 465.2 | 48000 | alac |
| Jimmy Jones | Good Timin' | 121.8 | 44100 | mp3 |
| Gene Vincent | Up a Lazy River | 140.8 | 44100 | mp3 |

### R7_samplerate 표본

| 아티스트 | 제목 | 길이 | SR | 코덱 |
|:--|:--|--:|--:|:--|
| Harry Allen with Bill Charlap Trio | Mood Indigo | 302.3 | 22050 | mp3 |
| Ricardo Lemvo & Makina Loca | Mujer Divina | 237.6 | 22050 | mp3 |
| Little Tony | Cuore matto | 172.4 | 32000 | mp3 |
| Rita Lee | Agora É Moda | 255.1 | 22050 | mp3 |
| Cole Porter | Tom, Dick or Harry | 235.3 | 22050 | mp3 |
| H.G. Wells | Chapter 4 | 1549.4 | 22050 | mp3 |
| 片岡真央, 朝日温子 & 戸高一生 | Downtown by Night: 1 (Snowy) | 46.1 | 32728 | flac |
| Rita Reys & Bengt Hallberg | After You've Gone | 176.6 | 22050 | mp3 |
| Woody Guthrie | Stackolee | 166.7 | 22050 | mp3 |
| Claude François | Disco Météo | 210.2 | 22050 | mp3 |

### R8_silence 표본

| 아티스트 | 제목 | 길이 | SR | 코덱 |
|:--|:--|--:|--:|:--|
| Gergely Vajda | Lightshadow-Trembling | 355.6 | 44100 | flac |
| Gustav Mahler | Symphony no. 9 in D: 4. Adagio. Sehr langsam und noch zurückhaltend | 1614.1 | 44100 | flac |
| Frédéric Chopin | Piano Sonata No. 3 in B minor, Op. 58: III. Largo | 850.3 | 44100 | flac |
| Angela Gheorghiu | La bohème: Sì. Mi chiamano Mimì | 288.5 | 48000 | flac |
| 戸島壮太郎 | S.E. COLLECTION | 179.5 | 44100 | flac |
| Thurídur Jónsdóttir | Flutter | 1251.2 | 192000 | flac |
| Claude Debussy | Préludes, Livre I: Voiles | 220.4 | 44100 | flac |
| Sergei Rachmaninov | All-Night Vigil, op. 37: XI. Velichit dusha moya Gospoda | 383.2 | 44100 | flac |
| Keith Rowe / John Tilbury | Oxleay | 1049.9 | 44100 | mp3 |
| Ludwig van Beethoven | Piano Sonata in B-flat major "Hammerklavier", op. 106: Adagio sostenut | 1027.6 | 44100 | flac |

### R9_corrupt 표본

| 아티스트 | 제목 | 길이 | SR | 코덱 |
|:--|:--|--:|--:|:--|
| overscape | underground stories | 236.8 | 44100 | flac |
| Kassel Jaeger | Lineament | 458.0 | 44100 | flac |
| Noto | 4'03'' | 242.9 | 44100 | mp3 |
| Toshimaru Nakamura | Semi | 416.7 | 44100 | flac |
| Exos | At | 295.1 | 44100 | mp3 |
| Philippe Guez & Patrick Maarek | Lost Emperor | 67.5 | 44100 | mp3 |
| Amhain | Sm5r | 1215.8 | 44100 | mp3 |
| Spykes | [untitled] | 623.8 | 44100 | mp3 |
| Bermuda Hay | 天気雨 | 242.4 | 44100 | flac |
| volhnn | I | 1207.5 | 44100 | flac |

### R10_title_noise 표본

| 아티스트 | 제목 | 길이 | SR | 코덱 |
|:--|:--|--:|--:|:--|
| Bruce Springsteen & The E Street Band | Intro (Live) | 74.1 | 44100 | flac |
| sonnov | untitled | 1298.5 | 44100 | mp3 |
| Sunburned Hand of the Man | Untitled 3 | 597.9 | 44100 | flac |
| Megadeth | Intro | 121.3 | 44100 | mp3 |
| test |  | 305.1 | 44100 | mp3 |
| Ron Carter |  | 204.0 | 44100 | alac |
| Infestment | Intro | 37.6 | 44100 | mp3 |
| Penthouse Suite | Intro | 120.6 | 44100 | mp3 |
| F.U.K.T | Outro | 41.9 | 44100 | flac |
| sonnov | untitled | 571.4 | 44100 | mp3 |

### R11_test_signal 표본

| 아티스트 | 제목 | 길이 | SR | 코덱 |
|:--|:--|--:|--:|:--|
| Wizard Magic | white noise machine | 287.2 | 44100 | mp3 |
| Wastëland Riders | 2410 Hz | 90.4 | 44100 | mp3 |
| The Monochrome Set | White Noise | 185.7 | 44100 | mp3 |
| Stereophile | Music Articulation Test Tone | 79.5 | 44100 | alac |
| Disclosure feat. AlunaGeorge | White Noise | 215.6 | 44100 | mp3 |
| John Tejada | Calibration | 414.5 | 44100 | mp3 |
| HKE | Sine Wave | 183.4 | 44100 | mp3 |
| The Dig | Clouds In The White Noise | 226.5 | 44100 | mp3 |
| The Brew | Pink Noise King | 328.2 | 44100 | mp3 |
| Markus Schulz | 65.4hz (extended mix) | 484.2 | 44100 | mp3 |

### R12_spoken_nonmusic 표본

| 아티스트 | 제목 | 길이 | SR | 코덱 |
|:--|:--|--:|--:|:--|
| Homer & Jethro | The Battle of Kookamonga | 160.0 | 44100 | flac |
| Strong Bad | The System is Down | 106.6 | 44100 | flac |
| The 12th Man | The Cab Ride | 154.0 | 44100 | mp3 |
| Desdamona | Get By | 260.1 | 44100 | mp3 |
| Paula Poundstone | Airport Security | 62.2 | 44100 | mp3 |
| David Mitchell & Robert Webb | Friends of Saddam Hussein | 201.3 | 32000 | mp3 |
| ANT | Only The Pretty Ones | 105.4 | 44100 | mp3 |
| La Touche | Neicie's Strut | 140.8 | 44100 | mp3 |
| The 12th Man | 12th Man Again! 06 | 149.9 | 44100 | mp3 |
| U2 | I Shall Be Released (Feat. Peter Gabriel, Sting, Bryan Adams & Lou Ree | 466.3 | 44100 | mp3 |

### R13_audiobook 표본

| 아티스트 | 제목 | 길이 | SR | 코덱 |
|:--|:--|--:|--:|:--|
| The Open University | Block 2, Chapter 2, Activity 39: Tuning and Temperament | 1194.2 | 44100 | mp3 |
| Henry James | The Golden, Bowl (Unabridged): 'You say your husband's ill?' | 192.7 | 44100 | aac |
| Louis-Ferdinand Céline lu par Denis Podalydès | Chapitre 4 : Une jeune fille, un châle, un tablier blanc, sortaient de | 277.8 | 44100 | flac |
| David Michaelis read by Holter Graham | Part 17 | 511.0 | 22050 | mp3 |
| J.K. Rowling | Kapitel 08-04: Der Meister der Zaubertränke | 153.5 | 32000 | mp3 |
| Fidel Castro read by Todd McLaren & Patrick Lawlor | Part 223 | 154.0 | 44100 | aac |
| Fidel Castro read by Todd McLaren & Patrick Lawlor | Part 265 | 180.2 | 44100 | aac |
| Fidel Castro read by Todd McLaren & Patrick Lawlor | Part 36 | 167.0 | 44100 | aac |
| Victor Hugo, Philippe Sollier | Partie 4 - L'idylle rue Plumet et l'épopée rue Saint-Denis - Chapitre  | 715.7 | 44100 | mp3 |
| Maggie Stiefvater read by Will Patton | Chapter 16 - The Raven Boys | 862.4 | 44100 | mp3 |

### R15_static 표본

| 아티스트 | 제목 | 길이 | SR | 코덱 |
|:--|:--|--:|--:|:--|
| Lord Redstone, Erdstall, Spectral Kingdom, Vindkal | Lord Redstone - Mushrooms | 219.4 | 44100 | mp3 |
| Jeremy Young | Filament I | 1740.3 | 44100 | mp3 |
| Morton Feldman | Three Voices: Slow Waltz | 307.9 | 44100 | mp3 |
| Robert Etoll | Haunting Drone A | 48.5 | 44100 | flac |
| Airwalking | Westminster Tones #17 | 48.0 | 44100 | flac |
| Tomoo Kosugi | Pool | 232.0 | 48000 | flac |
| Watain | Dead but Dreaming | 124.9 | 44100 | flac |
| Harry Oldfield | Stick quartz and Madagascar quartz interference | 157.1 | 44100 | mp3 |
| Tom Hall | Parallel-s | 346.3 | 44100 | mp3 |
| Almøst Silent | Gap 1 | 60.2 | 44100 | mp3 |

### R16_title_nonmusic 표본

| 아티스트 | 제목 | 길이 | SR | 코덱 |
|:--|:--|--:|--:|:--|
| Sofa Talk | Tomi Chair's Feeling of Nature Intro | 159.9 | 44100 | mp3 |
| Loreena McKennitt | Band Intro | 185.6 | 44100 | mp3 |
| Analog Mechanics | Intro (Instrumental) | 111.1 | 44100 | mp3 |
| The Metaphysical Vs. Rosetta Stoned | Rorschach Test (DnB Remix) | 226.2 | 44100 | mp3 |
| Bette Davis | All About Eve Dialogue | 216.2 | 44100 | alac |
| Porcupine Tree | Intro | 128.4 | 44100 | flac |
| Welter Records | Aies - Untitled 1 | 658.2 | 44100 | mp3 |
| 武満徹 | Coral Island: IV. Poem II | 235.9 | 44100 | flac |
| Archie Shepp, Damu the Fudgemunk & Raw Poetic | Valuable Lesson | 60.0 | 44100 | mp3 |
| NEUPINK | YAAAA (INTRO) | 34.4 | 44100 | mp3 |

### R17_artist_unknown 표본

| 아티스트 | 제목 | 길이 | SR | 코덱 |
|:--|:--|--:|--:|:--|
| Various Artists | Center of the Earth - Son of Gaia | 714.2 | 44100 | mp3 |
| Various Artists | Corydon Singers - Duruflé: In Pardisum | 193.4 | 44100 | mp3 |
| Various Artists | Bunkerkoller - The People's March | 342.5 | 44100 | flac |
| Various Artists | Uncle Squidz - Smoking PCP in Cyberia, BRB | 210.1 | 44100 | mp3 |
| Various Artists | Katie Caulfield - The Christmas Waltz | 158.9 | 44100 | mp3 |
| VA | Filthy Rich Preacher - fLockK | 322.1 | 44100 | mp3 |
| VA | The Triumph of Neptune: II. Hornpipe | 92.3 | 44100 | flac |
| [unknown] | Soul Survivor | 270.6 | 44100 | flac |
| Various Artists | Square.HEAD - stimulated | 141.5 | 44100 | mp3 |
| [unknown] | Syamui And Jalali, Lovesong From Herat | 438.3 | 44100 | flac |

### R6 묶음 30개 (대표 / 멤버 / 좌표 거리 — 접힘 여부)

- **Alphawezen — Electricity Drive** (flac, 제출본 6)
  - Electricity Drive (The Lost Radio Version) — d=4.65 (mp3) 접힘
  - Electricity Drive (The Lost Radio Version) — d=4.21 (mp3) 접힘
- **Makyo — Devadasi (Kif Mix)** (flac, 제출본 2)
  - Devadasi (Sunrise Beach Mix) — d=26.8 (mp3) 접힘
  - Devadasi (Sunrise Beach Mix) — d=26.8 (mp3) 접힘
  - Devadasi (Mantra Mix) — d=27.27 (vorbis) 접힘
  - Devadasi (Kif Mix) — d=26.55 (mp3) 접힘
  - Devadasi (Kif Mix) — d=26.5 (mp3) 접힘
- **Ludwig van Beethoven — Piano Sonata no. 17 in D minor, op. 31 no. 2 "The Tempest": II. Adagio** (flac, 제출본 14)
  - Piano Sonata no. 17 in D minor, op. 31 no. 2 "The Tempest": II. Adagio — d=5.11 (flac) 접힘
  - Piano Sonata No. 17 In D Minor, Op. 31 No. 2 "The Tempest": II. Adagio — d=4.28 (flac) 접힘
  - Piano Sonata no. 17 in D minor, op. 31 no. 2 "The Tempest": II. Adagio — d=4.77 (flac) 접힘
  - Piano Sonata no. 17 in D minor, op. 31 no. 2 "The Tempest": II. Adagio — d=5.82 (flac) 접힘
- **Midfield General — Devil in Sports Casual** (flac, 제출본 1)
  - Devil in Sports Casual — d=4.27 (vorbis) 접힘
  - Devil In Sports Casual (Fatboy Slim's Does My Beat Look Big In This Mi — d=14.13 (mp3) 접힘
- **Édith Piaf — Tiens, V'là Un Marin** (flac, 제출본 3)
  - Tiens v'là un marin — d=7.67 (vorbis) 접힘
  - Tiens V'là Un Marin — d=7.38 (mp3) 접힘
  - Tiens v'là un marin — d=8.2 (mp3) 접힘
- **Wolfgang Amadeus Mozart — Quartet for Strings No. 11 in E-flat major, K. 171 "Quartetti Vienna":** (flac, 제출본 12)
  - Quartet for Strings No. 11 in E-flat major, K. 171 "Quartetti Vienna": — d=4.78 (flac) 접힘
- **Die Warzau — Bodybag** (alac, 제출본 7)
  - Bodybag (dub edit) — d=7.66 (alac) 접힘
- **James S. Levine — Sound 2 Lite** (mp3, 제출본 4)
  - Sound 2 Lite (30 second version) — d=9.94 (mp3) 접힘
- **Tillman Sillescu — Drop the Bomb** (mp3, 제출본 1)
  - Drop the Bomb (30 second version) — d=5.38 (mp3) 접힘
- **Consolidated — Tool and Die** (flac, 제출본 12)
  - Tool and Die (version 1) — d=7.23 (flac) 접힘
- **Pilote — Turtle** (flac, 제출본 2)
  - Turtle — d=28.34 (flac) 접힘
  - Turtle (Bonobo mix) — d=29.05 (mp3) 접힘
- **Edgar Froese — Specific Gravity of Smile** (flac, 제출본 3)
  - Specific Gravity of Smile — d=9.49 (mp3) 접힘
- **Gustav Mahler — Symphony no. 4 in G: III. Ruhevoll** (flac, 제출본 4)
  - Symphony no. 4 in G: III. Ruhevoll — d=5.47 (flac) 접힘
- **Imaginary Forces — Make Ends Meet** (flac, 제출본 1)
  - Make Ends Meet (London Something version) — d=10.22 (flac) 접힘
- **Robyn Hitchcock and The Egyptians — Veins of the Queen** (flac, 제출본 8)
  - Veins of the Queen (royal mix) — d=4.85 (flac) 접힘
- **The Dave Clark Five — Look Before You Leap** (flac, 제출본 8)
  - Look Before You Leap — d=7.4 (mp3) 접힘
- **Electrocado — Speedle (AMB Remix)** (mp3, 제출본 1)
  - Speedle (CloZee Remix) — d=15.09 (mp3) 접힘
- **Anne Murray — Things** (mp3, 제출본 3)
  - Things — d=4.33 (mp3) 접힘
- **Jimmy Somerville — Rolling** (pcm_s16be, 제출본 5)
  - Rolling — d=23.95 (mp3) 접힘
- **Neil Young — The Old Country Waltz** (flac, 제출본 50)
  - The Old Country Waltz — d=7.8 (flac) 접힘
- **Nina Simone — Pirate Jenny (live)** (flac, 제출본 1)
  - Pirate Jenny (Live) — d=9.44 (mp3) 접힘
- **Nitzer Ebb — Backlash** (alac, 제출본 5)
  - Backlash (William Orbit Mix) — d=5.04 (alac) 접힘
  - Backlash (mix No.2) — d=6.13 (flac) 접힘
- **Paradise Lost — Last Regret** (flac, 제출본 9)
  - Last Regret — d=6.83 (flac) 접힘
  - Last Regret — d=6.33 (flac) 접힘
  - Last Regret (Lost in Prague orchestra mix) — d=6.82 (mp3) 접힘
- **Reinhard Mey — Es schneit in meinen Gedanken** (flac, 제출본 4)
  - Es schneit in meinen Gedanken — d=5.42 (flac) 접힘
- **Wolfgang Amadeus Mozart — Così fan tutte, K. 588: Act I, Scene I. No. 3 Terzetto "Una bella sere** (flac, 제출본 6)
  - Così fan tutte, K. 588: Act I, Scene I. No. 3 Terzetto "Una bella sere — d=7.66 (flac) 접힘
  - Così fan tutte, K. 588: Act I, Scene I. No. 3 Terzetto "Una bella sere — d=4.35 (flac) 접힘
- **Seeming — Worldburners Unite (7" version)** (flac, 제출본 5)
  - Worldburners Unite (Pandemic mix) — d=7.17 (flac) 접힘
  - Worldburners Unite (World Gone Dark mix) — d=7.79 (mp3) 접힘
- **Lam — I** (flac, 제출본 2)
  - I — d=23.69 (mp3) 접힘
- **John Williams — Parade of the Ewoks** (flac, 제출본 64)
  - Parade of the Ewoks — d=5.6 (flac) 접힘
  - Parade of the Ewoks — d=5.69 (flac) 접힘
  - Parade of the Ewoks — d=4.17 (flac) 접힘
- **Almaty — Almaty - Gennaro** (mp3, 제출본 3)
  - Almaty - Gennaro (Octo Octa's Hope on Hope on Hope Mix) — d=9.02 (mp3) 접힘
- **Birdy — Wings** (flac, 제출본 64)
  - Wings — d=10.33 (mp3) 접힘
  - Wings (Orchestra mix) — d=5.64 (flac) 접힘

### depth-1 노드별 제외 비율 (이전 dry-run -> 이번)

| 노드 | 곡 | 이전 | 이번 | 전체 대비 |
|:--|--:|--:|--:|--:|
| root.0 | 1,553,809 | - | 30.89% | 1.06x |
| root.1 | 1,761,407 | - | 28.45% | 0.98x |
| root.2 | 1,705,702 | - | 26.52% | 0.91x |
| root.3 | 1,603,481 | - | 30.76% | 1.06x |

삭제 없음 · 곡 개별 제외 없음 · fit·트리 재학습 없음 · v1 아카이브 미수정.
