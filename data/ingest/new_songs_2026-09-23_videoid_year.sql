-- 신곡 84곡(id 4694203..4694286) video_id·release_year 채우기 (Jira S15P21A405-600, 스펙 21)
-- DBeaver 에서 Alt+X 로 스크립트 전체 실행. 이미 값이 있는 칸(백엔드 lazy enricher 가 먼저 채운 곡)은 덮지 않는다.
--
-- video_id  : data/videoid 판정(api.resolve_request) 과 같은 기준 — verified 7 · best_guess 65(점수 ≥ 0.6, 임베드 확인). 못 찾은 12곡은 비워 둔다.
-- release_year: 고른 영상의 YouTube 음원 메타데이터(release_year / release_date) 38곡. upload_date 는 쓰지 않았다. 검증 전 값이다.
-- 되돌리기: UPDATE music SET video_id = NULL, release_year = NULL WHERE id BETWEEN 4694203 AND 4694286;
BEGIN;
UPDATE music m
   SET video_id     = COALESCE(m.video_id, v.video_id),
       release_year = COALESCE(m.release_year, v.release_year)
  FROM (VALUES
  (4694203, 'bYzCE795Ohw', NULL::smallint),  -- 제이에스 - 종로에서 [best_guess]
  (4694204, 'LRjETwEuEi8', 2006),  -- Polaris - 深呼吸 [best_guess]
  (4694207, 'jYHNGLvhavA', NULL),  -- 사공 - 모래성 [best_guess]
  (4694208, 'wlvcZ4StPRM', NULL),  -- 1415 - 선을 그어 주던가 [best_guess]
  (4694209, 'ieQgPfNqjGY', 2019),  -- 오이스터 - Cherokee [best_guess]
  (4694210, 'lPmxn2J9Qis', NULL),  -- 페퍼톤스 - New Hippie Generation [best_guess]
  (4694212, '8VwHfJo6tNU', 2019),  -- 원위 (ONEWE) - 내가 처음 만져본 강아지 (Love me) [best_guess]
  (4694213, 'oiKW9l1s68Q', NULL),  -- 프랭클리 - DD(Drunk Dreaming) [best_guess]
  (4694214, 'LK0_ft-5OU8', NULL),  -- 나상현씨밴드 - 무슨 일이 있어도 울지는 않네 [best_guess]
  (4694215, 'bxdiTfLZDDc', NULL),  -- 이고도 - Mouse [best_guess]
  (4694217, '4lSqCdA2yAI', 2023),  -- Jacob Collier - WELLLL [best_guess]
  (4694218, 'RbOWru2Tjuk', NULL),  -- 신인류 - 일인칭 관찰자 시점 [best_guess]
  (4694219, 'zBfQC_GcIvM', 2022),  -- 오월오일 ( 五月五日 ) - Echo [best_guess]
  (4694220, 'xXouNj7Za5A', NULL),  -- ego apartment - NEXT 2 U [best_guess]
  (4694221, '1YB03Fz0ULQ', 2026),  -- LUV TOWN, LUV TOWN - Clover [best_guess]
  (4694222, '8cEdndsuzSE', 2025),  -- XG - GALA [best_guess]
  (4694223, 'utUtOLVixCY', NULL),  -- Ethan Dufault - Signs [best_guess]
  (4694224, '19oT04OuBhg', 2025),  -- 이찬혁 (LEE CHANHYUK) - 멸종위기사랑 [best_guess]
  (4694225, 'V2G8ESoDXm8', NULL),  -- SZA - Saturn [best_guess]
  (4694226, 'MElS0GFopVM', 2011),  -- HyunA, Jun Hyung Yong, G.NA - A Bitter Day (Feat. Jun Hyung Yong & G.N [best_guess]
  (4694227, 'sAJh3t_meGw', 2026),  -- AKMU - Sunshine Bless You [best_guess]
  (4694228, 'cW8VLC9nnTo', 2023),  -- Billie Eilish - What Was I Made For？ [best_guess]
  (4694229, 'huj809wLjAU', NULL),  -- AKMU - 고래 (Whale) [verified]
  (4694230, 'vXE4spLFbic', NULL),  -- Woodcamp - Eatin' Good [best_guess]
  (4694231, 'F1ER9wNCet8', 2026),  -- Rym - On Repeat [best_guess]
  (4694233, 'ACDf9fhpuqo', 2016),  -- Alexander Jean - Whiskey and Morphine [verified]
  (4694234, 'EtiPbWzUY9o', NULL),  -- AKMU - 낙하 (NAKKA) (with IU) [best_guess]
  (4694235, 'MW79zgnSF40', 2024),  -- J.Tajor - Like I Do [best_guess]
  (4694236, 'uZfaqlnmi_g', 2026),  -- Lady Gaga, Doechii - RUNWAY [best_guess]
  (4694237, 'HKqB7eOrr24', 2015),  -- FKJ, Tom Bailey - Drops [best_guess]
  (4694238, 'MEii4GaqRQ0', 2024),  -- J.Tajor - Press Against Me [best_guess]
  (4694239, 'bdKdpyLH-IM', 1994),  -- 王菲 - 夢中人 (電影《重慶森林》歌曲) - 몽중인 [best_guess]
  (4694240, 'w3GCKPeyO2k', NULL),  -- Dallask - Try Again [best_guess]
  (4694241, 'sPrJH8WK1yY', NULL),  -- Hugo Helmig - Champagne Problems [best_guess]
  (4694242, 'IydHPao0OIg', NULL),  -- 백예린 (Yerin Baek) - MIRROR [best_guess]
  (4694243, 'ZIPiEJrPtNI', NULL),  -- 박문치 - 그 해 이야기 (feat. 강원우) [best_guess]
  (4694244, 'XYzZauasszI', 2023),  -- 실리카겔 - Andre99 [best_guess]
  (4694245, 'CnL10_X0hv0', 2013),  -- Broken Valentine - 알루미늄 [best_guess]
  (4694246, '8GsBJ9ppVNg', NULL),  -- 이하이 (LeeHi) - 구원자 (Savior) (Feat. B.I) [best_guess]
  (4694247, 'QjJbSa2TDpY', 2017),  -- Ron Blanco - I Wait (Mall Grab Remix) [verified]
  (4694249, 'wOWY_4sCAIs', 2024),  -- sunkis - Top Tier [best_guess]
  (4694250, '9yZQBW14vvg', NULL),  -- NU'EST - R.L.T.L (Real Love True Love) [best_guess]
  (4694251, 'SNn_H_Q2moo', 2026),  -- AKMU - 기쁨, 슬픔, 아름다운 마음 (Joy, Sorrow, A Beautifu [best_guess]
  (4694252, 'cUfDOS2SINM', 2026),  -- XG - Hypnotize [best_guess]
  (4694253, 'yKLy5Kh0tGE', 2026),  -- from. JAKE, JAKE, from. JAKE,  - Luv you (feat. JAKE) [best_guess]
  (4694254, 'AZlnBW-MJh0', NULL),  -- Anri - Remember Summer Days [best_guess]
  (4694255, 'aqimKWgFPUk', NULL),  -- NOTD, Hastings - Killing Me [best_guess]
  (4694256, 'QA7OSuV_Z3g', 2017),  -- ADOY - Grace [best_guess]
  (4694257, 'TD9Tj_8DpJg', 2025),  -- Lauv - Combust [best_guess]
  (4694261, 'YArS_JJWvg0', NULL),  -- Frank Ocean - Cayendo (Side A - Acoustic) [best_guess]
  (4694262, 'QT3qEk1hhTc', NULL),  -- Adam Turley, Heather Sommer - The Problem [best_guess]
  (4694263, 'yMQao9c6-CI', 2020),  -- jens - In or Out [verified]
  (4694264, '-xjt2xIqkx0', 2019),  -- QUIN, 6LACK - Mushroom Chocolate (with 6LACK) [best_guess]
  (4694265, 'r1Fx0tqK5Z4', NULL),  -- Sasha Alex Sloan - Older [best_guess]
  (4694266, '0LC3SfJAIxc', NULL),  -- Coldplay - Midnight (Kygo Remix) [best_guess]
  (4694267, 'bcUUHdHaf3k', 2024),  -- LAY, Lauv - Run Back To You [best_guess]
  (4694268, '3JeNVo6wxaw', NULL),  -- dosii - 너의궤도 Orbit of yours [best_guess]
  (4694270, 'F1csDs7BFpE', 2020),  -- CHANGMO - COUNTIN MY GUAP [best_guess]
  (4694271, '2dsIZjmRyQk', 2025),  -- JMIN - TREESH (feat. 식케이, 김하온) [best_guess]
  (4694272, 'uWkdReiZ7o0', 2021),  -- SIM2 - 비가 와 (With Aden, Kebee) [verified]
  (4694273, '_hvAR8uXBYw', 2019),  -- E SENS - RADAR (feat. 김심야) [best_guess]
  (4694274, 'xyfMurmvWJk', NULL),  -- 오존 (O3ohn) & 카더가든 - BIG BIRD (feat. 유라(youra)) [best_guess]
  (4694275, 'UoGMPRKTr-w', NULL),  -- 실키보이즈(SILKYBOIS) - THAT'S FINE [best_guess]
  (4694276, 'SqBLN5KFuV4', NULL),  -- DPR IAN - Mood [best_guess]
  (4694277, 'jDRitQSJleQ', 2023),  -- 블라세, 블랙 넛, Jimmy Paige & 도끼 - Grrr - Spotify Singles [best_guess]
  (4694278, 'yE45u2PUr2s', NULL),  -- 식케이 (Sik-K) & Lil Moshpit - PUBLIC ENEMIES (feat. OSUN (권오선), Iyaan, [best_guess]
  (4694279, 'Ud9pSEkskQQ', 2026),  -- Luci Gang - HEADLOCK [verified]
  (4694281, 'w0sOLQXCGjE', NULL),  -- Tabber - Chi-Ka (feat. DEAN) [best_guess]
  (4694283, 'b63RXHteeQ0', 2021),  -- 이수린 & HAIFHAIF - mmm (feat. oceanfromtheblue) [best_guess]
  (4694284, '8KdnIo8MLsU', NULL),  -- 허성현 (Huh) - MBT [best_guess]
  (4694285, 'c-YUDSHdI4g', 2026),  -- POCKET GROOVE - Good Tempo [verified]
  (4694286, 'I1il0cHrUUY', NULL)  -- pH-1 - 54321 (feat. 해원 (NMIXX)) [best_guess]
  ) AS v(id, video_id, release_year)
 WHERE m.id = v.id
   AND m.id BETWEEN 4694203 AND 4694286;
SELECT count(*) FILTER (WHERE video_id IS NOT NULL) AS video_id_filled,
       count(*) FILTER (WHERE release_year IS NOT NULL) AS release_year_filled
  FROM music WHERE id BETWEEN 4694203 AND 4694286;
COMMIT;
