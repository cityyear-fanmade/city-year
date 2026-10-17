/* 임시 수치: 밸런스는 여기만 바꾼다. `npm run sim`으로 확인한다. */
export const CFG = {
  /* 피해 주사위 최소값: 장비(최댓값) + 재능·성장기의 '+1'(겹치면 더해짐), 합계는 dminCap까지 */
  dminCap: 4,
  /* 의견·버그 제보 구글 폼 (시작 화면 링크) */
  feedbackUrl: 'https://forms.gle/FYsYb2itq3LyUXrs9',
  /* 캐릭터 */
  baseHp: 60,
  /* 전투: 빛(코스트), 손패, 키워드 */
  light: 3, lightMax: 5, hand: 4, stackCap: 10,
  /* 이름 입력 칸(특이점·E.G.O·뒤틀림·사무소·날개·특색)의 최대 글자 수 (특색은 2글자부터) */
  nameMax: 12,
  breathCritPer: 5, critMult: 1.5,
  /* 호흡(v6.1): 최대 cap. 타격마다 소모되지 않고 라운드가 바뀔 때 decay씩 줄어든다.
     치명 확률: 호흡 sure 이상 100%, from~sure-1은 base%에서 step%씩 올라 90%, 1~evaMax는 치명 없이 회피 +eva. 환도 배수는 호흡 hwandoCap까지만 반영 */
  breath: {cap: 12, decay: 2, sure: 10, from: 4, base: 20, step: 14, evaMax: 3, eva: 5, hwandoCap: 10},
  /* 방어 카드를 내면 자기 출혈·파열이 이 비율로 남는다 (내림, 적도 같음) */
  defCut: {bleed: 0.75, rupture: 0.75},
  /* 암시장 응급 카드: 방문마다 chance% 확률로 진열, 덱·카드함·제안 합쳐 최대 max장 */
  /* 공방 치유소: 한 번에 hp 회복, 방문마다 max번 */
  /* 치유소: 치료를 받을 때마다 값이 step씩 오른다 (한 판 전체 누적, 방문마다 최대 max번) */
  clinic: {price: 500, step: 500, hp: 30, max: 3},
  /* 암시장 K사 엠플: 전투 중 HP가 최대 HP의 belowPct 이하가 되면 자동으로 heal 회복(전투당 사용 횟수 제한 없음, 한 번에 1개). 값은 항상 price, carry개까지 지니고 한 판에 limit개까지만 살 수 있다 */
  ample: {name: 'K사 엠플', price: 5000, carry: 3, limit: 5, belowPct: 0.2, heal: 50},
  blackAid: {chance: 10, max: 3, price: {bm_firstaid: 500, bm_measure: 500}},
  /* 순서: 1등 빛 보너스, 꼴등 추격 보정, 선제 격차와 명중 보너스 */
  orderBonusLight: 1, catchupBonus: 5, spdMul: 2, spdHit: {per: 5, max: 4}, gapFirst: 30, firstHit: 10,
  /* 방어 카드 기본 회피 보너스 */
  defBonus: 15,
  /* 방어 자세(아무 카드도 내지 않은 라운드): 적 공격을 방어로 받는다.
     막으면 피해 guardHit, 못 막으면 피해 × guardFailMul(올림).
     다음 라운드 내 카드 명중 +nextHit, 그 전투 동안 빛과 빛 최대치 +lightUp (최대 lightUpMax) */
  /* lightNext: 다음 1라운드만 받는 빛 (lightUp 대신 쓰면 덜 강하다: 다음 라운드만 +2면 보스 승률 47% vs 안 넘김 51%) */
  guard: {bleedCut: 0.5, guardHit: 1, guardFailMul: 0.5, nextHit: 5, lightUp: 0, lightUpMax: 1, lightNext: 2},
  /* 적 방어 카드: 손에 남길 확률(%). 직전 라운드에 썼으면 이번 라운드는 쓰지 않는다 (100이면 예전처럼 거의 매번) */
  enemyGuard: {chance: 40},
  /* 적의 회피 주사위 크기(단계별). 초반 전투를 짧게: 초반 1d50, 중반 1d75, 보스·히든은 1d100 */
  enemyEvadeDie: {early: 50, mid: 75},
  /* 진행: 연수, 시작 나이, 해마다·승리 후·연속 전투 시뮬 회복량 */
  years: 55, startAge: 17, yearHeal: 9, winHeal: 11, chainHeal: 14,
  /* 특색: 이 급수에 오르면 특색 심사 사건이 한 번 열린다. 1d100 + 판정 보정 ≥ colorDc면 특색, 실패하면 그 판에서는 다시 기회가 없다 */
  colorRank: 1, colorDc: 90, topDc: 90,
  /* 승급 포인트와 승급 심사. 필요량: base, 그다음 단계마다 이전 필요량 × mult[i] (마지막 값이 계속 쓰인다).
     심사 실패 시 포인트의 loseFrac를 잃는다. 심사 난이도 = examDc + examDcStep × 지금까지 승급 횟수 */
  promo: {total: 192, fixerMul: 0.87, mult: [2, 1.4, 1.2, 1.1], loseFrac: 0.25, gain: {early: 3, mid: 4, late: 5, boss: 6, hidden: 10, check: 2, year: 2}, examDc: 40, examDcSpan: 15},
  /* 연차가 쌓일수록 일반 적이 강해진다: from년차 뒤 해마다 HP +hpPerYear 배, atkEvery년마다 공격·회피 +1 */
  enemyScale: {hpMul: 0.78, from: 8, hpPerYear: 0.035, atkEvery: 2},
  /* 히든 보스(발톱·조율자·도서관 등): 데이터 수치에 체력 배수와 공격·회피 가산 */
  hidden: {hpMul: 2.7, atk: 2, minHp: 30, winHeal: 15},
  /* minHp: 히든 보스 전투를 시작할 때 체력이 이보다 낮으면 여기까지 채운다. winHeal: 히든 보스를 이기면 평소 승리 회복에 더해 회복 */
  /* 히든 보스 후반 보정: from년차부터 해마다 체력 +hpPerYear, atkEvery년마다 공격 +1 (40년차 +30 · +5) */
  hiddenLate: {from: 25, hpPerYear: 3.6, atkEvery: 3},
  /* 무한런: years년 엔딩 뒤 이어서 산다. span년마다 위협 등급이 하나 오르고 그 끝에 등급 전투.
     등급 g(0부터)의 적: 체력 ×(1 + hpMul×(g+1)), 공격 +atk×(g+1). 마지막 등급 전투를 이기면 진엔딩 */
  /* 하드 난이도: 태어나기 전에 고른다. 모든 적 체력 ×hp, 공격 +atk, 회피 +eva (히든 보스·무한런 포함) */
  hard: {hp: 1.5, atk: 4, eva: 3},
  /* 쉬움: 적에게 붙는 보정을 거의 없애 처음 설정한 약한 수치에 가깝게 한다.
     grow 해마다 늘어나는 체력·공격·회피 ×, late 히든 보스 후반 성장 ×, endless 무한런 등급 보정 ×, hidden 히든 보스 체력 배수 ×, bossHard 보스별 난이도 보정(hard)의 세기 ×, hp 모든 적 체력 ×, atkMinus 모든 적 공격 − */
  easy: {grow: 0, late: 0, endless: 0.5, hidden: 0.2, bossHard: 0, hp: 0.6, atkMinus: 0, hiddenMin: 70, boss: {impurity: 2.5}},
  endless: {span: 3, grades: ['도시 괴담', '도시 전설', '도시 질병', '도시 악몽', '도시의 별', '발톱과 조율자'], hpMul: 0.08, atk: 1, star: 'pianist', final: 'impurity', finalFirst: 'baral', finalNext: 'zena'},
  /* 제 2막 무한 모드: 마지막 등급(불순물)을 넘기면 열린다. 위협 보정이 끝없이 오르고, every년마다 강화된 불순물이 나타난다
     (강화 1회당 체력 ×(1+impPer), 공격 +impAtk). 확률이 있는 히든 보스는 hiddenAdd%만큼 더 자주 나오고,
     전투가 있는 해마다 crack% 확률로 '세계의 균열'이 열려 조건과 상관없이 아직 이기지 못한 히든 보스 중 무엇이든 나타난다.
     erodeFrom년을 넘기면 전투 라운드마다 (연차 − erodeFrom) × erodePer의 고정 피해(회피·보호막 무시)가 플레이어에게 들어간다.
     스탯만으로는 버틸 수 없게 하는 제동이다. 위협 등급이 한 단계(3년) 오를 때마다 모든 적의 체력 ×(1+hpGrow), 공격 +atkGrow, 회피 +evaGrow가 복리로 쌓여 결국 아무도 버티지 못한다 */
  /* 무한 모드에서 이 나이를 넘기면 히든 엔딩(계속 살아갈 수 있다) */
  oldAge: 100,
  /* 사건 판정 주사위 최대치(플레이어): 타고난 것 등으로 아무리 커져도 이 값에서 멈춘다 */
  checkMax: 220,
  infinite: {erodeFrom: 90, erodePer: 0.5, enemyMax: 260, every: 8, impPer: 0.15, impAtk: 2, hiddenAdd: 30, crack: 40, hpGrow: 0.02, atkGrow: 1, evaGrow: 0.5},
  /* 정신력: 최대 max. healEvery년마다 +yearHeal. 선택지·환상체 조우 2d3 감소, 회피 실패 시 1d evadeDie에서 1이면 1 감소(E.G.O 장비 1개당 +1).
     voiceAt 이하에서 한 번 "들리는 목소리": 1d voiceDie를 voiceRolls번, 모두 voiceDc 이상이면 개화, 실패하면 1d failLoss 감소.
     0이면 사망, 1이면 뒤틀림 판정 1d2 (1이면 개화하고 가득 회복, 2면 뒤틀림 엔딩). tiers: 전투 시작 때 호흡·회피 보정 */
  mind: {max: 45, yearHeal: 1, healEvery: 2, voiceAt: 10, voiceDie: 50, voiceDc: 14, voiceRolls: 3, failLoss: 9, evadeDie: 5,
    stat: {at: [20, 25, 30, 35, 40, 45]},
    tiers: [{at: 40, breath: 5, eva: 5}, {at: 32, breath: 4, eva: 4}, {at: 26, breath: 3, eva: 3}, {at: 20, breath: 2, eva: 2}, {at: 15, breath: 1, eva: 1}, {at: 11, breath: 1, eva: 0}],
    ego: {atk: {n: '공격용', hit: 14, floor: 20, card: 'e_bloom_atk'}, def: {n: '방어용', hp: 45, eva: 3, floor: 11, card: 'e_bloom_def'}},
    /* 개화한 E.G.O를 가지면: 덱 최대 장수 +deckPlus (고정 전용 카드가 그 자리), 전투 처음 lightRounds라운드 동안 빛 +light */
    deckPlus: 2, light: 1, lightRounds: 3},
  /* 공방 거리: 1년차부터 every년마다 들를지 묻는다(해는 넘어가지 않음). blackFrom년차부터 암시장 물건 blackStock개 진열 */
  /* 육신 뒤틀림: 장비를 쓸 수 없고(전부 보관함), 상대에게 디버프를 걸 수 없다. 깡 능력치가 크게 오르고 덱은 뒤틀린 책장(도박 카드 12장, 빛 없음)으로 고정 */
  distort: {fx: {maxHp: 40, atk: 6, eva: 0, spd: 0}, deck: ['d_jackpot', 'd_jackpot', 'd_jackpot', 'd_rend', 'd_rend', 'd_rend', 'd_maw', 'd_maw', 'd_thrash', 'd_thrash', 'd_coin', 'd_curl']},
  shop: {every: 3, blackFrom: 12, blackStock: 3, delCost: 500, delMax: 3, minDeck: 4, restMind: 5,
    /* v6.1: 카드 교환(덱 카드 1장을 일반 보상 카드 무작위 1장으로, 방문마다 swapMax장까지) · 장비 정비(장착 장비마다 최대 tune.max번 시도, chance% 확률로 공격 또는 회피 +1, 시도 비용 base+step×지금까지 시도) */
    swapCost: 500, swapMax: 3, tune: {max: 5, chance: 50, base: 300, step: 150}},
  /* 타고난 것: 출생 굴림과 별개로 1/chanceDiv 확률. 시드 재현을 위해 출생 굴림 값에서 파생 (새 주사위를 쓰지 않는다) */
  innate: {chanceDiv: 100, growMul: 1.2, money: 1.2, intuitionDie: 20, psycho: 2, markYear: 30, markMul: 1.6, miracleEvery: 10, miracleDie: 5},
  /* 카드 등급: 연차가 쌓이면 내 공격 카드가 강해진다 (from년차부터). 적중마다 피해 +b, 명중 +hit, 주사위 +dice개 */
  cardGrade: [{from: 1, n: '', b: 0, hit: 0, dice: 0}, {from: 16, n: '+1', b: 2, hit: 5, dice: 0}, {from: 31, n: '+2', b: 3, hit: 10, dice: 1}, {from: 46, n: '+3', b: 5, hit: 15, dice: 1}],
  /* 잊힌 유물: year년차가 시작될 때 반드시 나오는 사건. 1d100에서 chance 이하면 유물 선택 */
  /* 6시즌: 덱 최대 장수, 암시장 카드 상자(확률·가격) */
  /* 덱 보정: from장 이상부터 per장마다 공격 +atk (6장 +2, 8장 +4, 10장 +6, 12장 +8). 덱을 압축한 쪽과 꽉 채운 쪽의 격차를 줄인다 */
  deck: {max: 12, bonus: {from: 6, per: 2, atk: 2}},
  blackCard: {chance: 50, price: 250},
  /* 6시즌 사무소: 개설 가능 급수(이상), 개설 사건을 다시 묻는 간격, 소속 없는 해결사가 사무소 문을 두드리는 간격 */
  /* 6시즌 E.G.O 발현자: 전용 카드 '발현'을 낸 누적 횟수(need)가 차는 순간 E.G.O 무기 등급이 오른다. 등급별 수치는 birth.json egoWeapons[].grow */
  egoGrow: {need: [0, 5, 15, 30], tier: ['TETH', 'HE', 'WAW', 'ALEPH']},
  /* 6시즌 새 시리즈: 격리 실패로 birds를 모두 이기면 '종말의 예언'(flag)을 얻고 종말새와 싸우러 갈 수 있다.
     birds 중 하나라도 이긴 뒤에는 격리 실패가 남은 새를 pref% 확률로 먼저 고른다 */
  apoc: {birds: ['bigbird', 'punishbird', 'judgebird'], flag: 'prophecy', pref: 60},
  /* 마법소녀 4종을 모두 이기면 '허무의 도래' 플래그 → gap년 뒤부터 히든 보스 허무의 광대 (불길한 예감, 피할 수 있음) (마법소녀를 한 마리 이길 때마다 격리 실패에서 남은 마법소녀를 먼저 만날 확률 pref[이긴 수]%) */
  mgirl: {ids: ['queenhate', 'kinggreed', 'servantwrath', 'knight'], flag: 'nihil', pref: [0, 40, 55, 70], boss: 'jester', gap: 3},
  /* 6시즌 기업 루트(날개 직원): from년차부터 해마다 chance% 확률로 '특이점 개발' 제안이 한 번 온다.
     개발(devMax번 진척) → 날개 설립(이름) → 특이점 실험(강화 upMax번)·금기 실험. 금기 실험을 forbMax번 하면 머리의 시험(chain: 발톱 → 조율자 연속 전투).
     types: 특이점 효과. base는 고를 때, per는 강화 한 번마다 (warp.lead: 전투 처음 N라운드 항상 선공, serum.heal: 라운드마다 회복, moon.tier: 정신력 구간 보정 배수)
     trial: 머리의 시험 전투(상대별)에서 체력 배수·공격 가산. grow/up/forb/clear: 개발 진척·강화·금기 실험·시험 통과 때 얻는 능력치 */
  corp: {from: 20, chance: 20, devMax: 2, devGap: 2, devChance: 60, labGap: 1, labChance: 80, upMax: 3, forbMax: 8, chain: ['claw', 'arbiter'],
    types: {
      warp: {n: '워프', e: '속도 +4 · 사건 판정 +3 · 전투 처음 3라운드 항상 선공 (강화마다 속도 +2 · 판정 +2 · 선공 1라운드 더)', base: {spd: 4, check: 3}, per: {spd: 2, check: 2}, lead: 3, leadPer: 1},
      serum: {n: '혈청', e: '전투 중 매 라운드 시작에 HP 5 회복', heal: 5, per: 0},
      moon: {n: '월광석', e: '최대 정신력 +8 · 해마다 정신력 +2 · 회피 실패로 정신력이 깎이지 않는다 · 정신력 구간 보정 ×1.6 (강화마다 최대 정신력 +2 · 해마다 +1 · 보정 +0.2배)', base: {mindMax: 8}, per: {mindMax: 2}, year: 2, yearPer: 1, tier: 1.6, tierPer: 0.2}
    },
    trial: {claw: {hp: 1, atk: 0}, arbiter: {hp: 1, atk: 0}}, grow: {maxHp: 3}, up: {maxHp: 8, atk: 2}, forb: {maxHp: 5, atk: 2, eva: 1}, clear: {maxHp: 15, atk: 3, eva: 2}},
  /* 도서관 관장을 쓰러뜨리면 붉은 안개의 책 연계 퀘스트: 얻은 뒤 every년마다 책이 요동치고, 펼쳐서 붉은 안개를 쓰러뜨리면 끝난다 */
  redBook: {every: 3},
  /* 붉은 안개 전용 카드팩 패시브: 적을 쓰러뜨리면 HP heal 회복 */
  redMist: {heal: 40},
  /* 오늘의 시드로 시작하면 출신 굴림을 이 숫자로 고정한다 (null이면 시드 그대로). 1 = 혈귀 */
  dailyOrigin: 1,
  /* 날짜별 오늘의 시드 지정 (한국 시간 기준 날짜): origin = 출신 굴림(80 = 동부 출신 외곽 생존자), innate = 타고난 것 */
  dailyPlan: {'2026-10-15': {origin: 80, innate: 'mark'}, '2026-10-16': {origin: 20, innate: 'growth'}, '2026-10-17': {origin: 1, innate: 'psycho'}},
  /* 혈귀 1권속 카드팩 패시브 '오랜 굶주림': HP를 회복할 때마다 HP 1당 스택 +1(최대 max). 공격 카드를 내면 스택을 모두 써서 그 카드의 첫 적중 피해가 스택만큼 늘고, 스택은 비운다 */
  hunger: {max: 15},
  /* 일상 사건: from년차부터 사건이 있는 해에 chance% 확률로 일상이 온다 (선택지 3개 중 능력치 +1~3 하나, 판당 max번). 인연이 없는 소속 캐릭터는 일상 중 meetChance%가 인연(조우자)을 만나는 사건이 된다 */
  daily: {from: 3, chance: 30, max: 10},
  /* 인연(동반자) 시스템: 일상 중에 인연을 만난다(혈귀·동부 외곽 출신은 전용 인연). 이름을 붙이면 gap[0]~gap[1]년마다 사건이 steps번,
     그다음 청혼 사건. 청혼은 die면 굴려 ok 안에 들면 성공(결혼), 기회는 tries번. 결혼하면 marry 보정, 해마다 yearMind 정신력, 정신력이 1이 되면 한 번 saveMind로 붙잡아 준다.
     기회를 모두 쓰면 인연이 끝나고 최대 정신력이 lossMind 줄어든다 (영구) */
  /* 외곽 동행 의뢰(무한 모드 2막 이후): 결혼한 배우자와 gap년 간격으로 chance% 확률로 함께 외곽 의뢰를 나선다. 배우자 소속에 따라
     전투형(협공: 라운드마다 base+per×급수+1d(rand)−1 고정 피해) · 비전투형(지원: 라운드마다 보호막·HP 회복) · 수비형(첫 피격마다 cut% 줄이고 반격) */
  escort: {chance: 35, gap: 6, money: 300, moneyPer: 100,
    kinds: {fighter: ['hyeolgwi', 'east', 'highfixer', 'blade', 'awl', 'ring', 'kuro', 'finger'], support: ['office', 'assoc', 'wing', 'pointer'], guard: ['thumb', 'middle']},
    fighter: {base: 6, per: 2, rand: 4}, support: {shield: 12, shieldPer: 4, heal: 4, healPer: 1}, guard: {cut: 35, cutPer: 4, cutMax: 70, counter: 5, counterPer: 2}},
  bond: {sweetEvery: 7, sweetEvery2: 12, routes: ['office', 'assoc', 'wing', 'finger', 'thumb', 'pointer', 'middle', 'ring', 'kuro', 'blade', 'awl'], from: 8, meetChance: 35, gap: [3, 4], steps: 3, die: 4, ok: [3, 4], tries: 2, waitDc: 40,
    marry: {maxHp: 8, mindMax: 6, check: 2}, yearMind: 1, saveMind: 10, lossMind: 5, leaveMind: 2, loveMind: 2,
    /* 결혼 뒤: 금기를 저지른 다음 해부터 해마다 dieChance% 배우자가 세상을 떠난다(최대 정신력 −lossMind). 아이: kid.from년 뒤부터 해마다 chance%, 최대 max명, 간격 gap년, 태어나면 최대 정신력 +mind. adult살이 되면 사무소·해결사·협회 중 한 곳에 들어간다 */
    /* 히든 인연(상대가 처음부터 2~1급 해결사): 해결사 등록자가 rank급 이하일 때 만남이 열리면 chance% 확률로 이 길이 된다 */
    hidden: {rank: 3, chance: 12},
    /* 인연과 함께 싸우는 보스: 라운드마다 인연이 추가 공격 (고정 피해 base + per×배우자 급수 레벨, ±3) */
    ally: {base: 8, per: 2}, allyDice: 0.75, allyHit: 10,
    dieChance: 2, riskStep: 0.1, kid: {from: 5, chance: 22, max: 2, gap: 3, mind: 2, adult: 20},
    /* 뒤틀린 뒤: 성인이 된 아이가 있으면 gap년마다 chance%로 토벌 의뢰가 온다. 여럿이면 가장 강한 아이(등급)가 온다. 등급 = 20세 이후 2년마다 +1(최대 8) + 직업 가산 */
    hunt: {gap: 3, chance: 45, years: 2, job: {office: 0, assoc: 1, fixer: 2}, hp: 10, atk: 1, eva: 1, spd: 1, mul: 1.1, mulTop: 1.5, topLv: 8,
      /* 배우자 급수: 만난 루트별 시작 level + 결혼 spouseYears년마다 +1 (최대 8) */
      spouse: {office: 0, assoc: 1, wing: 1, finger: 2, thumb: 2, pointer: 2, middle: 2, ring: 2, kuro: 2, blade: 2, awl: 2, hyeolgwi: 3, east: 1, highfixer: 7}, spouseYears: 3, spouseJob: {office: 'office', assoc: 'assoc', wing: 'assoc', finger: 'fixer', thumb: 'fixer', pointer: 'fixer', middle: 'fixer', ring: 'fixer', kuro: 'fixer', blade: 'fixer', awl: 'fixer', hyeolgwi: 'fixer', east: 'fixer', highfixer: 'fixer'}}},
  /* 보호막은 몇 장을 쌓아도 이 값을 넘지 않는다 (혈갑처럼 0코스트로 쌓는 카드가 최대 체력보다 많은 보호막을 만들던 문제) */
  shieldCap: 150,
  /* 검지 히든 직업 신탁대행자: 최종 서열 뒤 해마다 chance%로 단말기 사건, tries번 기회, 줍기는 1d100 ≥ dc. 지령 스택 최대 presc, 지령 미수행 시 다음 라운드 명중 −missHit · 회피 −missEva */
  /* 조직: 덱이 at[0](8)장 이상일 때 패시브가 열리고(그 아래로 압축하면 닫힌다), at[1](10)장에서 최종 단계가 된다. 흑운회: 시작 구름 start[단계] · max에 닿으면 흑운(주사위마다 +die · 적중 출혈 +bleedPlus · 마지막 단계에서 받는 피해 ×half) · 라운드 끝에 구름 reset.
     검계: 라운드 시작 호흡 +1(8장부터 +2) · 호흡 자연 감소 decay[단계] · 호흡 2당 모든 카드 +1. 밤의 송곳: 속도 굴림 +init[단계] · 출혈 걸린 적에게 명중 +bleedHit · 선공이면 상대 회피 절반 */
  /* 조직 루트: 엄지 전향 제안(흑운회·밤의 송곳의 최고 서열) → 몇 해 뒤 숙청 소문 → 반역하면 엄지의 대모 · 검계 최고 서열 → 뒤틀린 쥰 → 역적 → S사 절도사 */
  synRoute: {offerChance: 55, purgeGap: 3, fleeHp: 6},
  /* 무한 모드 추가 엔딩(죽는 것 말고): 외곽 괴수 sealBeasts마리를 쓰러뜨리면 균열이 닫힌다 · 히든 보스 starHidden마리를 이기면 별 · 가족이 있고 무한 모드 settleYears년이 지나면 정착. 각각 한 번, 끝낸 뒤에도 이어서 살 수 있다 */
  outEnds: {sealBeasts: 3, starHidden: 16, settleYears: 12},
  syn: {at: [8, 10],
    '흑운회': {key: 'kuro', start: [1, 2, 3, 4], max: 5, reset: 2, die: 2, bleedPlus: 1, half: 0.5},
    '검계': {key: 'blade', decay: [2, 1, 1, 0], per: 4, crit: 1.25, boostPer: 3, boostCrit: 1.5},
    '밤의 송곳': {key: 'awl', init: [0, 5, 10, 15], bleedHit: 10}},
  /* 검지 지령 수행: 스택이 가득 찬 뒤 지령 카드를 every번 더 수행할 때마다 카드 수치(피해 · 회피 · 보호막) +1, 최대 max */
  prescPlus: {every: 2, max: 5},
  oracle: {chance: 25, tries: 2, every: 5, dc: 40, presc: 10, missHit: 15, missEva: 5},
  /* 소지(표식)의 도: 표식이 생긴 뒤 every년차마다 인·의·예·지 사건이 차례로 온다. 1d100이 dc 이상이면 키워드를 얻고, 4개를 모으면 이름을 붙인 성도(전용 무기)를 얻는다.
     성도 수치: 각 항목을 [최소, 최대] 범위에서 굴린다 (atk 공격, eva 회피, dmgB 추가 피해, hit 명중) */
  pinky: {every: 5, dc: 40, seongdo: {atk: [1, 10], eva: [1, 5], dmgB: [0, 2], hit: [5, 15]}},
  /* 충전(자신에게 쌓는 스택): 카드의 spend만큼 소모해 소모한 1당 fixPer의 고정 피해(피해 감소 무시, 보호막은 깎임)를 적중마다 더한다. 라운드가 바뀌어도 줄지 않고, 맞으면 loss만큼 준다.
     소속별 규칙(orgs): cap 상한, round 라운드 시작마다 +n, hit 적중마다 +n, loss 피격 시 −n */
  /* 침잠(상대에게 쌓는 스택): per스택마다 한 단계, 단계마다 침잠 걸린 쪽의 명중 −hit · 주는 피해 −dmg. 라운드마다 1 감소 */
  sink: {per: 3, hit: 6, dmg: 1},
  charge: {cap: 10, loss: 1, orgs: {'W사 날개': {cap: 10, round: 1, loss: 0}, 'R사 날개/토끼팀': {cap: 8, hit: 1, loss: 2, spd: 5, boost: {low: [0.5, 3], charge: [5, 3]}},
    /* 순록팀: 충전 20까지. 최대 체력 step만큼 잃을 때마다(최대 max번) 공격 피해 +dmg · 충전 at 이상이면 소모 카드의 충전 1당 고정 피해 +fix */
    'R사 날개/순록팀': {cap: 20, loss: 1, power: {step: 0.3, max: 2, dmg: 3}, focus: {at: 10, fix: 2}},
    /* 코뿔소팀: 충전 20까지. 최대 체력 step만큼 잃을 때마다(최대 max번) 방어 회피 +def · 충전 at 이상이면 받는 피해 −dr% */
    'R사 날개/코뿔소팀': {cap: 20, loss: 0, wall: {step: 0.3, max: 2, def: 3}, armor: {at: 10, dr: 8}}}},
  /* 하나 협회 전용 패시브: 라운드마다 카드를 고르기 전에 한 가지를 고른다. gun: 이번 라운드 공격 피해 +n, gon: 받는 피해 n% 감소, gam: 이번 라운드 빛 +n, ri: 체력 회복과 호흡 */
  tri: {org: '하나 협회', names: {gun: '건', gon: '곤', gam: '감', ri: '이'}, gun: 2, gon: 30, gam: 1, ri: {heal: 2, breath: 2}},
  /* 혈귀 루트 '피의 각인된 갈망'(돌네시아를 쓰러뜨린 뒤): 일반·보스 적을 이기면 자식 +1(최대 max, 히든·환상체 제외),
     전투가 끝나면 자식마다 lose% 확률로 사라진다. 자식 1명당 라운드마다 혈찬 스택 per를 바로 얻는다 */
  kids: {max: 20, per: 0.5, lose: 30},
  /* 생크 협회 전용 패시브 '결투 선언': 이 소속이 치르는 모든 전투에서 서로(나와 상대) 명중마다 주는 피해 +dmg */
  duel: {org: '생크 협회', n: '결투 선언', dmg: 3},
  /* 6시즌 N사 날개: 의체를 쓰지 않는다(의수 칸 사용 불가). 대신 전투마다 신체 강화(공격·회피·속도), 의체 심판: 의체 상대(enemies aug, 소개 문구에 의체가 분명한 적만) 적중마다 피해 +augDmg */
  /* 동부 외곽 해결사 히든 제안: rank급 이하에서 N사가 startFi번째 직급(0 사원 · 1 대리)으로 스카우트. tries번까지, 거절하면 gap년 뒤. align = N사 직급(사원~임원)별로 해결사 급수가 이만큼은 되도록 맞춘다 */
  eastN: {rank: 5, startFi: 1, tries: 2, gap: 4, align: [9, 8, 6, 4, 2]},
  nWing: {name: 'N사 날개', atk: 2, eva: 2, spd: 2, augDmg: 3, fate: 10, eastTitle: '금기사냥꾼'},
  /* N사 날개 · 못(상대에게 쌓임, 최대 cap): 적중마다 hit(의체 적은 augHit). 3·4코스트 망치 카드가 못을 모두 흐트러짐으로 바꾼다 (nailBurst.mul배).
     흐트러짐: 단계(stages)마다 상대의 명중 −hit · 주는 피해 −dmg · 받는 피해 +take, 라운드 끝에 decay씩 줄고, stun(적 등급별) 이상이면 다음 라운드 기절 */
  nail: {cap: 15, hit: 1, augHit: 2, staggerCap: 30, decay: 2, stages: [{at: 3, hit: 8, dmg: 0, take: 0}, {at: 6, hit: 15, dmg: 2, take: 2}, {at: 10, hit: 20, dmg: 3, take: 4}], stun: {early: 6, mid: 8, late: 10, boss: 12, hidden: 16}},
  /* 6시즌 보냐텔리의 검: 강화 단계별 수치(0~5), 단계마다 필요한 재료 등급, 가속 */
  bon: {max: 5, need: [0, 1, 2, 4, 5], atk: [0, 5, 9, 13, 17, 21], eva: [0, 2, 4, 6, 8, 9], dmgB: [0, 0, 0, 1, 1, 2], accel: {max: 3, hit: 5, eva: 5},
    /* 전용 검술 카드 강화: 검 단계별 카드 피해 +cardB[L], 후반(lateFrom년차부터 lateEvery년마다 +latePer, 최대 +lateMax) */
    cardB: [0, 0, 0, 1, 2, 3], lateFrom: 40, lateEvery: 5, latePer: 1, lateMax: 14},
  /* 혈귀 특수 루트: 라만차랜드 초대장이 오는 해 */
  lamancha: {year: 16},
  /* 격리 실패: 이 해부터, 사건이 오는 해마다 확률(%) */
  abnoBreach: {from: 6, chance: 10},
  /* 네임드 적(이름이 붙는 적): 일반보다 조금 강하게 */
  named: {hp: 1, atk: 0},
  /* 특색·상석 심사: 최대 도전 횟수, 실패 후 다시 부르기까지 걸리는 해 */
  top: {tries: 3, wait: 2},
  /* 엄지 패시브 탄환: 전투마다 기본 발수 + 서열 하나 오를 때마다 추가 */
  thumbAmmo: {base: 6, per: 2},
  /* 약지 패시브 예술적 감각: 적을 쓰러뜨릴 때 확률, 최대 스택, 스택당 피해 주사위 최대치 */
  artSense: {every: 3, max: 4, die: 5},
  /* 중지 되갚음: 스택 1당 받는 피해 −def, 다음 적중에서 스택을 쓰면 소모한 스택 1당 HP heal 회복, 스택은 keep 비율만 남는다 (내림) */
  /* 화상: 라운드 끝에 스택×dmg 피해, 그 뒤 스택은 keep 비율만 남는다 (내림). 최대 max스택, 적이 거는 화상 스택은 foe 배. 붉은 화염(레바테인 전용)과는 별개 */
  rupture: {max: 20},
  /* 전용 책장이 없는 날개: 카드팩 대신 입사 때 보정치를 더 받는다 */
  freeWing: {names: ['K사 날개', 'J사 날개', 'G사 날개'], fx: {maxHp: 6, atk: 2, eva: 2, spd: 2, check: 2}},
  burn: {dmg: 3, dmgMe: 2, max: 15, keep: 0.5, foe: 0.5},
  /* 패시브 근성(형님)·초근성(큰형님) 받는 피해 감소 %: 맞아야 강해지는 중지가 후반에 버티도록 */
  /* 중지 회피 환산: evaEff = 서열별(막내·동생·작은형님·큰형님) 회피의 '피하는 힘' 비율, 줄어든 회피 1당 받는 피해 감소 evaDr%p (근성과 합쳐 drCap까지). cap = 플레이어 되갚음 스택 최대(적은 5), counter = 방어 카드를 낸 라운드에 맞으면 되갚음 스택 × counter의 고정 피해 반격, sinkHit = 중지를 노린 침잠의 명중 감소 배율 */
  /* 개화한 E.G.O: 개화 카드(공세·수호)를 every번 쓸 때마다(전투마다 세어) 방금 낸 카드에 맞는 1회용 스킬이 다음 라운드 손패에 들어온다 */
  bloom: {every: 3},
  /* 오딘의 눈: 일반은 순간의 예지(첫 라운드 first, 이후 after). 보냐텔리 가문은 패시브 가속하는 미래(cycle 순서로 반복, 마지막 칸은 과부하)와 버프 예지안(전용 검술 카드 피해 +yeji) */
  odin: {midStart: 2, midHit: 1, first: 30, after: 15, cycle: [40, 35, 30, -10], yeji: 2},
  middle: {def: 2, keep: 0, heal: 1, dmg: 1, dr: [0, 0, 10, 30], evaEff: [1, 1, 0.5, 0], evaDr: 0.5, drCap: 50, counter: 3, sinkHit: 0.5, cap: 10},
  /* 의리 순례(중지 전용 루트): 동생(fi 1) 이상이 되면 해마다 chance%로 원한의 책 제안, 거절하면 gap년 뒤 다시. 둘째 장 전투에서 아우가 맞으면(kin) 분노 +anger, 셋째 장 시험은 rounds라운드 버티기 */
  giri: {fi: 1, chance: 35, gap: 5, kin: 50, anger: 5},
  /* 약지 작품: 적중할 때마다 +1(최대 max, 전투 한정). 스택당 명중 +hit · 피해 +dmg, max에 닿으면 다음 적중 피해 ×finish 후 스택이 after로 줄어든다 */
  ring: {max: 6, hit: 2, dmg: 0, finish: 1.5, after: 3},
  office: {rank: 5, foundEvery: 5, knockEvery: 4},
  relicEvent: {year: 15, chance: 1},
  /* 레바테인: 봉인 상태에서 화상을 unlock번 걸면 해방. 해방 후 자신은 전투 시작 화상 1, selfEvery라운드마다 +1, blueAt 이상이면 자신도 푸른 화염(명중 −selfBlueHit) */
  /* 레바테인 해방 단계: 붉은 화염을 건 횟수가 at에 닿을 때마다 한 단계씩 풀린다. f는 완료 성능에 대한 비율(공격 · 피해 주사위 · 푸른 화염 배율과 점화 · 자신 푸른 화염 명중 감소). f 0.5 이상부터 상대의 붉은 화염이 푸른 화염으로 바뀐다 */
  laev: {stages: [{at: 20, id: 'laev_s1', f: 0.25, n: '1단계 해방'}, {at: 45, id: 'laev_s2', f: 0.5, n: '2단계 해방'}, {at: 80, id: 'laev', f: 1, n: '해방 완료'}], selfEvery: 1, blueAt: 5, blueDot: 2, blueMul: 2, selfBlueHit: 30},
  /* 엄지 검술(덱 고정): 카드를 얻는 자리마다 대신 받는 돈 */
  lockedCardMoney: 150,
  /* 공방 해결사: 4년차 갈림길에 chance% 확률로 제안. 1d die에서 minRoll 이상이면 성공. 공방 물건 할인율, 보관함 판매 비율 */
  workshopFixer: {chance: 20, die: 5, minRoll: 4, discount: 0.2, sell: 0.5, sellBase: 100},
  /* 출신 진로 보정: 그 진로의 권유 사건이 (보정값 × 이 값)% 확률로 먼저 나온다 */
  pathEventMul: 2,
  /* 전투 승리 후 해결사 등록 판정 난이도 (1d100 + 해결사 진로 보정) */
  winLicenseDc: 60,
  /* 소속 선택이 열리는 해 */
  affiliationYear: 4,
  /* 성장: 판정 성공/실패/판정 없음/전투 승리 경험치, 레벨별 누적 경험치 */
  xp: {ok: 2, fail: 1, plain: 1, win: 4},
  levels: [0, 4, 9, 15, 22, 30, 40, 52, 66, 82, 100, 120, 145, 175],
  /* 시뮬: 고정 전투 직전마다 쌓인다고 보는 레벨 업 수 (경험치 표 기준 추정) */
  simGrowth: [0, 2, 1]
};
