/* ESLint 설정 (ESLint 10.1.0 고정 · flat config). 외부 패키지를 import하지 않고 내장 규칙 이름만 쓴다.
   방침: 처음에는 모든 규칙을 경고(warn)로 둬서 기존 코드의 진단을 기록만 하고 개발을 막지 않는다. 자동 수정(--fix)은 쓰지 않는다.
   실행: npm run lint  (npm ci 로 같은 버전을 설치한 뒤) */

/* ESLint 10.1.0의 권장(recommended) 규칙 64개 */
const RECOMMENDED = [
  'constructor-super', 'for-direction', 'getter-return', 'no-async-promise-executor', 'no-case-declarations',
  'no-class-assign', 'no-compare-neg-zero', 'no-cond-assign', 'no-const-assign', 'no-constant-binary-expression',
  'no-constant-condition', 'no-control-regex', 'no-debugger', 'no-delete-var', 'no-dupe-args', 'no-dupe-class-members',
  'no-dupe-else-if', 'no-dupe-keys', 'no-duplicate-case', 'no-empty', 'no-empty-character-class', 'no-empty-pattern',
  'no-empty-static-block', 'no-ex-assign', 'no-extra-boolean-cast', 'no-fallthrough', 'no-func-assign', 'no-global-assign',
  'no-import-assign', 'no-invalid-regexp', 'no-irregular-whitespace', 'no-loss-of-precision', 'no-misleading-character-class',
  'no-new-native-nonconstructor', 'no-nonoctal-decimal-escape', 'no-obj-calls', 'no-octal', 'no-prototype-builtins',
  'no-redeclare', 'no-regex-spaces', 'no-self-assign', 'no-setter-return', 'no-shadow-restricted-names', 'no-sparse-arrays',
  'no-this-before-super', 'no-undef', 'no-unexpected-multiline', 'no-unreachable', 'no-unsafe-finally', 'no-unsafe-negation',
  'no-unsafe-optional-chaining', 'no-unused-labels', 'no-unused-private-class-members', 'no-unused-vars', 'no-useless-backreference',
  'no-useless-catch', 'no-useless-escape', 'no-with', 'require-yield', 'use-isnan', 'valid-typeof',
  'no-unassigned-vars', 'no-useless-assignment', 'preserve-caught-error',
];

/* 전부 경고. 기존 코드에서 소음이 큰 두 규칙(`no-unused-vars`, `no-empty`)만 옵션으로 줄였다(의도된 패턴: 안 쓰는 catch 인자·함수 인자, 빈 catch) */
const rules = Object.fromEntries(RECOMMENDED.map((name) => [name, 'warn']));
rules['no-unused-vars'] = ['warn', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }];
rules['no-empty'] = ['warn', { allowEmptyCatch: true }];

const ro = (names) => Object.fromEntries(names.split(/\s+/).filter(Boolean).map((n) => [n, 'readonly']));

/* 브라우저 전역 (src/*.js) */
const browser = ro(`document window console URL setTimeout structuredClone location localStorage sessionStorage navigator
  clearInterval clearTimeout atob btoa fetch setInterval requestAnimationFrame cancelAnimationFrame NodeFilter matchMedia
  getComputedStyle history Blob MutationObserver innerWidth innerHeight TextEncoder TextDecoder File performance Image confirm
  alert prompt crypto FileReader Audio AudioContext HTMLElement Event CustomEvent KeyboardEvent Node CompressionStream
  DecompressionStream Response Request Headers self caches indexedDB IntersectionObserver ResizeObserver`);
/* Node 전역 (tools/*.mjs) */
const node = ro(`process console URL setTimeout clearTimeout setInterval clearInterval structuredClone Buffer TextEncoder
  TextDecoder performance fetch AbortController`);
/* tools/*.cjs: Node + CommonJS */
const cjs = { ...node, ...ro('require module __dirname __filename exports') };
/* Playwright의 page.evaluate()/addInitScript() 안에서 도는 코드는 페이지(브라우저) 전역을 쓴다 */
const pageEval = { ...cjs, ...ro('document localStorage CITY') };
/* 서비스 워커 (sw.js) */
const worker = ro('self caches fetch Response Request URL console clients location setTimeout');

const lang = (sourceType, globals) => ({ ecmaVersion: 'latest', sourceType, globals });

export default [
  { ignores: ['dist/**', 'assets/**', 'vendor/**', 'node_modules/**', 'index.html', '**/*.min.js', 'handoff/**', 'proto/**', 'screens/**', 'docs/**'] },
  { files: ['src/**/*.js'], languageOptions: lang('module', browser), rules },
  { files: ['tools/**/*.mjs'], languageOptions: lang('module', node), rules },
  { files: ['tools/**/*.cjs'], languageOptions: lang('commonjs', cjs), rules },
  { files: ['tools/play.cjs', 'tools/shift.cjs'], languageOptions: lang('commonjs', pageEval) },
  { files: ['sw.js'], languageOptions: lang('script', worker), rules },
];
