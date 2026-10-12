/* 임시 수치: 밸런스는 여기만 바꾼다. `npm run sim`으로 확인한다. */
export const CFG = {
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
  promo: {total: 192, fixerMul: 0.93, mult: [2, 1.4, 1.2, 1.1], loseFrac: 0.25, gain: {early: 3, mid: 4, late: 5, boss: 6, hidden: 10, check: 2, year: 2}, examDc: 40, examDcSpan: 15},
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
    ego: {atk: {n: '공격용', hit: 10, floor: 20}, def: {n: '방어용', hp: 30, floor: 11}}},
  /* 공방 거리: 1년차부터 every년마다 들를지 묻는다(해는 넘어가지 않음). blackFrom년차부터 암시장 물건 blackStock개 진열 */
  shop: {every: 3, blackFrom: 12, blackStock: 3, delCost: 500, delMax: 3, minDeck: 4},
  /* 타고난 것: 출생 굴림과 별개로 1/chanceDiv 확률. 시드 재현을 위해 출생 굴림 값에서 파생 (새 주사위를 쓰지 않는다) */
  innate: {chanceDiv: 100, growMul: 1.2, money: 1.2, intuitionDie: 20, psycho: 2, markYear: 30, markMul: 1.6},
  /* 카드 등급: 연차가 쌓이면 내 공격 카드가 강해진다 (from년차부터). 적중마다 피해 +b, 명중 +hit, 주사위 +dice개 */
  cardGrade: [{from: 1, n: '', b: 0, hit: 0, dice: 0}, {from: 16, n: '+1', b: 2, hit: 5, dice: 0}, {from: 31, n: '+2', b: 3, hit: 10, dice: 1}, {from: 46, n: '+3', b: 5, hit: 15, dice: 1}],
  /* 잊힌 유물: year년차가 시작될 때 반드시 나오는 사건. 1d100에서 chance 이하면 유물 선택 */
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
