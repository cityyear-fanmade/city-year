# 거미집 작업 폴더
- `request-template.md` — 다른 AI에게 보내는 원고 요청서
- 원고 조각은 `data/web/<손가락>-<disciple|master>-<번호>.json`에 두고 합친다
- 합치기: `node tools/web-merge.mjs 약지 disciple data/web/약지-제자.json data/web/조각*.json`
- 검사: `node tools/web-validate.mjs data/web/약지-제자.json` (오류가 있으면 종료 코드 1)
- 엔진 모드는 아직 없다(거미집 진입, 5턴=1해 워프열차식 턴 처리, 제자 루트 선택 시 스승 루트 닫기, 보상 수치 부여)

## 엔진 모드 (구현됨, 원고 대기 중)
- 진입: 조직 출신·보냐텔리 가문(fingerEarly) 캐릭터가 손가락에 입단하면 2년차(CFG.web.inviteYear)에 초기 제안 → 수락이면 제자 루트(disciple), 보류(한 번)·거절이면 `webDeclined`. 거절한 사람이 간부급(엄지 언더보스·검지 대행자·중지 큰형님·약지 마에스트로 증거 반지·소지 네 별)이 되면 스승 루트(master) 제안. 제자 루트를 택하면 스승 제안은 오지 않는다.
- 진행: `ch.web = {active, route, finger, turn, total, bond{신뢰·의존·존경·집착·공범}, flags, ends, end}`. 5턴=1해이고 앞의 4턴은 해가 지나지 않는 사건(`webFree`), 5번째 턴 뒤에 해가 바뀐다. 거미집 중에는 공방 거리 등 해 기반 사건이 나오지 않는다(`G.free`).
- 보상: 원고의 size → CFG.web.reward (작음 HP+3, 보통 손가락 주제 능력치 +1, 큼 +2와 HP +2). 위험한 선택(risk)은 판정(CFG.web.dc), 실패해도 인연은 오른다.
- 끝: 마지막 턴의 end로 칭호(이어진 실·각자의 길·같은 매듭·남겨진 자리·끊어낸 실)와 유물을 받고 `ch.webDone`.
- 원고를 게임에 넣기: `node tools/web-merge.mjs ...` → `data/web/<손가락>-<disciple|master>.json` → `node tools/web-build.mjs` (검수 통과분만, 작업 중이면 `--partial`)가 `data/web.json`의 parts를 채운다. 원고가 없는 손가락·루트는 제안이 나오지 않는다.

- 소지 루트는 '별에 선택받은 자'(출생 roll 50)가 정식 소지(소지 한 곳에만 섬)가 되었을 때만 열린다. 다른 출신의 소지 표식은 부가효과라 거미집과 이어지지 않는다. 초대는 정식 소지가 된 다음 해에 나오고(입단 4년차 갈림길 뒤), 스승 루트는 네 별을 모두 이은 뒤 나온다.
