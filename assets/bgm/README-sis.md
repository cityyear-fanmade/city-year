# 시지프 전용 음악 (2026-11-19)
수노(Suno)로 만든 7곡을 `tools/sis-bgm.py`로 다듬은 것이다(끝 페이드 제거 · 끝/처음 4초 겹침으로 반복 · 음량 맞춤 · 112kbps mp3). 원본(mp4)은 저장소에 두지 않는다.

| 파일 | 원본 곡 | 쓰이는 곳 |
|---|---|---|
| sis_day.mp3 | the_empty_ballroom | 백화점의 하루(메뉴·판매·거래·평상시) |
| sis_tailor.mp3 | after_hours_fitting | 재단대 |
| sis_hunt.mp3 | weight_of_the_concrete | 일반 전투 |
| sis_velvet.mp3 | the_velvet_aisle | 4층 가구관·신발관 사냥 구간 |
| sis_corridor.mp3 | the_unmarked_corridor | 지하 2·3층 사냥 구간, 2막 64~67년차 |
| sis_boss.mp3 | weight_of_the_iron_sky | 보스 전투, 붕괴, 2막 68~72년차 |
| sis_rain.mp3 | the_weight_of_the_downpour | 2막 56~63년차·73년차 |

장면 배정은 `src/ui.js`의 `sisTrack()`에서, 원본 곡 배정은 `tools/sis-bgm.py`의 `MAP`에서 바꾼다.
