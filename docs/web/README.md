# 거미집 작업 폴더
- `request-template.md` — 다른 AI에게 보내는 원고 요청서
- 원고 조각은 `data/web/<손가락>-<disciple|master>-<번호>.json`에 두고 합친다
- 합치기: `node tools/web-merge.mjs 약지 disciple data/web/약지-제자.json data/web/조각*.json`
- 검사: `node tools/web-validate.mjs data/web/약지-제자.json` (오류가 있으면 종료 코드 1)
- 엔진 모드는 아직 없다(거미집 진입, 5턴=1해 워프열차식 턴 처리, 제자 루트 선택 시 스승 루트 닫기, 보상 수치 부여)
