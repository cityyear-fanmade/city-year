#!/usr/bin/env bash
# 사용: bash copy-from-city-year.sh <도시의한해 저장소 경로>   (새 저장소 루트에서 실행)
set -e
SRC="${1:?도시의 한 해 저장소 경로를 넘겨 주세요}"
mkdir -p src data tools proto assets/character docs/character-prompts
# 규칙 엔진과 데이터 (그대로 사용, 수정은 최소로)
cp "$SRC"/src/engine.js "$SRC"/src/config.js "$SRC"/src/data-node.js src/
cp -r "$SRC"/data/*.json data/
# 도트·일러 시트(원본)와 합성 도구, 시험판
cp "$SRC"/assets/character/_src_b2_body.png "$SRC"/assets/character/_src_b2_head.png assets/character/
cp "$SRC"/assets/character/_src_dot_body_capo.png "$SRC"/assets/character/_src_dot_head_bob_short.png assets/character/
cp "$SRC"/assets/character/_ref_dnf_illust_capo.png assets/character/
cp "$SRC"/tools/char-compose.py "$SRC"/tools/char-proto-build.py tools/
cp "$SRC"/proto/char-test.tpl.html proto/
# 문서
cp "$SRC"/docs/art-direction.md "$SRC"/docs/player-appearance.md docs/
cp "$SRC"/docs/character-prompts/gpt/*.md docs/character-prompts/
echo "복사 완료. 다음: python3 tools/char-proto-build.py 로 시험판을 만들어 확인하세요."
