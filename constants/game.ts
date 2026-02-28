export type UnitClass = "warrior" | "mage" | "archer" | "paladin" | "rogue";

export interface UnitTemplate {
  class: UnitClass;
  name: string;
  maxHp: number;
  attack: number;
  attackInterval: number;
  cost: number;
  icon: string;
  color: string;
  description: string;
  ability: string;
}

export interface BoardUnit {
  id: string;
  template: UnitTemplate;
  currentHp: number;
  isPlayer: boolean;
  slot: number;
  stars: number;
}

export interface ActiveUnit extends BoardUnit {
  hp: number;
  nextAttackAt: number;
  hasAttacked: boolean;
}

export interface BattleEvent {
  attackerId: string;
  targetId: string;
  damage: number;
  targetHpAfter: number;
  targetDied: boolean;
  time: number;
  isCrit?: boolean;
  isSplash?: boolean;
  isHeal?: boolean;
  isFlee?: boolean;
}

export type GamePhase = "home" | "prep" | "battle" | "results" | "gameover" | "victory";

export interface ShopItem {
  template: UnitTemplate;
  id: string;
  sold: boolean;
}

export interface SynergyDef {
  class: UnitClass;
  name: string;
  description: string;
  threshold: number;
  icon: string;
  color: string;
}

export interface ActiveSynergy {
  def: SynergyDef;
  count: number;
  active: boolean;
}

export interface MatchRecord {
  id: string;
  date: string;
  result: "win" | "lose";
  roundReached: number;
  xpGained: number;
}

export interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  bestRound: number;
  xp: number;
  matchHistory: MatchRecord[];
}

export interface RankDef {
  name: string;
  minXp: number;
  maxXp: number;
  color: string;
  icon: string;
}

export const RANKS: RankDef[] = [
  { name: "Copper", minXp: 0, maxXp: 300, color: "#B87333", icon: "shield-outline" },
  { name: "Iron", minXp: 300, maxXp: 700, color: "#9CA3AF", icon: "shield-half-outline" },
  { name: "Silver", minXp: 700, maxXp: 1200, color: "#C0C0B0", icon: "shield" },
  { name: "Gold", minXp: 1200, maxXp: 1900, color: "#D4A44C", icon: "diamond-outline" },
  { name: "Elder", minXp: 1900, maxXp: 2800, color: "#8B6BAA", icon: "diamond" },
  { name: "Legend", minXp: 2800, maxXp: -1, color: "#C45B4A", icon: "flame" },
];

export interface RankInfo {
  name: string;
  level: number;
  color: string;
  icon: string;
  progress: number;
  xpInLevel: number;
  xpPerLevel: number;
  totalXp: number;
}

export function getRankInfo(xp: number): RankInfo {
  for (let i = 0; i < RANKS.length; i++) {
    const r = RANKS[i];
    if (r.maxXp === -1 || xp < r.maxXp) {
      const rankXp = xp - r.minXp;
      const isLegend = r.maxXp === -1;
      const levelSize = isLegend ? 500 : Math.ceil((r.maxXp - r.minXp) / 3);
      const level = isLegend ? Math.floor(rankXp / levelSize) + 1 : Math.min(3, Math.floor(rankXp / levelSize) + 1);
      const xpInLevel = rankXp - (level - 1) * levelSize;
      return {
        name: r.name,
        level,
        color: r.color,
        icon: r.icon,
        progress: Math.min(1, xpInLevel / levelSize),
        xpInLevel,
        xpPerLevel: levelSize,
        totalXp: xp,
      };
    }
  }
  const last = RANKS[RANKS.length - 1];
  return { name: last.name, level: 1, color: last.color, icon: last.icon, progress: 0, xpInLevel: 0, xpPerLevel: 500, totalXp: xp };
}

export function calcXpGain(won: boolean, roundReached: number): number {
  return won ? 25 + roundReached * 3 : 10 + roundReached * 2;
}

export const UNIT_TEMPLATES: Record<UnitClass, UnitTemplate> = {
  warrior: {
    class: "warrior",
    name: "Ironbark",
    maxHp: 130,
    attack: 22,
    attackInterval: 1100,
    cost: 1,
    icon: "shield",
    color: "#C47848",
    description: "Steadfast guardian",
    ability: "Takes 15% less damage",
  },
  mage: {
    class: "mage",
    name: "Hedge Witch",
    maxHp: 60,
    attack: 55,
    attackInterval: 1800,
    cost: 2,
    icon: "flash",
    color: "#8B6BAA",
    description: "Arcane wildcrafter",
    ability: "Splash: hits another for 35%",
  },
  archer: {
    class: "archer",
    name: "Ranger",
    maxHp: 85,
    attack: 28,
    attackInterval: 800,
    cost: 2,
    icon: "locate",
    color: "#6B9E5A",
    description: "Swift woodland scout",
    ability: "30% chance double attack",
  },
  paladin: {
    class: "paladin",
    name: "Hearthkeeper",
    maxHp: 220,
    attack: 16,
    attackInterval: 1400,
    cost: 3,
    icon: "star",
    color: "#D4A44C",
    description: "Blessed protector",
    ability: "Heals lowest ally for 15 HP",
  },
  rogue: {
    class: "rogue",
    name: "Shadowfoot",
    maxHp: 70,
    attack: 65,
    attackInterval: 1200,
    cost: 3,
    icon: "cut",
    color: "#5A8A7A",
    description: "Silent woodland thief",
    ability: "First attack is 2x critical",
  },
};

export const UNIT_CLASSES: UnitClass[] = ["warrior", "mage", "archer", "paladin", "rogue"];

export const SYNERGIES: SynergyDef[] = [
  { class: "warrior", name: "Hearthstone Wall", description: "All units take 15% less dmg", threshold: 2, icon: "shield", color: "#C47848" },
  { class: "mage", name: "Wyld Weave", description: "+25% attack to all", threshold: 2, icon: "flash", color: "#8B6BAA" },
  { class: "archer", name: "Forest Volley", description: "All units attack 15% faster", threshold: 2, icon: "locate", color: "#6B9E5A" },
  { class: "paladin", name: "Hearthglow", description: "+1 HP healed on victory", threshold: 2, icon: "star", color: "#D4A44C" },
  { class: "rogue", name: "Mossy Pact", description: "+10% attack to all", threshold: 2, icon: "cut", color: "#5A8A7A" },
];

export const MAX_BOARD_SIZE = 4;
export const MAX_BENCH_SIZE = 4;
export const SHOP_SIZE = 4;
export const STARTING_HP = 8;
export const TOTAL_ROUNDS = 10;

export const STAR_MULTIPLIERS = [1, 1.6, 2.5];

export function getStarStats(base: UnitTemplate, stars: number): { maxHp: number; attack: number } {
  const m = STAR_MULTIPLIERS[Math.min(stars, 3) - 1] || 1;
  return { maxHp: Math.round(base.maxHp * m), attack: Math.round(base.attack * m) };
}

export function computeSynergies(board: BoardUnit[]): ActiveSynergy[] {
  return SYNERGIES.map((def) => {
    const count = board.filter((u) => u.template.class === def.class).length;
    return { def, count, active: count >= def.threshold };
  });
}

export function tryMergeUnit(
  cls: UnitClass,
  board: BoardUnit[],
  bench: BoardUnit[]
): { merged: boolean; board: BoardUnit[]; bench: BoardUnit[] } {
  const all = [
    ...board.map((u) => ({ ...u, loc: "board" as const })),
    ...bench.map((u) => ({ ...u, loc: "bench" as const })),
  ];
  const candidates = all.filter((u) => u.template.class === cls && u.stars < 3).sort((a, b) => a.stars - b.stars);

  if (candidates.length === 0) return { merged: false, board, bench };

  const target = candidates[0];
  const newStars = target.stars + 1;
  const base = UNIT_TEMPLATES[cls];
  const { maxHp, attack } = getStarStats(base, newStars);
  const upgraded: BoardUnit = {
    id: target.id,
    template: { ...base, maxHp, attack },
    currentHp: maxHp,
    isPlayer: target.isPlayer,
    slot: target.slot,
    stars: newStars,
  };

  if (target.loc === "board") {
    return {
      merged: true,
      board: board.map((u) => (u.id === target.id ? upgraded : u)),
      bench,
    };
  }
  return {
    merged: true,
    board,
    bench: bench.map((u) => (u.id === target.id ? upgraded : u)),
  };
}

export function generateShop(): ShopItem[] {
  const items: ShopItem[] = [];
  for (let i = 0; i < SHOP_SIZE; i++) {
    const cls = UNIT_CLASSES[Math.floor(Math.random() * UNIT_CLASSES.length)];
    items.push({
      template: UNIT_TEMPLATES[cls],
      id: `shop_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
      sold: false,
    });
  }
  return items;
}

export function generateEnemyUnits(round: number): BoardUnit[] {
  const count = Math.min(2 + Math.floor(round / 2), MAX_BOARD_SIZE);
  const scaleFactor = 1 + (round - 1) * 0.2;
  const units: BoardUnit[] = [];
  for (let i = 0; i < count; i++) {
    const cls = UNIT_CLASSES[Math.floor(Math.random() * UNIT_CLASSES.length)];
    const t = UNIT_TEMPLATES[cls];
    const stars = round >= 7 ? 2 : 1;
    const { maxHp, attack } = getStarStats(t, stars);
    const scaledHp = Math.round(maxHp * scaleFactor);
    const scaledAtk = Math.round(attack * scaleFactor);
    units.push({
      id: `enemy_${round}_${i}_${Math.random().toString(36).slice(2)}`,
      template: { ...t, maxHp: scaledHp, attack: scaledAtk },
      currentHp: scaledHp,
      isPlayer: false,
      slot: i,
      stars,
    });
  }
  return units;
}

function applyStatSynergies(
  units: BoardUnit[],
  synergies: ActiveSynergy[]
): BoardUnit[] {
  let atkMult = 1;
  let speedMult = 1;

  for (const s of synergies) {
    if (!s.active) continue;
    switch (s.def.class) {
      case "mage":
        atkMult += 0.25;
        break;
      case "archer":
        speedMult *= 0.85;
        break;
      case "rogue":
        atkMult += 0.1;
        break;
    }
  }

  return units.map((u) => ({
    ...u,
    template: {
      ...u.template,
      attack: Math.round(u.template.attack * atkMult),
      attackInterval: Math.round(u.template.attackInterval * speedMult),
    },
  }));
}

export function simulateBattle(
  playerUnits: BoardUnit[],
  enemyUnits: BoardUnit[],
  playerSynergies: ActiveSynergy[] = []
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const alive = (units: ActiveUnit[]) => units.filter((u) => u.hp > 0);

  const buffedPlayer = applyStatSynergies(playerUnits, playerSynergies);
  const hasWarriorSyn = playerSynergies.some((s) => s.def.class === "warrior" && s.active);

  const pUnits: ActiveUnit[] = buffedPlayer.map((u, i) => ({
    ...u,
    hp: u.template.maxHp,
    nextAttackAt: Math.random() * 600 + i * 250 + 400,
    hasAttacked: false,
  }));
  const eUnits: ActiveUnit[] = enemyUnits.map((u, i) => ({
    ...u,
    hp: u.template.maxHp,
    nextAttackAt: Math.random() * 600 + i * 280 + 500,
    hasAttacked: false,
  }));

  let time = 0;
  const maxTime = 45000;

  while (time < maxTime) {
    const aliveP = alive(pUnits);
    const aliveE = alive(eUnits);
    if (aliveP.length === 0 || aliveE.length === 0) break;

    const allAlive = [...aliveP, ...aliveE];
    const next = allAlive.reduce((min, u) =>
      u.nextAttackAt < min.nextAttackAt ? u : min
    );

    time = next.nextAttackAt;

    const isPlayerUnit = pUnits.includes(next);
    const targets = isPlayerUnit ? alive(eUnits) : alive(pUnits);
    const allies = isPlayerUnit ? alive(pUnits) : alive(eUnits);
    if (targets.length === 0) break;

    const target = targets[Math.floor(Math.random() * targets.length)];
    let dmg = next.template.attack;

    const isCrit = next.template.class === "rogue" && !next.hasAttacked;
    if (isCrit) dmg = Math.round(dmg * 2);
    next.hasAttacked = true;

    if (target.template.class === "warrior") {
      dmg = Math.round(dmg * 0.85);
    }
    if (pUnits.includes(target) && hasWarriorSyn) {
      dmg = Math.round(dmg * 0.85);
    }

    target.hp = Math.max(0, target.hp - dmg);
    events.push({
      attackerId: next.id,
      targetId: target.id,
      damage: dmg,
      targetHpAfter: target.hp,
      targetDied: target.hp <= 0,
      time,
      isCrit,
    });

    if (next.template.class === "mage") {
      const otherTargets = targets.filter((t) => t.id !== target.id && t.hp > 0);
      if (otherTargets.length > 0) {
        const splash = otherTargets[Math.floor(Math.random() * otherTargets.length)];
        const splashDmg = Math.round(dmg * 0.35);
        splash.hp = Math.max(0, splash.hp - splashDmg);
        events.push({
          attackerId: next.id,
          targetId: splash.id,
          damage: splashDmg,
          targetHpAfter: splash.hp,
          targetDied: splash.hp <= 0,
          time: time + 50,
          isSplash: true,
        });
      }
    }

    if (next.template.class === "paladin") {
      const wounded = allies.filter((a) => a.id !== next.id && a.hp > 0 && a.hp < a.template.maxHp);
      if (wounded.length > 0) {
        const lowest = wounded.reduce((min, a) => (a.hp < min.hp ? a : min));
        const healAmt = 15;
        lowest.hp = Math.min(lowest.template.maxHp, lowest.hp + healAmt);
        events.push({
          attackerId: next.id,
          targetId: lowest.id,
          damage: healAmt,
          targetHpAfter: lowest.hp,
          targetDied: false,
          time: time + 80,
          isHeal: true,
        });
      }
    }

    if (next.template.class === "archer" && Math.random() < 0.3) {
      const doubleTargets = isPlayerUnit ? alive(eUnits) : alive(pUnits);
      if (doubleTargets.length > 0) {
        const t2 = doubleTargets[Math.floor(Math.random() * doubleTargets.length)];
        let dmg2 = next.template.attack;
        if (t2.template.class === "warrior") dmg2 = Math.round(dmg2 * 0.85);
        t2.hp = Math.max(0, t2.hp - dmg2);
        events.push({
          attackerId: next.id,
          targetId: t2.id,
          damage: dmg2,
          targetHpAfter: t2.hp,
          targetDied: t2.hp <= 0,
          time: time + 120,
        });
      }
    }

    const checkFlee = (unit: ActiveUnit, t: number) => {
      if (unit.hp <= 0) return;
      const hpRatio = unit.hp / unit.template.maxHp;
      if (hpRatio > 0.2) return;
      let fleeChance = 0.18;
      if (unit.template.class === "warrior") fleeChance = 0.05;
      else if (unit.template.class === "paladin") fleeChance = 0.08;
      else if (unit.template.class === "rogue") fleeChance = 0.35;
      else if (unit.template.class === "archer") fleeChance = 0.25;
      if (Math.random() < fleeChance) {
        unit.hp = 0;
        events.push({
          attackerId: unit.id,
          targetId: unit.id,
          damage: 0,
          targetHpAfter: 0,
          targetDied: true,
          time: t + 200,
          isFlee: true,
        });
      }
    };

    if (target.hp > 0) checkFlee(target, time);

    next.nextAttackAt = time + next.template.attackInterval;
  }

  return events;
}

export function getRoundGold(round: number): number {
  return Math.min(3 + round, 8);
}

export const DEFAULT_STATS: PlayerStats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  bestRound: 0,
  xp: 0,
  matchHistory: [],
};
