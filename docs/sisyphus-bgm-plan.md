# 시지프 전용 음악 계획 (2026-11-18, 아직 만들지 않음)

## 방식 (2026-11-18 결정: 수노로 만든다)
- 제미나이는 무료 한도에서 음악이 0이라 쓰지 않는다(결제 연결·유료 호출 금지 규칙). 수노(Suno)로 곡을 만들어 주시면 제가 파일을 게임에 연결한다.
- 외부 음원은 쓰지 않는다. 수노에서는 특정 곡·가수·게임 이름을 프롬프트에 넣지 않고 분위기와 악기로만 적는다.
- 수노가 만든 곡은 노래 한 편이라 반복되는 배경음악에 쓰려면 끝과 처음이 이어지게 다듬어야 한다. 아래 "다듬기"를 따른다.
- 직접 합성(numpy)하는 방식은 수노 결과가 마음에 안 들 때의 대안으로 남겨 둔다.

## 엔진에 필요한 칸 (지금 구조)
- `assets/bgm/<스타일>_<장면>.mp3` 한 쌍: 장면은 `calm`(평상시), `fight`(전투), `boss`(보스, 공통 파일 `boss_boss.mp3`).
- 새 스타일 `sisyphus`를 추가해 `sisyphus_calm.mp3`, `sisyphus_fight.mp3`, (보스용 `sisyphus_boss.mp3`)를 둔다.
- 시지프 안(`ch.sis`)에서는 스타일이 자동으로 `sisyphus`로 바뀌게 코드를 붙인다(지금은 출신·사용자 선택으로만 정해진다).
- 배포: 파일 분리(`--multi`) 빌드에서는 음악도 `data:`로 박지 않고 파일로 올릴 수 있다. 용량 한도가 없어진다. 단일 파일 빌드는 mp3 하나가 0.5~1.7MB라 용량을 같이 본다.

## 곡 목록 (우선순위)
| 순서 | 곡 | 장면 | 분위기 | 박자·조 | 길이 |
|---|---|---|---|---|---|
| 1 | 백화점의 낮 | calm | 아르데코 라운지, 조용한 재즈 피아노와 브러시 드럼, 안내 방송 같은 맑은 종소리 | 약 76BPM · 단조 | 16마디(약 50초) 반복 |
| 2 | 사냥 | fight | 낮은 맥박 같은 베이스, 가위·바늘 소리를 닮은 금속 타악 | 약 104BPM | 16마디 반복 |
| 3 | 간수·신부 | boss | 느린 합창 같은 패드, 종, 베일이 풀리는 듯한 상승 | 약 60BPM | 길게 반복 |
| 4 | 붕괴 | calm 변주 | 방송이 끊기고 바닥이 내려앉는 하강, 사이렌을 닮은 소리 | 느림 | 짧게 |
| 5 | 시지프의 비(2막) | calm 변주 | 빗소리 위에 드문 피아노, 연차가 갈수록 층(스템)이 더해져 거세진다 | 약 54BPM | 16마디 반복 |
| 6 | 외곽 | calm 변주 | 한 음씩 남은 피아노, 따뜻하지만 비는 계속 내린다 | 느림 | 짧게 |

- 소속별 변주(르루주·르누아르·르카키)는 기본 곡 위에 얹는 짧은 층으로 나중에 추가한다.
- 2막 5번은 이미 있는 "스템" 방식(전투 중 층을 더하는 구조)을 비의 세기에 맞춰 재사용할 수 있다.

## 정해 주실 것
1. 합성(직접 만든 소리)으로 갈지, 직접 만든 음악을 쓰실지.
2. 곡 수를 1~3번(평상시·전투·보스)까지만 먼저 만들지.
3. 곡의 분위기가 위와 맞는지(아르데코 라운지가 맞는지).

## 수노 프롬프트 (곡별, 모두 가사 없는 연주곡)
스타일 칸에 넣을 영어 태그다. "Instrumental"을 켜고 가사는 비운다.

1. 백화점의 낮 (`sisyphus_calm`)
`instrumental, art deco department store lounge, slow noir jazz, muted piano, upright bass, brushed drums, soft vibraphone, faint chimes, polite and melancholic, 76 bpm, minor key`
2. 사냥 (`sisyphus_fight`)
`instrumental, tense dark jazz noir, pulsing bass, metallic percussion like scissors and needles, staccato strings, driving, 104 bpm, minor key`
3. 간수·신부 (`sisyphus_boss`)
`instrumental, ominous slow wordless choir pads, tolling bell, low strings, rising drones like a veil unfolding, solemn and eerie, 60 bpm`
4. 붕괴
`instrumental, collapsing building, descending bass drone, broadcast static, siren-like synth, sparse piano, dread, 50 bpm`
5. 시지프의 비 (세 가지 세기로 각각 한 곡)
- 약한 비: `instrumental, gentle rain ambience, sparse piano, soft pad, melancholic, 54 bpm, A minor`
- 중간 비: `instrumental, steady heavy rain ambience, low drone, piano and slow strings, uneasy, 54 bpm, A minor`
- 거센 비: `instrumental, storm and torrential rain, dark drones, tense strings, distant thunder, pulsing low synth, 54 bpm, A minor`
6. 외곽
`instrumental, solo piano, warm and sparse, rain far away, quiet hope, 56 bpm`

## 만든 곡을 받을 때 (다듬기·형식)
- 곡마다 **45~90초**로 자른다. 끝 2초와 시작 2초를 겹쳐 이어서(크로스페이드) 반복해도 끊기지 않게 한다. 수노의 "연장" 기능으로 같은 분위기를 이어 만들어도 된다.
- 형식은 mp3, 스테레오, 128kbps 이상이면 된다. 음량은 제가 기존 곡에 맞춰 조정한다.
- 파일 이름은 위 괄호 이름으로 저장해 보내 주면 된다(`sisyphus_calm.mp3` 등). 붕괴·비·외곽은 곡 이름만 알려 주면 된다.
- 이어서 제가 하는 일: `assets/bgm`에 두기 → 스타일 `sisyphus` 추가 → 시지프 안에서 자동 전환 → 공유 테섭에 파일로 올리기.
