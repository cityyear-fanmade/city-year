# 도시의 한 해 · 작업 가이드 (Claude Code)

프로젝트 문 세계관 팬메이드 텍스트 TRPG. 순수 ES 모듈, 빌드 도구 없음.

## 구조
- `src/engine.js` 게임 규칙 (createEngine(D)) · `src/ui.js` 화면 · `src/config.js` 수치(CFG)
- `data/*.json` 카드·적·사건·출생·공방·손가락·문구
- `css/style.css` · `tools/guide.mjs` → `docs/guide.md` 생성

## 명령
- `npm run -s check` 데이터 참조 검사 + 4000판 시뮬 (매 변경 후 필수)
- `npm run -s pages` 루트 `index.html` 생성 (GitHub Pages 본섭)
- `npm run -s build` → `dist/city-year.html` (테섭용 단일 파일)
- `node tools/guide.mjs` 가이드 문서 갱신
- 화면 확인: Playwright (`NODE_PATH=$(npm root -g)`), 테스트 훅은 `window.CITY.test*` (ui.js 맨 아래)

## 브랜치
- `main` = 본섭 (GitHub Pages). `season6-dev` = 테섭·개발용
- 소폭 조정은 main에 바로. 큰 변경은 season6-dev → 테섭 확인 → 사용자가 "본섭 올려"라고 하면 main에 ff 병합

## 사용자 규칙
- 본섭 올리기: 사용자가 "본섭 올려"라고 해도 바로 올리지 않는다. 먼저 "지금 본섭 후보는 이정도 있습니다"로 항목 목록(미정·테스트 중인 것은 따로 표시)을 알리고, 사용자가 올릴 항목을 확인한 뒤에만 올린다
- 공지(NOTICE id, ui.js)는 사용자가 "공지"라고 할 때만 바꾼다
- 히든 요소(숨은 출생·히든 보스·전용 카드)는 공지·업데이트 내역에 자세히 쓰지 않는다
- 무기만 조정할 때 카드는 건드리지 않는다 · 세계관 고증이 불확실한 이름은 확인 요청
- 매 답변 끝에 토큰 사용량을 한 줄로 보고
- 토큰 절약: 긴 파일(engine.js, ui.js는 한 줄이 김)은 grep/부분 읽기, 스크린샷·시뮬은 꼭 필요할 때만

## 밸런스 기준 (무기 비교: 25년차 새 캐릭터, 중후반 강적 6종)
- 명장 대검 15% · 일반 히든 무기 24~36% · 발톱 62%·조율자 45%(일부러 강함) · ALEPH(미미크리·다 카포)·돌네시아 45~46%
- 히든 보스는 자동 전투로 거의 0~5% (의도)
