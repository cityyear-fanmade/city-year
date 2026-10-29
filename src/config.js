/* 임시 수치: 밸런스는 여기만 바꾼다. `npm run sim`으로 확인한다. */
const LV_CURVE = {base: 4.5, every: 8};
const LEVELS = (() => {
  const {base, every} = LV_CURVE, out = [0];
  let acc = 0;
  for (let L = 2; L <= 120; L++) { acc += base * Math.pow(2, Math.floor(L / every)); out.push(Math.round(acc)); }
  return out;
})();
export const CFG = {
  /* 피해 주사위 최소값: 장비(최댓값) + 재능·성장기의 '+1'(겹치면 더해짐), 합계는 dminCap까지 */
  dminCap: 4,
  /* 의견·버그 제보 구글 폼 (시작 화면 링크) */
  feedbackUrl: 'https://forms.gle/FYsYb2itq3LyUXrs9',
  /* 캐릭터 */
  baseHp: 60,
  /* 전투: 빛(코스트), 손패, 키워드 */
  light: 3, lightMax: 5, hand: 4, stackCap: 10, bleedMax: 40 /* 플레이어가 적에게 거는 출혈의 최대 스택(파열과 같다). 받는 출혈은 stackCap */,
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
  /* 소모품(소지품): 종류마다 최대 max개까지 지닌다. 전투 중에도 라운드마다 한 번 쓸 수 있다. 인연 도시락은 전투를 이긴 뒤 인연이 있으면 가끔 받는다 */
  supply: {max: 3, priceEvery: 10, priceStep: 100, priceMax: 5000 /* 값은 priceEvery해마다 priceStep안씩 오른다(최대 priceMax) */, lunchChance: 25, lunch: {hpPct: 20, mind: 20},
    items: {bandage: {n: '지혈대·붕대', hp: 20, bleed: true, price: 300, e: 'HP +20 · 출혈 해제'},
      snack: {n: '꼬치', hp: 15, mind: 5, price: 150, e: 'HP +15 · 정신력 +5'},
      calm: {n: '진정제', mind: 15, price: 400, e: '정신력 +15'}}},
  clinic: {price: 500, step: 500, hp: 30, max: 3, mind: 10, mindPrice: 400, mindStep: 200, mindMaxBuy: 3} /* 마음 치료: 한 번에 정신력 mind 회복, 방문마다 mindMaxBuy번, 값은 이번 판에 받은 횟수만큼 mindStep씩 오른다 */,
  /* 암시장 K사 엠플: 전투 중 HP가 최대 HP의 belowPct 이하가 되면 자동으로 heal 회복(전투당 사용 횟수 제한 없음, 한 번에 1개). 값은 항상 price, carry개까지 지니고 한 판에 limit개까지만 살 수 있다 */
  ample: {name: 'K사 엠플', price: 5000, priceInf: 8000, carry: 3, limit: 5, /* 2막 무한 모드에 들어서면 구매 횟수 제한(limit)이 없어진다(carry는 그대로) */ belowPct: 0.2, healPct: 0.5},
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
  colorRank: 1, colorDc: 90, topDc: 90, colorReward: false /* true면 특색 보상(능력치 배수 + 패시브 선택)을 준다. 논의 뒤에 켠다 */, colorMul: 1.2 /* 특색을 받으면 공격·회피·속도·최대 HP가 이 배수만큼 (최소 +1) */,
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
  oldAge: 100, overflowAge: 1000 /* 무한 모드 오버플로우 엔딩 나이 */,
  /* 사건 판정 주사위 최대치(플레이어): 타고난 것 등으로 아무리 커져도 이 값에서 멈춘다 */
  checkMax: 220,
  serpent: {max: 7} /* 보라눈물: 뱀의 장벽 스택 최대 */, vform: {exec: '익스큐셔너 소드', rapier: '레이피어', katana: '카타나'} /* 옛 보랏빛 사복검 */, form: {names: {a: '참격 자세', d: '방어 자세', p: '관통 자세', s: '타격 자세'}, weapon: {a: '보랏빛 사복검', d: '보랏빛 사복검', p: '보랏빛 사복검', s: '보랏빛 사복검'}, atkDmg: 1, defCut: 15, stagger: 1, bleed: 1, burstLight: 5, burstRounds: 2} /* 보랏빛 사복검: 자세 */ /* 보랏빛 사복검의 이름 */,
  warp: {winHealPct: 0.2, chance: 40, leadPlus: 20, laterYears: 5, lead: {maxHp: 8, atk: 1}, rival: {stats: {spd: 1, check: 1}, money: 1500}, after: {bonus: {2: {atk: 2, eva: 2, maxHp: 10}, 5: {atk: 1, eva: 1, maxHp: 4}}}} /* W사 열차 직원: 해마다 이 확률로 열차 안 사건(해가 넘어가지 않음)이 하나 온다. 무한 모드(2막)에서 열차를 내릴지 정하는 서류가 한 번 놓이고, 남아 정리 요원장이 되면 확률이 leadPlus만큼 오르고 lead 보너스를 받는다 */,
  drainCap: 5 /* 무기 흡수(미미크리 등): 한 라운드(턴)에 적중 흡수는 최대 5번까지 */,
  infinite: {limit:{every:10,atkPct:0.05,dmgPct:0.04,strikePct:0.005,traitMul:1.5,traitYearEvery:5},grief: {atk: 2, maxHp: 30, dmg: 0.03} /* 100살을 넘긴 뒤 가족이 눈을 감으면: 슬픔이 몸에 굳어 영구히 강해진다 */, shard: {atk: 1, maxHp: 20, dmg: 0.015, heal: 0.5} /* 불순물을 쓰러뜨릴 때마다 얻는 조각: 공격·최대 HP·주는 피해가 영구히 오르고, HP를 최대의 50%+조각 최대 HP 회복한다 */, century: {every: 100, atk: 6, eva: 1, spd: 1, maxHp: 150, dmg: 0.35, enemyDmg: 0.25} /* 무한 모드에서 100살(나이)마다: 능력치 영구 증가 + 주는 피해 +35%(합산, 영구). 대신 적의 공격 피해도 같이 +25%씩(합산, 영구): 회복 수단을 늘리는 대신 한 대 한 대가 아프게 */, atkCap: 320 /* 무한 모드 적 공격(명중) 상한 */, surge: {year: 200, round: 50, per: 1.5, max: 1e9}, echoXp: 3 /* 다시 나온 히든(불순물)을 이기면 불순물의 조각과 함께 주는 경험치 */ /* 200년차부터 한 전투가 50라운드를 넘기면 라운드마다 내가 주는 피해 ×1.5 복리(최대 ×1e9). 나에게만 붙는다 */, erodeFrom: 90, erodePer: 0.5, erodeMax: 30, enemyMax: 260, atkMax: 260 /* 균열을 닫은 뒤의 적 공격 상한 (enemyMax와 같다) */, midCut: 1, midCutMax: 20 /* 누적 최대 20%p */ /* 중지: 무한 모드에서 맞을 때마다 받는 피해 −1%p (전투 내 누적, 상대의 몰아침 배율 대신) */, every: 10 /* 불순물은 10년마다 (예전 8년) */, impPer: 0.15, impAtk: 2, hiddenAdd: 30, crack: 40, hpGrow: 0.02, hpGrowCap: 100, hpMax: 99999999, hpTable: [[0, 5000], [100, 11000], [200, 45000], [300, 450000], [400, 2800000], [500, 9000000], [600, 20000000], [700, 34000000], [800, 50000000], [900, 70000000]] /* 불순물 체력표: [나이, 최대 HP]. 그 나이부터 다음 칸 나이 전까지 쓴다 */, hpPerKill: 0.025, hpBandMax: 0.4 /* 같은 100살 구간에서 불순물을 쓰러뜨릴 때마다 표의 값에 +2.5%씩 (구간 안에서 최대 +40%) */, hpStep: 100, hpEnd: 984 /* 불순물 체력은 100살(나이)마다 계단식으로 오른다: 그 100살 구간이 끝나는 나이(최대 984년차=1000살)의 기존 곡선 값을 그 구간 동안 쓴다. 1000살 오버플로우 전 마지막 불순물 전투는 체력이 딱 hpMax */, legacyNeed: 40 /* 최고 직위 뒤: 포인트 40마다 연륜 1단계(능력치 +1) */, legacyMax: 40, atkGrow: 1, evaGrow: 0.5, evaDown: 0.5 /* 무한 모드 2해마다 양쪽 회피 −1 (소수는 버린다) */, escPerP: 0.03, escPerE: 0.03, infLvEvery: 5 /* 무한 모드에서 전투 승리 5번마다 레벨 +1 */, atkEvery: 2 /* 무한 모드 적 명중(공격) 보정 +1이 붙는 햇수 간격 */, escMaxP: 2, escMaxE: 30 /* 한 전투에서 맞을 때마다 받는 피해가 복리로 증가: 양쪽 모두 ×1.03씩, 상한은 플레이어 ×4, 적 ×30 */},
  /* 정신력: 최대 max. healEvery년마다 +yearHeal. 선택지·환상체 조우 2d3 감소, 회피 실패 시 1d evadeDie에서 1이면 1 감소(E.G.O 장비 1개당 +1).
     voiceAt 이하에서 한 번 "들리는 목소리": 1d voiceDie를 voiceRolls번, 모두 voiceDc 이상이면 개화, 실패하면 1d failLoss 감소.
     0이 되려 할 때: 뒤틀림 사건 전이면 1에서 버틴다. 그 뒤로는 전투 중이면 1d100 ≤ 50 개화 / 아니면 한 번 더 1d100 ≤ twist(75) 뒤틀림 / 아니면 정신 붕괴 사망, 전투 밖이면 정신 붕괴 사망(개화·뒤틀림 상태에서는 줄지 않는다). tiers: 전투 시작 때 호흡·회피 보정 */
  mind: {max: 45, cap: 110, yearHeal: 1, healEvery: 2, voiceAt: 10, voiceGoodDc: 38, voiceBadDc: 9, voiceBias: 20, twist: 75, sureSight: 60, voiceDie: 50, voiceDc: 14, voiceRolls: 3, failLoss: 9, evadeDie: 5,
    stat: {at: [20, 25, 30, 35, 40, 45]},
    tiers: [{at: 40, breath: 5, eva: 5}, {at: 32, breath: 4, eva: 4}, {at: 26, breath: 3, eva: 3}, {at: 20, breath: 2, eva: 2}, {at: 15, breath: 1, eva: 1}, {at: 11, breath: 1, eva: 0}],
    ego: {atk: {n: '공격용', hit: 14, floor: 20, card: 'e_bloom_atk'}, def: {n: '방어용', hp: 45, eva: 3, floor: 11, card: 'e_bloom_def'}},
    /* 개화한 E.G.O를 가지면: 덱 최대 장수 +deckPlus (고정 전용 카드가 그 자리), 전투 처음 lightRounds라운드 동안 빛 +light */
    deckPlus: 2, light: 1, lightRounds: 3},
  /* 공방 거리: 1년차부터 every년마다 들를지 묻는다(해는 넘어가지 않음). blackFrom년차부터 암시장 물건 blackStock개 진열 */
  /* 육신 뒤틀림: 장비를 쓸 수 없고(전부 보관함) 카드팩이 뒤틀린 카드팩(도박 카드 12장, 빛 없음)으로 고정, 정신력 시스템이 사라진다. 깡 능력치가 크게 오른다. 안정화(stable)되면 장비·카드팩을 다시 쓰고 deck2(더 강한 카드)를 얻는다 */
  distort: {fx: {maxHp: 40, atk: 6, eva: 0, spd: 0}, packN: '뒤틀린 카드팩', packN2: '더 강해진 뒤틀린 카드팩', stable: {every: 2, chance: 40},
    deck: ['d_jackpot', 'd_jackpot', 'd_jackpot', 'd_rend', 'd_rend', 'd_rend', 'd_maw', 'd_maw', 'd_thrash', 'd_thrash', 'd_coin', 'd_curl'],
    deck2: ['d2_strike', 'd2_strike', 'd2_strike', 'd2_twist', 'd2_twist', 'd2_surge', 'd2_surge', 'd2_flurry', 'd2_flurry', 'd2_gamble', 'd2_final', 'd2_guard']},
  /* 대호수로 나간 자: 침묵·시선의 호수에서 주인공이 아니라 다른 선원이 금기를 어기는 사건이 나올 확률(%) */
  lake: {infMob:{hp:2.2,atk:2},morph:{every:15,mindA:5,atkB:1,maxHpFinal:10},hullMax:100,hullWear:1,repairCost:700,trait:{hp:40,atk:20,eva:20},wave:{basePct:10,perBreak:15,maxPct:70,stage:3,maxStage:5,wallCost:200,wallDc:35,helmDc:55,helmNav:10,failMind:6,failMindStep:2,failHp:3,failCrew:50,driftMind:20,rewardPts:2,rewardMind:10,hullLoss:80},handShield: 6, cookHeal: 4, navEva: 4, navFlee: 10, harpStack: 1, loot: {silence: '무음의 고래 심장 · 피격 시 상대 왜곡 +1', lamp: '거짓 등대 고래 심장 · 매 라운드 시작 빛 +1', anchor: '닻을 삼킨 고래 심장 · 피격 시 상대 사슬 +1 · 무게 절반', tide: '적조의 고래 심장 · 피격 시 상대 출혈 +2', genesis: '창세치 고래 심장 · 3타마다 1타 추가', pale: '창백한 고래 심장 · 피격 시 상대 침잠 +1 · 창백화 절반'}, align: [9, 7, 5, 3], mindYear: 2, mindSail: 3, mindKeep: 3, harborMind: 10, slip: 30, encChance: 55 /* 선장이 된 뒤 새 호수에 들어서기 전 인어·해적 조우가 나올 확률 */, pirateAfter: 6 /* 선장이 된 지 이만큼 지나면 쌍갈고리 해적단과 얽힌다 */, adultBefore: 12 /* 1막이 끝나기 이만큼 전부터 같은 호수의 대재앙(성체)이 나온다 */, ricardoAfter: 4 /* 해적단 반파 뒤 이만큼 지나면 중지의 큰형님 리카르도가 찾아온다 */, crewMax: 4 /* 선장이 되면 모집할 수 있는 선원 수 */, crewW: 1 /* 선원 합산 굴림의 가중 */, crewEvery: 3 /* 모집 사건 간격(해) */, signEvery: 8 /* 변모의 징후 사건 간격(해) */, meetMul: 2 /* 일상 사건이 없는 대신 인연을 만날 확률을 배로(해마다) */, infFight: 35 /* 무한 모드에서 해마다 전투가 나올 확률(%) */, genesisAt: 2 /* 성체 대재앙을 이만큼 쓰러뜨리면 창세치 고래가 나온다 */},
  shop: {every: 3, blackFrom: 12, blackStock: 3, wsAux: {chance: 20, cap: 8, prices: [4500, 5000, 5500, 6000]} /* 공방 해결사에게만, 방문마다 chance% 확률로 비장 부품(효과 없음, 보조 장비 히든 재료) 하나. 한 판에 cap개까지 */, delCost: 500, delMax: 3, minDeck: 4, restMind: 5,
    /* v6.1: 카드 교환(덱 카드 1장을 일반 보상 카드 무작위 1장으로, 방문마다 swapMax장까지) · 장비 정비(장착 장비마다 최대 tune.max번 시도, chance% 확률로 공격 또는 회피 +1, 시도 비용 base+step×지금까지 시도) */
    swapCost: 500, swapMax: 3, tune: {max: 5, maxWs: 10, chance: 50, base: 300, step: 150, zenaPlus: 10, noPlus: ['w_baralclaw', 'a_baralcoat', 'w_zenafairy', 'a_zenaarmor']}},
  /* 타고난 것: 출생 굴림과 별개로 1/chanceDiv 확률. 시드 재현을 위해 출생 굴림 값에서 파생 (새 주사위를 쓰지 않는다) */
  /* 해금 조건이 있는 타고난 것: hits=한 전투에서 맞은 횟수(회피 제외) · spdUp=출생 때보다 오른 속도 · lv=최고 레벨 기록 */
  innateUnlock: {hits: 20, spdUp: 30, lv: 20},
  innate: {chanceDiv: 100, secondDiv: 10, scholarMul: 1.4, willCut: 0.5, willHeal: 1, willFrom: 15, willSteps: 18, willHp: 3, swiftPer: 8, growMul: 1.2, money: 1.2, intuitionDie: 20, psycho: 2, markYear: 30, markMul: 1.6, miracleEvery: 10, miracleDie: 5},
  /* 카드 등급: 연차가 쌓이면 내 공격 카드가 강해진다 (from년차부터). 적중마다 피해 +b, 명중 +hit, 주사위 +dice개 */
  cardGrade: [{from: 1, n: '', b: 0, hit: 0, dice: 0}, {from: 16, n: '+1', b: 2, hit: 5, dice: 0}, {from: 31, n: '+2', b: 3, hit: 10, dice: 1}, {from: 46, n: '+3', b: 5, hit: 15, dice: 1}],
  /* 잊힌 유물: year년차가 시작될 때 반드시 나오는 사건. 1d100에서 chance 이하면 유물 선택 */
  /* 6시즌: 덱 최대 장수, 암시장 카드 상자(확률·가격) */
  /* 덱 보정: from장 이상부터 per장마다 공격 +atk (6장 +2, 8장 +4, 10장 +6, 12장 +8). 덱을 압축한 쪽과 꽉 채운 쪽의 격차를 줄인다 */
  /* 지구전 압박: 50라운드부터 라운드마다 양쪽이 최대 HP의 1%×(지난 라운드) 고정 피해 (최대 25%) */
  fatigue: {from: 999999 /* 꺼 둠: 무한 모드는 받는 피해 증가·균열 침식이 대신한다 */, per: 0.02, max: 0.30, miss: 2, capRate: [[0, 0.01], [25, 0.02], [50, 0.03]] /* 적 최대 HP가 무한 모드 상한에 닿으면 압박이 시작된 뒤 [지난 라운드 수 초과, 라운드당 비율] */},
  deck: {max: 12, bonus: {from: 6, per: 2, atk: 2}},
  blackCard: {chance: 50, price: 250},
  /* 6시즌 사무소: 개설 가능 급수(이상), 개설 사건을 다시 묻는 간격, 소속 없는 해결사가 사무소 문을 두드리는 간격 */
  /* 6시즌 E.G.O 적성자: 전용 카드 '발현'을 낸 누적 횟수(need)가 차는 순간 E.G.O 무기 등급이 오른다. 등급별 수치는 birth.json egoWeapons[].grow */
  egoGrow: {need: [0, 5, 15, 30], tier: ['TETH', 'HE', 'WAW', 'ALEPH'], mf: [0.05, 0.1, 0.17, 0.25]},
  /* 6시즌 새 시리즈: 격리 실패로 birds를 모두 이기면 '종말의 예언'(flag)을 얻고 종말새와 싸우러 갈 수 있다.
     birds 중 하나라도 이긴 뒤에는 격리 실패가 남은 새를 pref% 확률로 먼저 고른다 */
  apoc: {birds: ['bigbird', 'punishbird', 'judgebird'], flag: 'prophecy', pref: 60},
  /* 마법소녀 4종을 모두 이기면 '허무의 도래' 플래그 → gap년 뒤부터 히든 보스 허무의 광대 (불길한 예감, 피할 수 있음) (마법소녀를 한 마리 이길 때마다 격리 실패에서 남은 마법소녀를 먼저 만날 확률 pref[이긴 수]%) */
  mgirl: {ids: ['queenhate', 'kinggreed', 'servantwrath', 'knight'], flag: 'nihil', pref: [0, 40, 55, 70], boss: 'jester', gap: 3},
  /* 6시즌 기업 루트(날개 직원): from년차부터 해마다 chance% 확률로 '특이점 개발' 제안이 한 번 온다.
     개발(devMax번 진척) → 날개 설립(이름) → 특이점 실험(강화 upMax번)·금기 실험. 금기 실험을 forbMax번 하면 머리의 시험(chain: 발톱 → 조율자 연속 전투).
     types: 특이점 효과. base는 고를 때, per는 강화 한 번마다 (warp.lead: 전투 처음 N라운드 항상 선공, serum.heal: 라운드마다 회복, moon.tier: 정신력 구간 보정 배수)
     trial: 머리의 시험 전투(상대별)에서 체력 배수·공격 가산. grow/up/forb/clear: 개발 진척·강화·금기 실험·시험 통과 때 얻는 능력치 */
  corp: {from: 20, chance: 20, devMax: 2, devGap: 2, devChance: 60, labGap: 1, labChance: 80, upMax: 3, up2: 2, forbMax: 8, huntChance: 20, chain: ['claw', 'arbiter'],
    types: {
      warp: {n: '워프', e: '속도 +4 · 사건 판정 +3 · 전투 처음 3라운드 항상 선공 (강화마다 속도 +2 · 판정 +2 · 선공 1라운드 더)', base: {spd: 4, check: 3}, per: {spd: 2, check: 2}, lead: 3, leadPer: 1},
      serum: {n: '혈청', e: '전투 중 매 라운드 시작에 HP 5 회복 (강화마다 +2, 최대 10 · 금기 실험 8회 뒤 2차 강화로 최대 15)', heal: 5, per: 2, healMax: 10, heal2Max: 15},
      moon: {n: '월광석', e: '최대 정신력 +8 · 해마다 정신력 +2 · 회피 실패로 정신력이 깎이지 않는다 · 정신력 구간 보정 ×1.6 (강화마다 최대 정신력 +2 · 해마다 +1 · 보정 +0.2배)', base: {mindMax: 8}, per: {mindMax: 2}, year: 2, yearPer: 1, tier: 1.6, tierPer: 0.2}
    },
    trial: {claw: {hp: 1, atk: 0}, arbiter: {hp: 1, atk: 0}}, grow: {maxHp: 3}, up: {maxHp: 8, atk: 2}, forb: {maxHp: 5, atk: 2, eva: 1}, clear: {maxHp: 15, atk: 3, eva: 2}},
  /* 도서관 관장을 쓰러뜨리면 붉은 안개의 책 연계 퀘스트: 얻은 뒤 every년마다 책이 요동치고, 펼쳐서 붉은 안개를 쓰러뜨리면 끝난다 */
  /* 붉은 안개의 책: 덮어 둘 때마다 붉은 안개의 체력이 hpMul배씩 커진다 (복리). */
  redBook: {every: 3, hpMul: 1.1},
  /* 붉은 안개 전용 카드팩 패시브: 적을 쓰러뜨리면 HP heal 회복 */
  redMist: {heal: 60, healPct: 0.15, shieldPct: 0.10, gauge: 12, burstLight: 2, burstRounds: 2},
  /* 오늘의 시드로 시작하면 출신 굴림을 이 숫자로 고정한다 (null이면 시드 그대로). 1 = 혈귀 */
  dailyOrigin: 1,
  /* 날짜별 오늘의 시드 지정 (한국 시간 기준 날짜): origin = 출신 굴림(80 = 동부 출신 외곽 생존자), innate = 타고난 것 */
  dailyPlan: {'2026-10-23': {origin: 40}, '2026-10-22': {origin: 40}, '2026-10-20': {origin: 10, innate: 'will'}, '2026-10-21': {origin: 30}, '2026-10-19': {origin: 50}, '2026-10-15': {origin: 80, innate: 'mark'}, '2026-10-16': {origin: 20, innate: 'growth'}, '2026-10-17': {origin: 1, innate: 'psycho'}, '2026-10-18': {origin: 90, innate: 'mark'}, '2026-10-24': {origin: 20}, '2026-10-25': {origin: 80, innate: 'swift'}, '2026-10-26': {origin: 90}, '2026-10-27': {origin: 30, innate: 'iron'}, '2026-10-28': {origin: 10, innate: 'fortune'}, '2026-10-29': {origin: 50, innate: 'scholar', innate2: 'intuition'}, '2026-10-30': {origin: 1, innate: 'miracle'}, '2026-10-31': {origin: 20, innate: 'intuition', innate2: 'will'}, '2026-11-01': {origin: 30, innate: 'growth'}, '2026-11-02': {origin: 40, innate: 'iron', innate2: 'swift'}, '2026-11-03': {origin: 90, innate: 'mark'}, '2026-11-04': {origin: 80, innate: 'psycho', innate2: 'fortune'}, '2026-11-05': {origin: 10, innate: 'will', innate2: 'growth'}},
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
    kinds: {fighter: ['hyeolgwi', 'east', 'highfixer', 'lake', 'blade', 'awl', 'ring', 'kuro', 'finger'], support: ['office', 'assoc', 'wing', 'pointer'], guard: ['thumb', 'middle', 'hcorp']},
    fighter: {base: 6, per: 2, rand: 4}, support: {shield: 12, shieldPer: 4, heal: 4, healPer: 1}, guard: {cut: 35, cutPer: 4, cutMax: 70, counter: 5, counterPer: 2}},
  bond: {partner: {gap: 10 /* 붉은 머리 인연: 만난 뒤 이 해가 지나면 상대가 1급이 되어 특색을 받는다 */, deedEvery: 10 /* 이후 이 해마다 특색 해결사의 행적 */}, sweetEvery: 7, sweetEvery2: 12, routes: ['office', 'assoc', 'wing', 'freelance', 'finger', 'thumb', 'pointer', 'middle', 'ring', 'kuro', 'blade', 'awl'], from: 11, by: 24 /* 24년차(40세)까지 못 만났으면 이후 해는 일상 사건 확률과 무관하게 만난다 */, meetChance: 90, gap: [3, 4], steps: 3, die: 4, ok: [3, 4], marryNeed: 5 /* 청혼 판정: 1d4 + 쌓은 인연(인연 이벤트 최대 3 + '인연을 더 쌓는다' 성공 횟수)이 5 이상이면 결혼 */, tries: 2, waitDc: 24, waitDie: 60 /* 청혼을 미루는 "기다린다": 보정 없이 1d60이 waitDc 이상이면 기회를 쓰지 않는다 */,
    marry: {maxHp: 8, mindMax: 6, check: 2}, yearMind: 1, saveMind: 10, lossMind: 5, leaveMind: 2, loveMind: 2,
    /* 결혼 뒤: 금기를 저지른 다음 해부터 해마다 dieChance% 배우자가 세상을 떠난다(최대 정신력 −lossMind). 아이: kid.from년 뒤부터 해마다 chance%, 최대 max명, 간격 gap년, 태어나면 최대 정신력 +mind. adult살이 되면 사무소·해결사·협회 중 한 곳에 들어간다 */
    /* 히든 인연(상대가 처음부터 2~1급 해결사): 해결사 등록자가 rank급 이하일 때 만남이 열리면 chance% 확률로 이 길이 된다 */
    hidden: {rank: 6, chance: 15} /* 해결사 6급 이상(1~6급)이면 가끔 처음부터 2~1급 해결사인 상대를 만난다. 코드에서는 rank<=6으로 쓴다(급수는 숫자가 작을수록 높다). 예전엔 3급 이상이라서 인연을 만나는 24년차까지 거의 닿지 못했다 */, fingerGeneric: 20 /* 엄지·검지·중지·약지 소속도 이 확률로 '조직 안의 낯익은 얼굴'(손가락 공통 인연)을 만난다 */,
    /* 인연과 함께 싸우는 보스: 라운드마다 인연이 추가 공격 (고정 피해 base + per×배우자 급수 레벨, ±3) */
    ally: {base: 8, per: 2}, allyDice: 0.75, allyHit: 10,
    dieChance: 2, riskStep: 0.1, kid: {from: 5, chance: 22, max: 2, gap: 3, mind: 2, adult: 20, oldFrom: 87, oldTo: 140, oldFromLong: 187, oldToLong: 250, oldMind: 3 /* 아이도 나이가 들면 눈을 감는다: oldFrom살부터 해마다 (나이−oldFrom+1)×oldStep% 확률: 보통은 87살부터 140살이면 반드시, 혈귀 종족이면 187살부터 250살이면 반드시 (구간 안에서 해마다 확률이 같은 폭으로 오른다), 정신력 −oldMind */},
    /* 뒤틀린 뒤: 성인이 된 아이가 있으면 gap년마다 chance%로 토벌 의뢰가 온다. 여럿이면 가장 강한 아이(등급)가 온다. 등급 = 20세 이후 2년마다 +1(최대 8) + 직업 가산 */
    /* 손주: 성인이 된 아이가 grand.from~grand.to살 사이에 해마다 chance% 확률로 아이를 하나 낳는다 (이름은 무작위, 한 명까지). legacy%는 일대기에 남은 이름(지난 삶의 나·연인·아이)을 물려받는 확률 */
    grand: {from: 30, to: 50, chance: 7, legacy: 40},
    hunt: {mind: 8, gap: 3, chance: 45, years: 2, job: {office: 0, assoc: 1, fixer: 2}, hp: 10, atk: 1, eva: 1, spd: 1, mul: 1.1, mulTop: 1.5, topLv: 8,
      /* 배우자 급수: 만난 루트별 시작 level + 결혼 spouseYears년마다 +1 (최대 8) */
      spouse: {office: 0, assoc: 1, wing: 1, finger: 2, thumb: 2, pointer: 2, middle: 2, ring: 2, kuro: 2, blade: 2, awl: 2, hyeolgwi: 3, east: 1, highfixer: 7, rcorp: 1, hcorp: 1, freelance: 7, lake: 4}, spouseYears: 3, spouseJob: {rcorp: 'fixer', hcorp: 'fixer', office: 'office', assoc: 'assoc', wing: 'assoc', finger: 'fixer', thumb: 'fixer', pointer: 'fixer', middle: 'fixer', ring: 'fixer', kuro: 'fixer', blade: 'fixer', awl: 'fixer', hyeolgwi: 'fixer', east: 'fixer', highfixer: 'fixer', freelance: 'fixer'}}},
  /* 보호막은 몇 장을 쌓아도 이 값을 넘지 않는다 (혈갑처럼 0코스트로 쌓는 카드가 최대 체력보다 많은 보호막을 만들던 문제) */
  shieldCap: 150,
  /* 검지 히든 직업 신탁대행자: 최종 서열 뒤 해마다 chance%로 단말기 사건, tries번 기회, 줍기는 1d100 ≥ dc. 지령 스택 최대 presc, 지령 미수행 시 다음 라운드 명중 −missHit · 회피 −missEva */
  /* 조직: 덱이 at[0](8)장 이상일 때 패시브가 열리고(그 아래로 압축하면 닫힌다), at[1](10)장에서 최종 단계가 된다. 흑운회: 시작 구름 start[단계] · max에 닿으면 흑운(주사위마다 +die · 적중 출혈 +bleedPlus · 마지막 단계에서 받는 피해 ×half) · 라운드 끝에 구름 reset.
     검계: 라운드 시작 호흡 +1(8장부터 +2) · 호흡 자연 감소 decay[단계] · 호흡 2당 모든 카드 +1. 밤의 송곳: 속도 굴림 +init[단계] · 출혈 걸린 적에게 명중 +bleedHit · 선공이면 상대 회피 절반 */
  /* 조직 루트: 엄지 전향 제안(흑운회·밤의 송곳의 최고 서열) → 몇 해 뒤 숙청 소문 → 반역하면 엄지의 대모 · 검계 최고 서열 → 뒤틀린 쥰 → 역적 → S사 절도사 */
  synRoute: {offerChance: 55, purgeGap: 3, fleeHp: 6},
  /* 무한 모드 추가 엔딩(죽는 것 말고): 균열로 흘러드는 히든 보스를 모두 쓰러뜨리면 균열이 닫힌다(sealBeasts는 더 쓰지 않음) · 히든 보스 starHidden마리를 이기면 별 · 가족이 있고 무한 모드 settleYears년이 지나면 정착. 각각 한 번, 끝낸 뒤에도 이어서 살 수 있다 */
  outEnds: {sealBeasts: 3, starHidden: 16, settleYears: 12},
  syn: {at: [8, 10],
    '흑운회': {key: 'kuro', start: [1, 2, 3, 4], max: 5, reset: 2, die: 2, bleedPlus: 1, half: 0.5, counter: [0.3, 0.5, 0.7, 0.9]},
    '검계': {key: 'blade', decay: [2, 1, 1, 0], per: 4, crit: 1.25, boostPer: 3, boostCrit: 1.5, burst: {at: 10, max: 12, per: [0.6, 0.8, 1, 1.2], every: 3}},
    '밤의 송곳': {key: 'awl', init: [0, 5, 10, 15], bleedHit: 10}},
  /* 검지 지령 수행: 스택이 가득 찬 뒤 지령 카드를 every번 더 수행할 때마다 카드 수치(피해 · 회피 · 보호막) +1, 최대 max */
  prescPlus: {every: 2, max: 5},
  oracle: {chance: 25, tries: 2, every: 5, dc: 40, presc: 10, missHit: 15, missEva: 5},
  /* 소지(표식)의 도: 표식이 생긴 뒤 every년차마다 인·의·예·지 사건이 차례로 온다. 1d100이 dc 이상이면 키워드를 얻고, 4개를 모으면 이름을 붙인 성도(전리품, 패시브)를 얻는다.
     성도 수치: 각 항목을 [최소, 최대] 범위에서 굴려 능력치에 영구히 더한다 (atk 공격, eva 회피, dmgB 추가 피해) */
  pinky: {every: 5, dc: 40, seongdo: {atk: [5, 20], eva: [4, 10], dmgB: [1, 4]}},
  /* 충전(자신에게 쌓는 스택): 카드의 spend만큼 소모해 소모한 1당 fixPer의 고정 피해(피해 감소 무시, 보호막은 깎임)를 적중마다 더한다. 라운드가 바뀌어도 줄지 않고, 맞으면 loss만큼 준다.
     소속별 규칙(orgs): cap 상한, round 라운드 시작마다 +n, hit 적중마다 +n, loss 피격 시 −n */
  /* 침잠(상대에게 쌓는 스택): per스택마다 한 단계, 단계마다 침잠 걸린 쪽의 명중 −hit · 주는 피해 −dmg. 라운드마다 1 감소 */
  sink: {per: 3, hit: 6, dmg: 1},
  charge: {cap: 10, loss: 1, orgs: {'W사 날개': {cap: 25, round: 2, loss: 0, start: 4, express: {at: 15, mul: 1.3}}, 'R사 날개/토끼팀': {cap: 8, hit: 1, loss: 2, spd: 5, boost: {low: [0.5, 3], charge: [5, 3]}},
    /* 순록팀: 충전 20까지. 최대 체력 step만큼 잃을 때마다(최대 max번) 공격 피해 +dmg · 충전 at 이상이면 소모 카드의 충전 1당 고정 피해 +fix */
    'R사 날개/순록팀': {cap: 20, loss: 1, power: {step: 0.3, max: 2, dmg: 3}, focus: {at: 10, fix: 2}},
    /* 코뿔소팀: 충전 20까지. 최대 체력 step만큼 잃을 때마다(최대 max번) 방어 회피 +def · 충전 at 이상이면 받는 피해 −dr% */
    'R사 날개/코뿔소팀': {cap: 20, loss: 0, wall: {step: 0.3, max: 2, def: 3}, armor: {at: 10, dr: 8}},}},
  /* 하나 협회 전용 패시브: 라운드마다 카드를 고르기 전에 한 가지를 고른다. gun: 이번 라운드 공격 피해 +n, gon: 받는 피해 n% 감소, gam: 이번 라운드 빛 +n, ri: 체력 회복과 호흡 */
  tri: {org: '하나 협회', names: {gun: '건', gon: '곤', gam: '감', ri: '이'}, gun: 2, gon: 30, gam: 1, ri: {heal: 2, breath: 2}},
  /* 혈귀 루트 '피의 각인된 갈망'(돌네시아를 쓰러뜨린 뒤): 일반·보스 적을 이기면 자식 +1(최대 max, 히든·환상체 제외),
     전투가 끝나면 자식마다 lose% 확률로 사라진다. 자식 1명당 라운드마다 혈찬 스택 per를 바로 얻는다 */
  kids: {max: 20, per: 0.5, lose: 30},
  /* 혈귀 혈찬: 상대 출혈이 5번 발동할 때마다(또는 자식 스택 5가 쌓일 때마다) heal 회복 */
  hyeolchan: {heal: 8},
  /* 생크 협회 전용 패시브 '결투 선언': 이 소속이 치르는 모든 전투에서 서로(나와 상대) 명중마다 주는 피해 +dmg */
  duel: {org: '생크 협회', n: '결투 선언', dmg: 3},
  /* 6시즌 N사 날개: 의체를 쓰지 않는다(의수 칸 사용 불가). 대신 전투마다 신체 강화(공격·회피·속도), 의체 심판: 의체 상대(enemies aug, 소개 문구에 의체가 분명한 적만) 적중마다 피해 +augDmg */
  /* 동부 외곽 해결사 히든 제안: rank급 이하에서 N사가 startFi번째 직급(0 사원 · 1 대리)으로 스카우트. tries번까지, 거절하면 gap년 뒤. align = N사 직급(사원~임원)별로 해결사 급수가 이만큼은 되도록 맞춘다 */
  eastN: {rank: 5, startFi: 1, tries: 2, gap: 4, align: [9, 8, 6, 4, 2]},
  nWing: {name: 'N사 날개', atk: 2, eva: 2, spd: 2, augDmg: 3, fate: 10, eastTitle: '금기사냥꾼'},
  /* N사 날개 · 못(상대에게 쌓임, 최대 cap): 적중마다 hit(의체 적은 augHit). 3·4코스트 망치 카드가 못을 모두 흐트러짐으로 바꾼다 (nailBurst.mul배).
     흐트러짐: 단계(stages)마다 상대의 명중 −hit · 주는 피해 −dmg · 받는 피해 +take, 라운드 끝에 decay씩 줄고, stun(적 등급별) 이상이면 다음 라운드 기절 */
  /* 대호수 작살: 작살 카드가 적중하면 쌓이고, 당기는 카드(harpoonPull)가 모두 소모해 스택당 per 피해를 더한다 */
  harpoon: {cap: 10},
  nail: {cap: 15, hit: 1, augHit: 2, staggerCap: 30, decay: 2, stages: [{at: 3, hit: 8, dmg: 0, take: 0}, {at: 6, hit: 15, dmg: 2, take: 2}, {at: 10, hit: 20, dmg: 3, take: 4}], stun: {early: 6, mid: 8, late: 10, boss: 12, hidden: 16}},
  /* 6시즌 보냐텔리의 검: 강화 단계별 수치(0~5), 단계마다 필요한 재료 등급, 가속 */
  /* 별에 선택받은 자의 성도: 단계별 공격·회피·추가 피해. fastFrom 단계부터 별 잇기가 3번째 적중마다, max 단계에서 빛 +1 */
  /* 전용 성장기 표를 가진 숨은 출생도 이 굴림이 나오면 일반 표의 특별한 결과를 받는다 (1 목소리가 들림 · 50 무너진 유적 탐험 · 100 장비의 형상이 보임) */
  kidKeep: [1, 50, 100],
  star: {max: 5, fastFrom: 3,
    /* 소지 루트로 이은 별마다 성도에 더해지는 추가 강화 (재료 강화와 별개). 지는 별 잇기를 3번째 적중마다로 */
    virt: {'인': {fx: {maxHp: 12}, e: 'HP +12'}, '의': {fx: {atk: 4}, e: '공격 +4'}, '예': {fx: {eva: 4}, e: '회피 +4'}, '지': {fx: {dmgB: 1}, e: '피해 +1 · 별 잇기 3번째 적중마다'}}, atk: [4, 8, 12, 17, 22, 27], eva: [3, 5, 7, 9, 11, 13], dmgB: [0, 1, 1, 2, 2, 3]},
  bon: {max: 5, need: [0, 1, 2, 4, 5], atk: [0, 6, 11, 16, 21, 26], eva: [0, 3, 5, 8, 10, 12], dmgB: [0, 0, 1, 2, 2, 3], accel: {max: 3, hit: 5, eva: 5}, markMax: 6, noEyeFrom: 3, noEye: 1,
    /* 전용 검술 카드 강화: 검 단계별 카드 피해 +cardB[L], 후반(lateFrom년차부터 lateEvery년마다 +latePer, 최대 +lateMax) */
    cardB: [0, 1, 2, 3, 4, 5], lateFrom: 40, lateEvery: 5, latePer: 1, lateMax: 18},
  /* 혈귀 특수 루트: 라만차랜드 초대장이 오는 해 */
  lamancha: {year: 16},
  /* 격리 실패: 이 해부터, 사건이 오는 해마다 확률(%) */
  abnoBreach: {from: 6, chance: 10},
  /* 네임드 적(이름이 붙는 적): 일반보다 조금 강하게 */
  named: {hp: 1, atk: 0},
  /* 특색·상석 심사: 최대 도전 횟수, 실패 후 다시 부르기까지 걸리는 해 */
  top: {tries: 3, wait: 2},
  /* 엄지 패시브 탄환: 전투마다 기본 발수 + 서열 하나 오를 때마다 추가 */
  thumbAmmo: {base: 12, per: 4},
  /* 예의 1스택당 상대 명중 −thumbManner (서열 0~3마다 값이 다르다 · 전투가 끝날 때까지 유지) · 탄환이 바닥나도 되돌아오지 않는다 (thumbRefund 0). 서열마다 탄환 +4: 솔다토 12 · 카포 16 · 언더보스 20 · 대부 24발 */
  thumbManner: [4.5, 3.6, 3.2, 2.8], thumbRefund: 0, thumbMannerMax: 40 /* 예의 스택 최대 */,
  /* 약지 패시브 예술적 감각: 적을 쓰러뜨릴 때 확률, 최대 스택, 스택당 피해 주사위 최대치 */
  artSense: {every: 3, max: 4, die: 5},
  /* 중지 되갚음: 스택 1당 받는 피해 −def, 다음 적중에서 스택을 쓰면 소모한 스택 1당 HP heal 회복, 스택은 keep 비율만 남는다 (내림) */
  /* 화상: 라운드 끝에 스택×dmg 피해, 그 뒤 스택은 keep 비율만 남는다 (내림). 최대 max스택, 적이 거는 화상 스택은 foe 배. 붉은 화염(레바테인 전용)과는 별개 */
  /* 받는 피해 감소 합계 상한(%): 근성·곤·출생·전리품·무한 모드 누적과 호위 막아섬을 모두 합쳐 이 값을 넘지 않는다 */
  drCap: 70,
  rupture: {max: 20},
  /* 전용 책장이 없는 날개: 카드팩 대신 입사 때 보정치를 더 받는다 */
  freeWing: {names: ['K사 날개', 'J사 날개', 'G사 날개'], fx: {maxHp: 6, atk: 2, eva: 2, spd: 2, check: 2}},
  burn: {dmg: 3, dmgMe: 2, max: 20, keep: 0.5, foe: 0.5, tickCap: 22 /* 달궈진 십자가: 라운드 끝 추가 고정 피해의 상한 (화상 상한 15×1.5와 같다) */},
  /* 패시브 근성(형님)·초근성(큰형님) 받는 피해 감소 %: 맞아야 강해지는 중지가 후반에 버티도록 */
  /* 중지 회피 환산: evaEff = 서열별(막내·동생·작은형님·큰형님) 회피의 '피하는 힘' 비율, 줄어든 회피 1당 받는 피해 감소 evaDr%p (근성과 합쳐 drCap까지). cap = 플레이어 되갚음 스택 최대(적은 5), counter = 방어 카드를 낸 라운드에 맞으면 되갚음 스택 × counter의 고정 피해 반격, sinkHit = 중지를 노린 침잠의 명중 감소 배율 */
  /* 개화한 E.G.O: 개화 카드(공세·수호)를 every번 쓸 때마다(전투마다 세어) 방금 낸 카드에 맞는 1회용 스킬이 다음 라운드 손패에 들어온다 */
  bloom: {every: 3},
  /* 아무것도 없는 출발: chance% 확률로 운명이 강제되어 히든 출신 n개 중 하나를 고르게 된다 */
  blankFate: {chance: 0, n: 2, pool: []},
  /* R사 부화장 복제체 루트: 0년차 13연전 → 일과 생활(전용 인연) → 1막 후반(fleeAt~) R사 추격대 4번(chaseGap년 간격) → 2막 초 숙청 집행관(R사의 끝) → 2막 중반(headFrom년차~) 정비 한 번 → 금기 위반 확인 즉시 발톱 바랄 → 조율자 제나 → 엔딩 */
  /* 까마귀팀 패시브 '까마귀의 눈'(전용 카드 rv_*): 적중마다 상대의 버프 1개를 제거한다 · 6장: 버프 없는 상대에게 명중 +10 · 8장: 상대 HP 50% 이하면 주사위마다 +1 · 10장: 상대 HP 30% 이하면 방어 자세·회피 봉쇄 */
  raven: {tiers: [6, 8, 10], hit: 10, low: 0.5, exec: 0.3, buffs: ['shield', 'breath', 'charge', 'cloud', 'passHit']},
  /* 수흔(獸痕): 흑수가 남긴 짐승의 흔적, 상대에게 쌓는 스택. follow: 부하 흑수가 내 공격 뒤에 거드는 추가타(데려온 순서대로 한 사람씩) 기본 피해, followPer: 부하가 둘 이상이면 인원이 늘 때마다 추가 피해, followInk: 상대에게 쌓는 수흔. 라운드가 끝날 때 스택당 dmg 피해(내가 받으면 dmgMe), 그 뒤 스택은 keep 비율만 남는다. 최대 cap */
  ink: {cap: 12, dmg: 2, dmgMe: 1, keep: 0.5, follow: 3, followPer: 1, followInk: 1},
  /* H사 홍원 가주 후보: 1막 초 홍원 가문에서 보낸다(가문 사건 homeEvents개) → missionAt년차 가주의 명으로 영생의 단서를 찾아 도시로 나선다(단서 4곳, clueGap년 간격) → 홍원으로 귀환, 남은 가문 사건 → 2막 시작(pickAt)에 가주 후보 지명 · 흑수 한 쌍 선택 → 다른 후보 5명(rivalGap년 간격) → 2막 중반(elderFrom~) 철함사의 소요(선황충) → 홍루 */
  hw: {fleeGap: 1, candRanks: ['부족한 가주 후보', '어엿한 가주 후보', '차기 가주 (승계 확정)'], candAt: [0, 3, 6], dan: {name: '홍단', heal: [0, 2, 3, 4]}, crown: ['ox', 'dragon', 'monkey', 'rooster'], haveMax: 6, sage: {max: 3, dc: 45, gift: 150, giftDc: 15, min: 4}, zExtraFrom: 3, zExtraEvery: 4, zExtraMax: 1, obey: {gain: 1, hit: 2, cap: 8}, kamoCut: 0.08, kamoCutMax: 0.4, winHealUp: 10, famAt: [1, 5, 9, 14, 19, 45, 45, 45, 45, 45], homeEvents: 5, forkAt: 2 /* 홍원 2년차: 승계를 이어 가거나 흑수가 된다 */, beast: {mkGap: 1, finalFrom: 45 /* 가주 심사(가주 혼자 철함사에 들어가는 선택)는 45년차 이후, 끝까지 약 10년 */, keys: ['rabbit', 'snake', 'rooster', 'horse'] /* 지금 고를 수 있는 흑수: 묘 · 사 · 유 · 오 */, gap: 2, rank1: 3, rank2: 6, startFx: {maxHp: 6, eva: 1}, rank1Fx: {atk: 1, eva: 1, maxHp: 6}, rank2Fx: {atk: 1, eva: 2, maxHp: 10}} /* 흑수 루트: 활동 3번이면 흑수, 6번이면 필두 */, missionAt: 22, clueGap: 5, pickAt: 56, rivalGap: 1, elderFrom: 61, finalGap: 1, clueHp: 3, hostHp: 20, hostMind: -8, hostLight: 1,
    pairs: [['rat', 'ox'], ['tiger', 'rabbit'], ['dragon', 'snake'], ['horse', 'goat'], ['monkey', 'rooster'], ['dog', 'pig']]},
  /* 루트 전용 무기(R사 복제 단검 · H사 홍원의 장도): 루트 이정표마다 단계가 오른다. lv 배열의 인덱스가 단계이고 H사 3단계는 host/free 두 갈래 */
  routeWeapon: {
    /* 까마귀팀 복제체(해금 출생): 처음부터 명장급 세이버를 쥐고, 임무 이정표(routeWpn 1·2)마다 한 단계씩 올라 두 번째 강화에서 히든급이 된다 */
    crow: {id: 'w_crow', lv: [
      {n: '검은 세이버', fx: {atk: 8, spd: 1}, dice: [2, 6], wx: {hitBleed: 1}, e: '공+8 · 속도+1 · 피해 2d6 · 적중마다 출혈 +1 (검은 검신에 금색과 주황색 장식)'},
      {n: '검은 세이버 · 암전', fx: {atk: 10, spd: 2}, dice: [2, 7], wx: {hitBleed: 2}, e: '공+10 · 속도+2 · 피해 2d7 · 적중마다 출혈 +2 (1차 강화)'},
      {n: '검은 세이버 · 처형', fx: {atk: 13, spd: 3}, dice: [2, 8], wx: {hitBleed: 2, finish: {at: 0.3, dmg: 6}}, e: '공+13 · 속도+3 · 피해 2d8 · 적중마다 출혈 +2 · 상대 HP 30% 이하면 피해 +6 (2차 강화)'}]},
    rb: {id: 'w_clone', lv: [
      {n: '복제 단검', fx: {atk: 3, eva: 2}, dice: [2, 4], e: '공+3 · 회피+2 · 피해 2d4 (부화장에서 쥐여 준 단검)'},
      {n: '번호 없는 단검', fx: {atk: 5, eva: 2}, dice: [2, 5], e: '공+5 · 회피+2 · 피해 2d5'},
      {n: '번호 없는 단검', fx: {atk: 5, eva: 4}, dice: [2, 5], wx: {hitBleed: 1}, e: '공+5 · 회피+4 · 피해 2d5 · 적중마다 출혈 +1'},
      {n: '존재의 단검', fx: {atk: 8, eva: 4}, dice: [2, 6], wx: {hitBleed: 1, finish: {at: 0.3, dmg: 5}}, e: '공+8 · 회피+4 · 피해 2d6 · 적중마다 출혈 +1 · 상대 HP 30% 이하면 피해 +5'}],
      /* 팀마다 시작 무기의 모양이 다르다(능력치는 같고 이름·피해 주사위·적중 키워드만 바뀐다). 토끼 자동소총과 단검 · 순록 카두세우스(지팡이) · 코뿔소 해머와 대형 방패 */
      team: {
        '토끼팀': [
          {n: '보급 자동소총과 단검', dice: [2, 4], wx: {}, e: '공+3 · 회피+2 · 피해 2d4'},
          {n: '개조 자동소총과 단검', dice: [2, 5], wx: {}, e: '공+5 · 회피+2 · 피해 2d5'},
          {n: '개조 자동소총과 단검', dice: [2, 5], wx: {hitBleed: 1}, e: '공+5 · 회피+4 · 피해 2d5 · 적중마다 출혈 +1'},
          {n: '번호 없는 자동소총과 단검', dice: [2, 6], wx: {hitBleed: 1, finish: {at: 0.3, dmg: 5}}, e: '공+8 · 회피+4 · 피해 2d6 · 적중마다 출혈 +1 · 상대 HP 30% 이하면 피해 +5'}],
        '순록팀': [
          {n: '카두세우스', dice: [2, 4], wx: {}, e: '공+3 · 회피+2 · 피해 2d4'},
          {n: '조율된 카두세우스', dice: [2, 5], wx: {}, e: '공+5 · 회피+2 · 피해 2d5'},
          {n: '조율된 카두세우스', dice: [2, 5], wx: {hitKw: [['sink', 1]]}, e: '공+5 · 회피+4 · 피해 2d5 · 적중마다 침잠 +1'},
          {n: '번호 없는 카두세우스', dice: [2, 6], wx: {hitKw: [['sink', 1]], finish: {at: 0.3, dmg: 5}}, e: '공+8 · 회피+4 · 피해 2d6 · 적중마다 침잠 +1 · 상대 HP 30% 이하면 피해 +5'}],
        '코뿔소팀': [
          {n: '해머와 대형 방패', dice: [1, 8], wx: {}, e: '공+3 · 회피+2 · 피해 1d8'},
          {n: '개조 해머와 대형 방패', dice: [1, 10], wx: {}, e: '공+5 · 회피+2 · 피해 1d10'},
          {n: '개조 해머와 대형 방패', dice: [1, 10], wx: {hitKw: [['rupture', 1]]}, e: '공+5 · 회피+4 · 피해 1d10 · 적중마다 파열 +1'},
          {n: '번호 없는 해머와 대형 방패', dice: [1, 12], wx: {hitKw: [['rupture', 1]], finish: {at: 0.3, dmg: 5}}, e: '공+8 · 회피+4 · 피해 1d12 · 적중마다 파열 +1 · 상대 HP 30% 이하면 피해 +5'}]}},
    hw: {id: 'w_hongwon', lv: [
      {n: '홍원의 장도', fx: {atk: 3, eva: 2}, dice: [2, 4], e: '공+3 · 회피+2 · 피해 2d4 (가문의 의례용 장도)'},
      {n: '후보의 장도', fx: {atk: 5, eva: 2}, dice: [2, 5], e: '공+5 · 회피+2 · 피해 2d5'},
      {n: '후보의 장도', fx: {atk: 5, eva: 4}, dice: [2, 5], wx: {hitInk: 1}, e: '공+5 · 회피+4 · 피해 2d5 · 적중마다 수흔 +1'}],
      host: {n: '가주의 장도', fx: {atk: 8, eva: 4}, dice: [2, 6], wx: {hitInk: 1, lightUp: 1}, e: '공+8 · 회피+4 · 피해 2d6 · 적중마다 수흔 +1 · 전투 시작 빛 +1'},
      free: {n: '가주의 장도', fx: {atk: 5, eva: 7}, dice: [2, 6], wx: {hitInk: 1, inkCap: 4}, e: '공+5 · 회피+7 · 피해 2d6 · 적중마다 수흔 +1 · 수흔 스택 한도 +4'}}},
  /* R사 팀 배치 기준: 위에서부터 맞는 것이 있으면 그 팀으로 고정(속도형 토끼 · 체력형 코뿔소 · 회피형 순록), 없으면 무작위 */
  rbTeamRule: [['spd', 4, '토끼팀'], ['eva', 3, '순록팀'], ['maxHp', 71, '코뿔소팀']],
  /* 해금 출생 줄기(route): 처분 의뢰의 준비물 최대 개수, 준비 뒤 대상을 만나기까지 걸리는 해 */
  route: {kitMax: 3, huntGap: 2},
  rb: {teamBonus: {'토끼팀': {spd: 3}, '코뿔소팀': {maxHp: 10}, '순록팀': {eva: 3}} /* 부화장 출생 때 고르는 팀 보정 */, total: 13, healPct: 0.5, fleeAt: 38, fleeRand: 4, chaseGap: 3, hides: 2, team: [[34, '토끼팀'], [67, '순록팀'], [100, '코뿔소팀']], foes: {'까마귀팀': 'rh2', '코뿔소팀': 'rh3', '순록팀': 'rh4', '토끼팀': 'rh5'}, headFrom: 64, headGap: 1, bossGap: 3, head: ['baral'], boss: 'rcorp_boss', xp: 4, trial: {baral: {hp: 0.75, atk: -1}, zena: {hp: 0.75, atk: -1}}},
  /* 오딘의 눈: 일반은 순간의 예지(첫 라운드 first, 이후 after). 보냐텔리 가문은 패시브 가속하는 미래(cycle 순서로 반복, 마지막 칸은 과부하)와 버프 예지안(전용 검술 카드 피해 +yeji) */
  odin: {midStart: 2, midHit: 1, first: 30, after: 15, cycle: [40, 35, 30, -10], yeji: 2},
  middle: {def: 2, keep: 0, heal: 1, dmg: 1, dr: [0, 0, 10, 30], evaEff: [1, 1, 0.5, 0], evaDr: 0.5, drCap: 50, counter: 3, sinkHit: 0.5, cap: 10},
  /* 의리 순례(중지 전용 루트): 동생(fi 1) 이상이 되면 해마다 chance%로 원한의 책 제안, 거절하면 gap년 뒤 다시. 둘째 장 전투에서 아우가 맞으면(kin) 분노 +anger, 셋째 장 시험은 rounds라운드 버티기 */
  giri: {fi: 1, fi2: 2, chance: 60, gap: 5, bigBro: {chance: 50, ppFrac: 0.2, dc: 50, failHp: 6, gap: 1} /* 작은형님이 서열 점수의 ppFrac 이상 모으면 해마다 chance%: 큰형님의 시험 */, kin: 50, anger: 5},
  /* 약지 작품: 적중할 때마다 +1(최대 max, 전투 한정). 스택당 명중 +hit · 피해 +dmg, max에 닿으면 다음 적중 피해 ×finish 후 스택이 after로 줄어든다 */
  ring: {max: 6, hit: 2, dmg: 0, finish: 1.5, after: 3},
  office: {rank: 5, foundEvery: 5, knockEvery: 4},
  relicEvent: {year: 15, chance: 1},
  /* 레바테인: 봉인 상태에서 화상을 unlock번 걸면 해방. 해방 후 자신은 전투 시작 화상 1, selfEvery라운드마다 +1, blueAt 이상이면 자신도 푸른 화염(명중 −selfBlueHit) */
  /* 레바테인 해방 단계: 붉은 화염을 건 횟수가 at에 닿을 때마다 한 단계씩 풀린다. f는 완료 성능에 대한 비율(공격 · 피해 주사위 · 푸른 화염 배율과 점화 · 자신 푸른 화염 명중 감소). f 0.5 이상부터 상대의 붉은 화염이 푸른 화염으로 바뀐다 */
  /* 공방 해결사의 유물: 유물 장비는 쓸 수 없으니 얻는 즉시 공방 무기에 깃든다 */
  wsRelic: {gungnir: {start: 1, max: 5, per: 2, n: '궁니르의 공명', e: '적중마다 공명 +1 (최대 5, 전투 시작 때 1) · 공명 1당 적중 피해 +2 (최대 +10)'},
    laev: {hit: 1, n: '특수 화염', e: '적중마다 상대에게 붉은 화염 1 (붉은 화염은 줄지 않고 쌓이며 5스택이면 푸른 화염 · 받는 피해 ×2 · 라운드마다 스택×2 피해). 자신의 화염과 명중 감소는 없다'},
    odin: {need: 3, extra: 3, eva: 10, n: '룬 새김', e: '회피 +10 (미약한 가속) · 적중마다 룬 1(최대 3). 룬이 3개이면 다음 적중에서 룬을 모두 소모해 무기 주사위 3개를 더 굴린다'}},
  laev: {stages: [{at: 20, id: 'laev_s1', f: 0.25, n: '1단계 해방'}, {at: 45, id: 'laev_s2', f: 0.5, n: '2단계 해방'}, {at: 80, id: 'laev', f: 1, n: '해방 완료'}], selfEvery: 1, blueAt: 5, blueDot: 2, blueMul: 2, selfBlueHit: 30},
  /* 엄지 검술(덱 고정): 카드를 얻는 자리마다 대신 받는 돈 */
  lockedCardMoney: 200,   // 카드 보상을 받을 때마다 카드와 함께 주는 돈(고정 200안). 덱이 고정이거나 전용 카드팩이면 카드는 편집 가능한 다른 카드팩으로 들어간다
  /* 공방 해결사: 4년차 갈림길에 chance% 확률로 제안. 1d die에서 minRoll 이상이면 성공. 공방 물건 할인율, 보관함 판매 비율 */
  /* 공방 해결사의 작업대: 공방 해결사가 되면 전용 무기·방어구·의수를 받고, 이 셋은 빼거나 바꿀 수 없다 (능력치 하나가 1인 장비로 시작).
     다른 무기·방어구는 모두 재료: 보관함 장비를 녹여 끝없이 강화한다.
     일반 재료: 단계마다 필요한 개수가 needEvery단계마다 1개씩 늘어난다 (1+⌊단계/needEvery⌋개). 히든 재료: 1개에 바로 1단계.
     의수는 히든 의수 하나를 넣어 공격·회피·명중 중 하나를 +pick 올리는 한 번뿐인 개조만 할 수 있다 */
  /* 평범한 적에게 붙은 단서 이름 (enemy.lead). 같은 단서를 3번 쌓으면 연관된 히든 보스가 나타날 확률이 오른다 */
  leads: {hollow: '문 없는 방의 흔적', tune: '소리 없는 연주회장의 흔적', finger: '손가락의 연줄', debt: '밀린 장부', blade: '칼 가는 소리', heat: '식지 않은 열기', seek: '누군가를 찾는 눈'},
  /* 공격과 명중: 공격은 hitPer배(소수점 버림)만큼 명중을 올리고, dmgPer마다 피해 +1을 한계 없이 더한다. 명중 스탯은 명중만 올린다 */
  atkRule: {on: true, hitPer: 0.5, dmgPer: 6},
  /* 무기와 보조 장비는 각각 라운드마다 한 키워드로 kwTurnCap까지, 둘을 합쳐 kwTurnTotal까지 부여할 수 있다(공방 지팡이의 집중 키워드는 제외). 상대에게 쌓이는 키워드 자체의 한계는 그대로 */
  kwTurnCap: 5, kwTurnTotal: 10,
  /* 무기의 적중 한 번이 거는 양의 상한(키워드별). 있으면 라운드 제한 대신 이 값을 쓴다: 파열은 소모가 빨라서 타수마다 5까지 (쌓이는 최대치는 그대로) */
  kwHitCap: {rupture: 5},
  ws: {
    needEvery: 10, priceYearUp: 0.25, priceYearEvery: 20 /* 공방 해결사가 사는 공방 물건의 값은 고정이고, 20년차마다 원래 값의 25%씩 오른다 (예전에는 재료로 쓸 때마다 올랐다) */,
    /* 기본값은 공방 1등급 물건 중 가장 낮은 것 수준 (날 세운 단검 · 누빈 작업복 · 중고 의수) */
    /* 재료 가치: 녹이는 일반 재료의 등급(상점 가격)에 따라 강화 점수가 달라진다 (비싼 장비를 녹일수록 많이 오른다). 한 단계에 필요한 점수는 wsNeed */
    matValue: {1: 1, 2: 2, 3: 3, 4: 5, 5: 7},
    weapon: {n: '작업대의 칼날', base: {atk: 2, spd: 1}, dice: [1, 6], normal: {atk: 2}, hidden: {dmgB: 3, atk: 2}},
    /* 방어구의 받는 피해 감소는 drMax%까지만 (전체 합계 상한 drCap 70% 안에서 다른 감소량이 밀려나지 않게). 체력·회피·재생은 상한 없이 계속 오른다 */
    armor: {n: '공방 작업복', base: {maxHp: 4}, normal: {maxHp: 4}, hidden: {dr: 3, eva: 3, maxHp: 4}, drMax: 30},
    /* 의수: 일반 강화 한 단계마다 속도 +1(히든 한 번마다 공격 +2 · 회피 +1 · 명중 +1), 5·10·15단계마다 출혈·파열·화상 중 하나를 골라 적중마다 거는 키워드로 더한다 (kwAmt). pick은 예전 저장의 히든 의수 개조 값 */
    aug: {n: '공방 의수', base: {spd: 1, eva: 1}, normal: {spd: 1}, hidden: {atk: 2, eva: 1, hit: 1}, pick: 5, pickAmt: {atk: 3, eva: 3, hit: 6}, stats: {atk: '공격', eva: '회피', hit: '명중'},
      /* 종류(의수 · 의복 · 지팡이 · 단말기 · 계약서 · 장치): 기본 보너스(baseKind, 의수는 base)와 일반 강화 한 단계당 값(normalKind, 소수는 내림해 쌓인다)이 다르다.
         의수 올라운더 + 키워드 · 의복 HP와 회복 · 지팡이 넘친 명중 · 단말기 판정과 회피 · 계약서 피해 · 장치 공격. 히든 강화는 종류와 상관없이 같다 */
      normalKind: {aug: {spd: 1, atk: 0.5, eva: 0.5}, cloth: {maxHp: 3, regen: 0.1}, staff: {atk: 1.5, hit: 1}, term: {check: 1.2, eva: 1}, pact: {dmgB: 1}, dev: {atk: 2}},
      baseKind: {cloth: {maxHp: 18}, staff: {hit: 4, atk: 2}, term: {check: 4, eva: 3}, pact: {dmgB: 2}, dev: {atk: 4}},
      kindE: {aug: '속도+1 · 회피+1', cloth: 'HP+18', staff: '공격+2 · 명중+4 · 집중 키워드', term: '판정+4 · 회피+3', pact: '피해+2', dev: '공격+4'},
      /* 히든 강화 kwHidden번마다 이 가운데 하나(같은 캐릭터는 늘 같은 순서)가 적중마다 +1 걸린다. 같은 키워드가 나오면 쌓인다 */
      kwHidden: 4, hiddenKwPool: ['bleed', 'rupture', 'burn', 'sink'],
      /* 특수 강화(5·10·15단계): 의수는 키워드 하나를 골라 적중마다 건다(kwAmt, 같은 키워드를 거듭 골라도 된다). 나머지 종류는 단계마다 정해진 보너스 */
      bigKind: {aug: [{}, {}, {adv: 1}], cloth: [{maxHp: 8, regen: 1}, {maxHp: 8, regen: 1}, {maxHp: 16, rShield: 10}], term: [{check: 5, eva: 3}, {check: 5, eva: 3}, {check: 8, eva: 5, foeSink: 3}], pact: [{dmgB: 3}, {dmgB: 5}, {extraHit: 1}], dev: [{atk: 5}, {atk: 5}, {atk: 10, rFirst: 30}]},
      kwList: ['bleed', 'rupture', 'burn'], kwAmt: [1, 1, 1],
      /* 지팡이: 고른 키워드(기본 출혈). 일반 강화 한 단계마다 그 키워드를 상대에게 쌓는 최대치 +1(카드·무기·보조 장비 모두),
         특수 강화(5·10·15단계)마다 적중 시 +staffKwAmt, 히든 4번마다 +1 */
      staffKwAmt: 1},
    /* 커스텀 의수: 공방 해결사가 한 번 포인트(pts)를 나눠 만든다. 공격은 atkCost 포인트에 +atkPer, 회피는 evaCost 포인트에 +1, 체력은 hpCost 포인트에 +hpPer, 패시브 하나는 passCost 포인트 */
    cust: {pts: 35, atkCost: 3, atkPer: 2, evaCost: 3, hpCost: 2, hpPer: 5, passCost: 5,
      pass: {react: {n: '반응 회로', e: '전투 시작 후 2라운드 동안 회피 +10'}, absorb: {n: '흡수 코어', e: '라운드마다 HP +3'}, over: {n: '과부하 코어', e: '라운드 첫 공격 피해 +4'}}},
    /* 전투 승리 보상: 재료용 무기·방어구·의수 중 하나를 전투를 matWins번 이길 때마다 (무한 모드는 matGapInf해마다 한 번) */
    matWins: 2, matGapInf: 5,
    /* 특수 강화(대강화): 강화 5·10·15단계에서만 한 번씩 크게 오른다. 15단계 뒤로는 일반 강화(단계당 수치)만 끝없이 이어진다 */
    big: {at: [5, 10, 15],
      weapon: [{dmgB: 3}, {atk: 5}, {dmgB: 4, spd: 3}],
      armor: [{maxHp: 14, regen: 1}, {maxHp: 14, dr: 3}, {maxHp: 28, regen: 2}]}
  },
  /* 특색 + 소지: 신(心)·망(望). 신: 전투 시작에 정신력 shinCost, 받는 피해 −takeShin · 주는 피해 +dealShin. 망: ringEvery라운드마다 하나(정신력 ringCost 순서대로), 망마다 주는 피해 +dealRing · 명중 +ringHit, 최대 maxRings(소지의 별 수 이내). 전투를 이기면 정신력 winMind 회복 */
  shinmang: {on: true, shinCost: 2, ringEvery: 3, ringCost: [3, 4, 5], maxRings: 3, takeShin: 0.10, dealShin: 0.10, dealRing: 0.08, ringHit: 3, winMind: 3},
  /* 특색 기념 의뢰: 특색을 받고 gap해 뒤에 소속별 전용 의수(의안·신체 개조) 설계 의뢰가 온다. 사양하면 retry해 뒤에 다시 */
  custEvent: {gap: 1, retry: 3},
  /* 특색 위력: 특색을 가진 동안 전투마다 피해·명중·회피 중 하나가 무작위로 정해지고, HP가 hpMin 이상일 때만 켜진다 */
  colorBuff: {on: true, hpMin: 0.7, dmg: 4, hit: 10, eva: 8},
  workshopFixer: {chance: 20, die: 5, minRoll: 4, discount: 0.2, sell: 0.5, sellBase: 100, hiddenSell: 2500, hiddenSellPer: 800, cardBase: 300, cardPer: 30, cardMax: 3 /* 카드 판매: 방문마다 cardMax장까지, 값은 cardBase + 카드 비용 × cardPer (지금은 300 + 비용 1마다 30) */},
  /* 출신 진로 보정: 그 진로의 권유 사건이 (보정값 × 이 값)% 확률로 먼저 나온다 */
  pathEventMul: 2,
  /* 전투 승리 후 해결사 등록 판정 난이도 (1d100 + 해결사 진로 보정) */
  winLicenseDc: 60,
  /* 소속 선택이 열리는 해 */
  /* 약지 작품 사건: need = '모아 둔 재료'(재료 수집) 소모량 · dc = 품평회 난이도 · bonus = 작품 성격별 평가 보정 · made = 제작에 성공했을 때 보정 · goodNeed = 갤러리까지 필요한 예술적 평가 수 · gap = 사건 사이 간격(해) · cycleGap = 한 작품이 끝난 뒤 다음 작품까지 · income = 갤러리 연 수입 */
  /* 특색 전용 보조 장비: 종류마다 기본으로 붙는 보너스 (고르는 맛) */
  custKinds: {aug: {n: '의수', fx: {spd: 1}, e: '속도+1'}, cloth: {n: '의복', fx: {maxHp: 10, eva: 1}, e: 'HP+10 · 회피+1'}, staff: {n: '지팡이', fx: {hit: 3}, e: '명중+3'}, term: {n: '단말기', fx: {check: 3}, e: '판정 +3'}, pact: {n: '계약서', fx: {dr: 3}, e: '받는 피해 −3%'}, dev: {n: '장치', fx: {atk: 2, hit: 1}, e: '공+2 · 명중+1'}},
  infPromo: {gap: 5, chance: 70} /* 외곽에서 승급이 막힌 사람을 위한 과거의 승급 심사장: gap해마다 chance% */,
  art: {need: 5, stockMax: 20, dc: 55, bonus: {mad: 4, ext: 6, ref: 2}, made: 3, goodNeed: 2, gap: 1, cycleGap: 2, masterEye: {chance: 60, dc: 55, failHp: 4, retry: 2} /* 도슨트가 예술적 평가를 1번(또는 아무 평가 2번) 받은 뒤 해마다 chance%: 대작을 내건다. 성공하면 예술적 평가가 모두 채워져 갤러리가 열린다 */, income: 300, visit: {chance: 30, money: 600}, patron: {chance: 8, money: 2500}, madHp: 8, failMind: 2, failHp: 4, badLose: 0.33},
  affiliationYear: 4,
  /* 손가락 출신(조직 출신 · 보냐텔리 가문): 이 해에 손가락이 먼저 찾아온다(받아들이면 입단) */
  fingerEarly: {year: 1},
  /* 거미집(손가락 전용 장기 스토리): 조직 출신·보냐텔리 가문만. 초기 제안(입단 뒤 inviteYear해)을 받아들이면 제자 루트, 거절한 뒤 간부급이 되면 스승 루트 제안.
     40턴을 5턴=1해로 흐르게 한다(앞의 4턴은 해가 지나지 않는다, 워프열차처럼). reward: 선택지의 size → 능력치(보통은 손가락 주제 능력치 +1, 큼은 +2와 HP +2) */
  web: {inviteYear: 2, holdGap: 2, turnsPerYear: 5, dc: {작음: 45, 보통: 50, 큼: 58},
    reward: {작음: {maxHp: 3}, 보통: 1, 큼: 2}, themeAmt: {maxHp: 4},
    theme: {'엄지': 'atk', '검지': 'spd', '중지': 'maxHp', '약지': 'check', '소지': 'eva'},
    role: {'엄지': '언더보스', '검지': '대행자', '중지': '큰형님', '약지': '마에스트로', '소지': '인의예지'},
    child: '제자', endTitle: {complete: '이어진 실', apart: '각자의 길', accomplice: '같은 매듭', left: '남겨진 자리', revolt: '끊어낸 실'},
    endName: {complete: '완성된 관계', apart: '각자의 길', accomplice: '서로의 공범', left: '남겨진 자리', revolt: '재료의 반란'}},
  /* 성장: 판정 성공/실패/판정 없음/전투 승리 경험치, 레벨별 누적 경험치 */
  /* 레벨 보너스: at레벨마다(8, 16, 24…) 모든 전투에서 빛과 빛 최대치 +up */
  lvLight: {at: 8, up: 1},
  xp: {ok: 2, fail: 1, plain: 1, win: 4},
 
  /* 레벨 필요 경험치: 레벨 하나(L)를 올리는 데 lvCurve.base × 2^(floor(L÷every)) — 8, 16, 24… 레벨부터 2배씩 어려워진다. levels[i]는 레벨 i+1의 누적 경험치 */
  /* 새 카드를 얻을 때 보여 주는 후보 수 (성장·전투 보상·암시장 상자). 후보 가운데 하나를 고르거나 모두 버린다 */
  cardPick: {n: 3},
  lvCurve: LV_CURVE,
  levels: LEVELS,
  /* 시뮬: 고정 전투 직전마다 쌓인다고 보는 레벨 업 수 (경험치 표 기준 추정) */
  simGrowth: [0, 2, 1]
};
