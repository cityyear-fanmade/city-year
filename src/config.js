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
  breathCritPer: 5, critMult: 1.5,
  /* 순서: 1등 빛 보너스, 꼴등 추격 보정, 선제 격차와 명중 보너스 */
  orderBonusLight: 1, catchupBonus: 10, gapFirst: 30, firstHit: 10,
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
  endless: {span: 3, grades: ['도시 괴담', '도시 전설', '도시 질병', '도시 악몽', '도시의 별', '불순물'], hpMul: 0.08, atk: 1, star: 'pianist', final: 'impurity'},
  /* 정신력: 최대 max. healEvery년마다 +yearHeal. 선택지·환상체 조우 2d3 감소, 회피 실패 시 1d evadeDie에서 1이면 1 감소(E.G.O 장비 1개당 +1).
     voiceAt 이하에서 한 번 "들리는 목소리": 1d voiceDie를 voiceRolls번, 모두 voiceDc 이상이면 개화, 실패하면 1d failLoss 감소.
     0이면 사망, 1이면 뒤틀림 판정 1d2 (1이면 개화하고 가득 회복, 2면 뒤틀림 엔딩). tiers: 전투 시작 때 호흡·회피 보정 */
  mind: {max: 45, yearHeal: 1, healEvery: 2, voiceAt: 10, voiceDie: 50, voiceDc: 25, voiceRolls: 3, failLoss: 9, evadeDie: 5,
    tiers: [{at: 45, breath: 5, eva: 5}, {at: 30, breath: 3, eva: 3}, {at: 20, breath: 1, eva: 0}],
    ego: {atk: {n: '공격용', hit: 14, floor: 20, card: 'e_bloom_atk'}, def: {n: '방어용', hp: 45, eva: 3, floor: 11, card: 'e_bloom_def'}},
    /* 개화한 E.G.O를 가지면: 덱 최대 장수 +deckPlus (고정 전용 카드가 그 자리), 전투 처음 lightRounds라운드 동안 빛 +light */
    deckPlus: 1, light: 1, lightRounds: 3},
  /* 공방 거리: 1년차부터 every년마다 들를지 묻는다(해는 넘어가지 않음). blackFrom년차부터 암시장 물건 blackStock개 진열 */
  /* 육신 뒤틀림: 장비를 쓸 수 없고(전부 보관함), 상대에게 디버프를 걸 수 없다. 깡 능력치가 크게 오르고 덱은 뒤틀린 책장(도박 카드 12장, 빛 없음)으로 고정 */
  distort: {fx: {maxHp: 40, atk: 6, eva: 0, spd: 0}, deck: ['d_jackpot', 'd_jackpot', 'd_jackpot', 'd_rend', 'd_rend', 'd_rend', 'd_maw', 'd_maw', 'd_thrash', 'd_thrash', 'd_coin', 'd_curl']},
  shop: {every: 3, blackFrom: 12, blackStock: 3, delCost: 500, delMax: 3, minDeck: 4, restMind: 5},
  /* 타고난 것: 출생 굴림과 별개로 1/chanceDiv 확률. 시드 재현을 위해 출생 굴림 값에서 파생 (새 주사위를 쓰지 않는다) */
  innate: {chanceDiv: 100, growMul: 1.2, money: 1.2, intuitionDie: 20, psycho: 2, markYear: 30, markMul: 1.6},
  /* 카드 등급: 연차가 쌓이면 내 공격 카드가 강해진다 (from년차부터). 적중마다 피해 +b, 명중 +hit, 주사위 +dice개 */
  cardGrade: [{from: 1, n: '', b: 0, hit: 0, dice: 0}, {from: 16, n: '+1', b: 2, hit: 5, dice: 0}, {from: 31, n: '+2', b: 3, hit: 10, dice: 1}, {from: 46, n: '+3', b: 5, hit: 15, dice: 1}],
  /* 잊힌 유물: year년차가 시작될 때 반드시 나오는 사건. 1d100에서 chance 이하면 유물 선택 */
  /* 6시즌: 덱 최대 장수, 암시장 카드 상자(확률·가격) */
  deck: {max: 12},
  blackCard: {chance: 50, price: 250},
  /* 6시즌 사무소: 개설 가능 급수(이상), 개설 사건을 다시 묻는 간격, 소속 없는 해결사가 사무소 문을 두드리는 간격 */
  /* 6시즌 E.G.O 발현자: 전용 카드 '발현'을 낸 누적 횟수(need)가 차는 순간 E.G.O 무기 등급이 오른다. 등급별 수치는 birth.json egoWeapons[].grow */
  egoGrow: {need: [0, 5, 15, 30], tier: ['TETH', 'HE', 'WAW', 'ALEPH']},
  /* 6시즌 기업 루트(날개 직원): from년차부터 해마다 chance% 확률로 '특이점 개발' 제안이 한 번 온다.
     개발(devMax번 진척) → 날개 설립(이름) → 특이점 실험(강화 upMax번)·금기 실험. 금기 실험을 forbMax번 하면 머리의 시험(chain: 발톱 → 조율자 연속 전투).
     types: 특이점 효과. base는 고를 때, per는 강화 한 번마다 (warp.lead: 전투 처음 N라운드 항상 선공, serum.heal: 라운드마다 회복, moon.tier: 정신력 구간 보정 배수)
     trial: 머리의 시험 전투(상대별)에서 체력 배수·공격 가산. grow/up/forb/clear: 개발 진척·강화·금기 실험·시험 통과 때 얻는 능력치 */
  corp: {from: 20, chance: 20, devMax: 2, devGap: 2, devChance: 60, labGap: 1, labChance: 80, upMax: 3, forbMax: 2, chain: ['claw', 'arbiter'],
    types: {
      warp: {n: '워프', e: '속도 +4 · 사건 판정 +3 · 전투 처음 3라운드 항상 선공 (강화마다 속도 +2 · 판정 +2 · 선공 1라운드 더)', base: {spd: 4, check: 3}, per: {spd: 2, check: 2}, lead: 3, leadPer: 1},
      serum: {n: '혈청', e: '전투 중 매 라운드 시작에 HP 5 회복', heal: 5, per: 0},
      moon: {n: '월광석', e: '최대 정신력 +8 · 해마다 정신력 +2 · 회피 실패로 정신력이 깎이지 않는다 · 정신력 구간 보정 ×1.6 (강화마다 최대 정신력 +2 · 해마다 +1 · 보정 +0.2배)', base: {mindMax: 8}, per: {mindMax: 2}, year: 2, yearPer: 1, tier: 1.6, tierPer: 0.2}
    },
    trial: {claw: {hp: 0.45, atk: -4}, arbiter: {hp: 0.3, atk: -5}}, grow: {maxHp: 3}, up: {maxHp: 8, atk: 2}, forb: {maxHp: 12, atk: 4, eva: 2}, clear: {maxHp: 15, atk: 3, eva: 2}},
  /* 6시즌 N사 날개: 의체를 쓰지 않는다(의수 칸 사용 불가). 대신 전투마다 신체 강화(공격·회피·속도), 의체 심판: 의체 상대(enemies aug, 소개 문구에 의체가 분명한 적만) 적중마다 피해 +augDmg */
  nWing: {name: 'N사 날개', atk: 2, eva: 2, spd: 2, augDmg: 3},
  /* 6시즌 보냐텔리의 검: 강화 단계별 수치(0~5), 단계마다 필요한 재료 등급, 가속 */
  bon: {max: 5, need: [0, 1, 2, 4, 5], atk: [0, 5, 9, 13, 17, 21], eva: [0, 2, 4, 6, 8, 9], dmgB: [0, 0, 0, 1, 1, 2], accel: {max: 3, hit: 5, eva: 5}},
  /* 혈귀 특수 루트: 라만차랜드 초대장이 오는 해 */
  lamancha: {year: 16},
  /* 격리 실패: 이 해부터, 사건이 오는 해마다 확률(%) */
  abnoBreach: {from: 6, chance: 10},
  /* 네임드 적(이름이 붙는 적): 일반보다 조금 강하게 */
  named: {hp: 1, atk: 0},
  /* 특색·상석 심사: 최대 도전 횟수, 실패 후 다시 부르기까지 걸리는 해 */
  top: {tries: 3, wait: 2},
  /* 엄지 패시브 탄환: 전투마다 기본 발수 + 서열 하나 오를 때마다 추가 */
  thumbAmmo: {base: 4, per: 2},
  /* 약지 패시브 예술적 감각: 적을 쓰러뜨릴 때 확률, 최대 스택, 스택당 피해 주사위 최대치 */
  artSense: {chance: 10, max: 4, die: 5},
  office: {rank: 5, foundEvery: 5, knockEvery: 4},
  relicEvent: {year: 15, chance: 1},
  /* 레바테인: 봉인 상태에서 화상을 unlock번 걸면 해방. 해방 후 자신은 전투 시작 화상 1, selfEvery라운드마다 +1, blueAt 이상이면 자신도 푸른 화염(명중 −selfBlueHit) */
  laev: {unlock: 30, selfEvery: 1, blueAt: 5, blueDot: 2, selfBlueHit: 30},
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
