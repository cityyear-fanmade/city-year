# 전투용 도트 시트 프롬프트 (B: 중간 도트 · 높이 80칸 · 20색 이하)

2026-11-08 확정 방향: 전신 일러(상태창·외형 바꾸기)와 전투용 도트(전투 무대)를 나눈다.
도트는 **몸 시트 + 머리 시트** 두 장으로 받아 코드에서 합성한다(머리색은 회색 머리카락에 색을 입힌다).
처음 시험: 엄지 · 카포 한 벌, 머리 2종(단발·숏컷). 잘되면 직급·소속을 늘린다.

공통 규칙(두 프롬프트 모두): 배경 순수 초록(#00FF00) · 오른쪽을 바라봄 · 도트 하나가 또렷이 보이게(부드럽게 뭉개지 말 것) · 색 20개 이하 · 검은 1칸 윤곽선 · 모든 칸 같은 크기 · 발바닥 높이 맞춤 · 무기·이펙트 없음(코드에서 넣는다).

---

## ① 몸 시트 (머리 없음)

아래 전체를 GPT에 붙여 넣는다. 첨부: 엄지 카포 전신 일러(기준 옷·색), 보내준 도트 시트(느낌 참고).

```
Create a pixel-art battle sprite sheet of ONE character, BODY ONLY (no head).

STYLE
- Chibi RPG battle sprite, true pixel art: every pixel clearly visible, hard edges, NO anti-aliasing, NO blur, NO gradients, NO dithering.
- The character is 80 pixels tall (feet to the top of the magenta head circle) on a logical pixel grid, then scaled up by exactly 6x so each pixel is a crisp 6x6 block.
- Maximum 20 colors in the whole sheet. 1-pixel dark outline around the character.
- Side view, character faces RIGHT. Weapon-free: empty hands (fists). No effects, no motion lines, no shadows, no text.
- Outfit (reference image attached): black pinstripe three-piece suit, red tie, brown belt with gold buckle, black gloves, brown boots, long dark-red coat with gold trim worn open and hanging behind the shoulders. Keep the red coat + gold trim readable even at this size (simplify details into a few clear pixels, keep the coat's silhouette).

HEAD ANCHOR (very important)
- NO head. Where the head would be, draw ONE solid pure magenta circle (#FF00FF), flat color, no outline, diameter = 24 pixels (30% of the body height).
- The magenta circle must sit on the neck in every frame and move with the body (lean back when hit, tilt when falling).

BACKGROUND
- Perfectly flat pure green #00FF00, no ground, no shadow, nothing else.

SHEET LAYOUT (5 rows, one pose per row, frames left to right)
Every cell is the same size (160x160 logical pixels), the character's feet touch the same bottom line (except the lying-down frames, which rest on that line). Leave 8 pixels of empty margin between cells.
Row 1  IDLE (loop), 4 frames: gentle breathing, coat hem sways 1 pixel, body bobs 1 pixel.
Row 2  ATTACK (melee punch/strike), 4 frames: 1 ready crouch, 2 wind-up leaning back with right arm pulled back, 3 lunge forward with right arm fully extended (body leans forward, one foot far forward), 4 recover to standing.
Row 3  DODGE, 3 frames: 1 start, 2 leaning back and stepping away with coat flaring forward, 3 return.
Row 4  HIT, 3 frames: 1 flinch (body jerks back, shoulders raised), 2 strongest recoil (leaning far back, one foot lifting), 3 recover.
Row 5  DOWN (defeated), 4 frames: 1 stagger, 2 knees buckle, 3 falling backwards, 4 lying flat on the ground (body horizontal, magenta circle at the left end).

Do not add any labels, borders, grid lines, numbers or watermarks. Same character proportions in every frame.
```

---

## ② 머리 시트 (단발 · 숏컷)

몸 시트가 마음에 들면 보낸다. 첨부: 지금까지 쓰던 머리 시트(단발·숏컷) + 몸 시트 한 장.

```
Create a pixel-art HEAD sprite sheet to be placed on the magenta circle of the attached body sheet.

STYLE: same as the attached body sheet (true pixel art, 6x scale, hard edges, no anti-aliasing, 1-pixel dark outline, flat pure green #00FF00 background, character faces RIGHT).
Each head is about 24 pixels wide, same scale as the body sheet.

COLOR RULES (important, the game recolors these):
- Hair: ONLY shades of neutral gray (4 steps: dark, mid, light, highlight), no color tint. Gray hair, not white.
- Eyes: ONLY one single saturated cyan (#00C8FF) pixel group per eye, nothing else cyan on the head.
- Skin: pale peach. Ear with a small gold earring (gold = the same gold as the outfit).

TWO HAIR SHAPES (two rows)
Row A  BOB (chin-length bob, bangs over one eye).
Row B  SHORT (short messy spiky cut with one tuft sticking up).

EACH ROW has 5 head poses in this order:
1 IDLE (calm, facing right, neutral mouth)
2 ATTACK (leaning forward, determined eyes, mouth slightly open)
3 DODGE (face turned slightly away, eyes narrowed)
4 HIT (eyes shut tight, teeth clenched, head thrown back)
5 DOWN (eyes closed, head tilted on its side, resting, calm)

Every cell the same size, the chin line at the same height in poses 1-4, no neck (the body already has the neck), nothing else in the image, no labels or borders.
```

---

## 받은 뒤 처리 (Claude가 할 일)
1. 초록 제거 · 칸 자르기 · 마젠타 원 중심·지름을 프레임마다 읽기(기존 `tools/char-cut.py`, `tools/char-compose.py` 방식).
2. 머리를 마젠타 원 자리에 합성, 회색 머리 → 선택한 머리색, 청록 눈 → 선택한 눈색.
3. 시험판(`proto/char-test.html`)의 전투 무대에 연결: 대기 루프, 공격·회피·피격·쓰러짐 프레임 재생.
