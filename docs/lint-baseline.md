# ESLint 경고 기준선

- 기록일: 2026-11-20 · ESLint 10.1.0(고정) · Node 22 · 설정: `eslint.config.mjs` (권장 규칙 64개를 전부 `warn`으로, 소음이 큰 2개 규칙(`no-unused-vars`, `no-empty`)만 옵션 조정)
- 결과: **오류 0 · 경고 61** (검사 파일 27개). 아래 숫자는 `npm run lint -- -f json`의 실제 출력에서 집계한 값이다
- 의미: 경고는 개발을 막지 않는다. 이 표보다 경고가 늘면 새 코드가 만든 것인지 확인한다. 기존 경고는 자동 수정하지 않고(`--fix` 금지) 하나씩 검토해 실제 오류와 의도된 코드를 구분한다

## 규칙별

| 규칙 | 건수 |
|---|---|
| `no-unused-vars` | 28 |
| `no-dupe-keys` | 11 |
| `no-useless-assignment` | 8 |
| `no-cond-assign` | 7 |
| `preserve-caught-error` | 2 |
| `no-useless-escape` | 2 |
| `no-empty` | 1 |
| `no-constant-binary-expression` | 1 |
| `no-control-regex` | 1 |
| **합계** | **61** |

## 파일별

| 파일 | 건수 | 규칙별 내역 |
|---|---|---|
| `src/ui.js` | 36 | no-unused-vars 15, no-cond-assign 7, no-useless-assignment 5, no-dupe-keys 5, preserve-caught-error 2, no-useless-escape 1, no-constant-binary-expression 1 |
| `src/engine.js` | 20 | no-unused-vars 11, no-dupe-keys 6, no-useless-assignment 2, no-empty 1 |
| `src/bgm.js` | 2 | no-unused-vars 2 |
| `tools/i18n-ui-extract.mjs` | 2 | no-useless-escape 1, no-control-regex 1 |
| `tools/i18n-gemini.mjs` | 1 | no-useless-assignment 1 |
| **합계** | **61** | |

## 별도 검토 대상 (수정하지 않음)

`no-dupe-keys` 경고는 같은 객체에 같은 키가 두 번 있는 곳이다. 뒤에 나온 값이 앞의 값을 덮어쓴다.

| 위치 | 키 |
|---|---|
| `src/engine.js:5063` | 'offerPick'. |
| `src/engine.js:5063` | 'pickSkip'. |
| `src/engine.js:5063` | 'pickTake'. |
| `src/engine.js:5064` | 'canFound'. |
| `src/engine.js:5064` | 'egoItem'. |
| `src/engine.js:5064` | 'equip'. |
| `src/ui.js:1515` | 'finger'. |
| `src/ui.js:3607` | 'testTitles'. |
| `src/ui.js:3611` | 'testCard'. |
| `src/ui.js:3625` | 'testFight'. |
| `src/ui.js:3669` | 'testOffice'. |

- `src/engine.js`의 엔진 API 객체: 같은 이름의 축약 속성이 두 번 들어간 것으로, 값이 같아 동작에는 영향이 없다 (정리 대상)
- `src/ui.js`의 `finger:` 라벨: 문구가 서로 다른 항목이 두 번 있어 앞의 문구는 표시되지 않는다. 의도인지 확인이 필요하다
- `src/ui.js`의 시험용 훅: 같은 이름을 두 번 정의해 뒤의 정의만 동작한다. 앞의 정의는 쓰이지 않는다 (`testFight`, `testOffice`는 본문이 다름을 확인했고, `testTitles`·`testCard`는 규칙이 보고했지만 두 번째 위치는 확인하지 못했다)

## 다시 측정하는 방법

```
npm ci
npm run lint                       # 요약: 'N problems (0 errors, N warnings)'
npm run lint -- -f json -o out.json   # 규칙별·파일별 집계용 상세 출력
```

CI의 `lint` 작업은 오류가 있거나 ESLint가 실패할 때만 실패하도록 구성했다(`--max-warnings`는 쓰지 않는다). 2026-11-20 GitHub Actions 첫 실행(run 44666816474, `v8-dev`)에서 `lint`와 `check` 작업이 각각 성공했다.
