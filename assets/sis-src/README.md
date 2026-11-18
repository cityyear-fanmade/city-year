# 시지프 재단대 이미지 원본 보관
ChatGPT에서 받은 **원본 파일 그대로**(해상도·색·배경 변경 없음)를 에셋 ID 이름으로 둔다. 게임용 파일은 `tools/sis-worn.py`로 여기서 만들어 `assets/sis/`에 둔다.

| 에셋 ID | 원본 파일 | 비고 |
|---|---|---|
| sis_w_suit | sis_w_suit.png | 1254×1254 |
| sis_w_coat | sis_w_coat.png | 1254×1254 |
| sis_w_gala | sis_w_gala.png | 1254×1254 |
| sis_w_cloak | sis_w_cloak.png | 1254×1254 (황금가죽 망토) |
| sis_w_shroud | sis_w_shroud.png | 1254×1254 (휘감은 천 상의) |
| sis_w_daily | sis_w_daily.webp | 전달받은 형식이 webp라 그대로 둔다(PNG 변환본은 `tools/sis-worn.py` 입력용) |

## 남성형 (2026-11-18 전달)
| 에셋 ID | 원본 파일 | 비고 |
|---|---|---|
| sis_w_m_coat | sis_w_m_coat.webp | 1086×1448, 외투 |
| sis_w_m_suit | sis_w_m_suit.webp | 1086×1448, 정장 재킷(초록 배경) |
| sis_w_m_suit_whitebg | sis_w_m_suit_whitebg.webp | 정장 재킷의 흰 배경 버전(초록 배경이 아니라 게임에는 쓰지 않음) |
| sis_w_m_shroud | sis_w_m_shroud.webp | 1086×1448, 휘감은 천 상의 |
| sis_w_m_gala | sis_w_m_gala.webp | 1086×1448, 예복 |
| sis_w_m_daily | (아직 없음) | 셔츠 |

## 배경 (2026-11-18, v2 프롬프트)
| 에셋 ID | 크기 | 비고 |
|---|---|---|
| sis_bg_pc_rouge / pc_noir / pc_kaki | 1670×941 | PC 좌우 장식 |
| sis_bg_m_rouge / m_noir | 941×1672 | 모바일 위·아래 장식 |
| sis_bg_m_kaki | 941×1672 | 모바일 카키 (2026-11-18 전달) |

## 장면·타일 (2026-11-18, 두 번째 전달분 · 아직 게임에 연결하지 않음)
| 에셋 ID | 크기 | 비고 |
|---|---|---|
| sis_scene_b1 | 1672×941 | 지하 1층 푸드코트 장면 |
| sis_scene_f1 | 1672×941 | 1층 매장 장면 |
| sis_tile_kaki / sis_tile_noir / sis_tile_rouge | 1254×1254 | 반복 타일(아치 무늬, 소속별 색) |
참고: 앞서 보내신 다른 구도의 장면·타일(부채꼴 격자)은 파일이 첨부되지 않아 저장하지 못했다.

## 장면 추가 (2026-11-18, 세 번째 전달분 · 연결됨)
| 에셋 ID | 크기 | 비고 |
|---|---|---|
| sis_scene_b2 | 1672×941 | 지하 2층 방적장·염색실 |
| sis_scene_b3 | 1672×941 | 지하 3층 가죽실·수선실(게임에 사용) |
| sis_scene_b3_alt | 1672×941 | 지하 3층 다른 안(미사용, 보관) |
| sis_scene_f4 | 1672×941 | 4층 가구관·신발관 |
| sis_scene_f5 | 1672×941 | 5~6층 식탁 층 |
