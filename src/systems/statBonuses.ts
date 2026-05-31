import type { PlayerStats } from '../db/models';

type BonusEffect = {
  xpMultiplier?: number;
  goldMultiplier?: number;
  goldFlat?: number;
  pomodoroExtraTime?: number;
  decayReduction?: Partial<PlayerStats>;
  penaltyReduction?: number;
  staminaCapBonus?: number;
  shopPriceIncrease?: number;
};

type StatKey = keyof PlayerStats;

// 每个属性的 Lv.3 / Lv.5 / Lv.8 增益
const BONUSES: Record<StatKey, Record<number, BonusEffect>> = {
  study: {
    3: { xpMultiplier: 0.1 },
    5: { pomodoroExtraTime: 10 },
    8: { goldFlat: 3 },
  },
  health: {
    3: { decayReduction: { stamina: 0.1 } },
    5: { penaltyReduction: 0.5 },
    8: { staminaCapBonus: 1 },
  },
  social: {
    3: { xpMultiplier: 0.05 },
    5: { decayReduction: { mood: 0.05 } },
    8: { },
  },
  mood: {
    3: { goldFlat: 2 },
    5: { goldMultiplier: 0.05 },
    8: { },
  },
  willpower: {
    3: { xpMultiplier: 0.1 },
    5: { },
    8: { shopPriceIncrease: 3 },
  },
  stamina: {
    3: { xpMultiplier: 0.1 },
    5: { decayReduction: { stamina: 0.1 } },
    8: { goldFlat: 10 },
  },
};

export function getStatBonus(stats: PlayerStats): BonusEffect {
  const bonus: BonusEffect = {};
  for (const key of Object.keys(stats) as StatKey[]) {
    const level = stats[key];
    for (const tier of [3, 5, 8]) {
      if (level >= tier && BONUSES[key]?.[tier]) {
        const b = BONUSES[key][tier];
        // XP multiplier (take highest)
        if (b.xpMultiplier && (!bonus.xpMultiplier || b.xpMultiplier > bonus.xpMultiplier)) {
          bonus.xpMultiplier = b.xpMultiplier;
        }
        // Gold multiplier (take highest)
        if (b.goldMultiplier && (!bonus.goldMultiplier || b.goldMultiplier > bonus.goldMultiplier)) {
          bonus.goldMultiplier = b.goldMultiplier;
        }
        // Gold flat (accumulate)
        if (b.goldFlat) {
          bonus.goldFlat = (bonus.goldFlat || 0) + b.goldFlat;
        }
        // Pomodoro extra time
        if (b.pomodoroExtraTime && (!bonus.pomodoroExtraTime || b.pomodoroExtraTime > bonus.pomodoroExtraTime)) {
          bonus.pomodoroExtraTime = b.pomodoroExtraTime;
        }
        // Decay reduction (accumulate)
        if (b.decayReduction) {
          bonus.decayReduction = { ...bonus.decayReduction };
          for (const dk of Object.keys(b.decayReduction) as (keyof PlayerStats)[]) {
            const prev = bonus.decayReduction[dk] || 0;
            bonus.decayReduction[dk] = prev + (b.decayReduction[dk] || 0);
          }
        }
        // Penalty reduction
        if (b.penaltyReduction && (!bonus.penaltyReduction || b.penaltyReduction > bonus.penaltyReduction)) {
          bonus.penaltyReduction = b.penaltyReduction;
        }
        // Stamina cap bonus
        if (b.staminaCapBonus) {
          bonus.staminaCapBonus = (bonus.staminaCapBonus || 0) + b.staminaCapBonus;
        }
        // Shop price increase
        if (b.shopPriceIncrease && (!bonus.shopPriceIncrease || b.shopPriceIncrease > bonus.shopPriceIncrease)) {
          bonus.shopPriceIncrease = b.shopPriceIncrease;
        }
      }
    }
  }
  return bonus;
}

export function getEffectiveMaxStat(stats: PlayerStats, key: StatKey): number {
  if (key === 'stamina') {
    const bonus = getStatBonus(stats);
    return 10 + (bonus.staminaCapBonus || 0);
  }
  return 10;
}

export function getDecayAmount(stats: PlayerStats, decay: Partial<PlayerStats>): Partial<PlayerStats> {
  const bonus = getStatBonus(stats);
  const result: Partial<PlayerStats> = {};
  for (const key of Object.keys(decay) as (keyof PlayerStats)[]) {
    const base = decay[key] || 0;
    const reduction = bonus.decayReduction?.[key] || 0;
    result[key] = Math.min(0, base + reduction); // never positive
  }
  return result;
}
