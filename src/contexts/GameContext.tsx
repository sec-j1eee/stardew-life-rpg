import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { Player, PlayerStats, Achievement } from '../db/models';
import { db, getPlayer, getTotalPomodoroCount, getTotalQuestsCompleted, getConsecutiveDays, getMealsNotSkippedStreak, getEarlyWakeStreak, getTotalEarlyWakeDays, getEarlySleepStreak, getTotalStudyHours, getTotalGoodMoodDays, getAllDailyCompleteStreak, getTodaysPomoCount, getPurchaseCount, getTodaysPurchaseTotal, getTotalPurchaseAmount } from '../db/database';
import { defaultStats, xpForLevel } from '../db/models';
import { getStatBonus } from '../systems/statBonuses';

interface GameState {
  player: Player | null;
  loading: boolean;
  levelUp: boolean;
  newAchievements: Achievement[];
}

type GameAction =
  | { type: 'SET_PLAYER'; player: Player }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_LEVEL_UP'; levelUp: boolean }
  | { type: 'SET_NEW_ACHIEVEMENTS'; achievements: Achievement[] }
  | { type: 'CLEAR_ACHIEVEMENTS' }
  | { type: 'ADD_XP'; amount: number; player: Player }
  | { type: 'ADD_GOLD'; amount: number; player: Player }
  | { type: 'UPDATE_STATS'; stats: Partial<PlayerStats>; player: Player };

interface GameContextType {
  state: GameState;
  createPlayer: (name: string) => Promise<void>;
  addXP: (amount: number) => Promise<void>;
  addGold: (amount: number) => Promise<void>;
  updateStats: (stats: Partial<PlayerStats>) => Promise<void>;
  refreshPlayer: () => Promise<void>;
  resetLevelUp: () => void;
  clearAchievements: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_PLAYER':
      return { ...state, player: action.player, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_LEVEL_UP':
      return { ...state, levelUp: action.levelUp };
    case 'ADD_XP': {
      const newPlayer = { ...action.player };
      newPlayer.xp += action.amount;
      const oldLevel = newPlayer.level;

      while (newPlayer.xp >= xpForLevel(newPlayer.level)) {
        newPlayer.xp -= xpForLevel(newPlayer.level);
        newPlayer.level++;
      }

      if (newPlayer.level > oldLevel) {
        return { ...state, player: newPlayer, levelUp: true };
      }
      return { ...state, player: newPlayer };
    }
    case 'ADD_GOLD': {
      const newPlayer = { ...action.player, gold: action.player.gold + action.amount };
      return { ...state, player: newPlayer };
    }
    case 'UPDATE_STATS': {
      const newStats = { ...action.player.stats };
      for (const key in action.stats) {
        const k = key as keyof PlayerStats;
        newStats[k] = Math.min(10, Math.max(0, newStats[k] + (action.stats[k] || 0)));
      }
      const newPlayer = { ...action.player, stats: newStats };
      return { ...state, player: newPlayer };
    }
    case 'SET_NEW_ACHIEVEMENTS':
      return { ...state, newAchievements: action.achievements };
    case 'CLEAR_ACHIEVEMENTS':
      return { ...state, newAchievements: [] };
    default:
      return state;
  }
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, {
    player: null,
    loading: true,
    levelUp: false,
    newAchievements: [],
  });

  useEffect(() => {
    loadPlayer();
  }, []);

  async function loadPlayer() {
    const player = await getPlayer();
    if (player) {
      // Fix floating point precision in existing data
      const fixedStats = { ...player.stats };
      let needsFix = false;
      for (const key in fixedStats) {
        const k = key as keyof PlayerStats;
        const rounded = Math.round(fixedStats[k] * 10) / 10;
        if (fixedStats[k] !== rounded) {
          fixedStats[k] = rounded;
          needsFix = true;
        }
      }
      if (needsFix) {
        await db.players.update(player.id!, { stats: fixedStats as any });
        player.stats = fixedStats;
      }
      dispatch({ type: 'SET_PLAYER', player });
    } else {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }

  const createPlayer = useCallback(async (name: string) => {
    const player: Player = {
      name,
      level: 1,
      xp: 0,
      gold: 100,
      stats: defaultStats(),
      createdAt: new Date(),
    };
    const id = await db.players.add(player);
    player.id = id;
    dispatch({ type: 'SET_PLAYER', player });

    // 初始化预设成就
    await initAchievements();
  }, []);

  const checkAchievements = useCallback(async (player: Player) => {
    const achievements = await db.achievements.toArray();
    const unlockedKeys = new Set(achievements.filter(a => a.unlockedAt).map(a => a.key));

    const checks: Record<string, boolean> = {
      first_quest: (await getTotalQuestsCompleted()) >= 1,
      quest_10: (await getTotalQuestsCompleted()) >= 10,
      quest_50: (await getTotalQuestsCompleted()) >= 50,
      pomo_10: (await getTotalPomodoroCount()) >= 10,
      pomo_50: (await getTotalPomodoroCount()) >= 50,
      pomo_100: (await getTotalPomodoroCount()) >= 100,
      streak_7: (await getConsecutiveDays()) >= 7,
      streak_30: (await getConsecutiveDays()) >= 30,
      level_5: player.level >= 5,
      level_10: player.level >= 10,
      gold_500: player.gold >= 500,
      healthy_7: (await getMealsNotSkippedStreak()) >= 7,
      sleep_7: (await getEarlySleepStreak()) >= 7,
      early_7: (await getEarlyWakeStreak(9)) >= 7,
      early_30: (await getTotalEarlyWakeDays(9)) >= 30,
      study_50: (await getTotalStudyHours()) >= 50,
      mood_good_7: (await getTotalGoodMoodDays()) >= 14,
      all_stats_5: Object.values(player.stats).every(v => v >= 5),
      quest_all_30: (await getAllDailyCompleteStreak()) >= 30,
      first_shop: (await db.purchases.count()) >= 1,
      foodie: (await getPurchaseCount('food')) >= 10,
      drinker: (await getPurchaseCount('drink')) >= 10,
      player_10: (await getPurchaseCount('entertainment')) >= 10,
      big_spender: (await getTodaysPurchaseTotal()) >= 100,
      shopaholic: (await getTotalPurchaseAmount()) >= 300,
      pomo_day_8: (await getTodaysPomoCount()) >= 8,
    };

    const newUnlocks = Object.entries(checks)
      .filter(([key, passed]) => passed && !unlockedKeys.has(key))
      .map(([key]) => key);

    if (newUnlocks.length > 0) {
      const today = new Date();
      for (const key of newUnlocks) {
        await db.achievements.where('key').equals(key).modify({ unlockedAt: today });
      }
      const unlockedAchievements = achievements.filter(a => newUnlocks.includes(a.key));
      dispatch({ type: 'SET_NEW_ACHIEVEMENTS', achievements: unlockedAchievements });
    }
  }, []);

  const addXP = useCallback(async (amount: number) => {
    if (!state.player) return;
    const bonus = getStatBonus(state.player.stats);
    const multiplier = amount > 0 ? (1 + (bonus.xpMultiplier || 0)) : 1;
    const oldLevel = state.player.level;
    let xp = state.player.xp + Math.round(amount * multiplier);
    let level = state.player.level;

    // 升级
    while (xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level++;
    }
    // 降级（扣经验时可能跌回上一级）
    while (xp < 0 && level > 1) {
      level--;
      xp += xpForLevel(level);
    }
    if (xp < 0) xp = 0;

    let updated = { ...state.player, xp, level };
    await db.players.update(state.player.id!, { xp, level });

    if (level > oldLevel) {
      dispatch({ type: 'SET_LEVEL_UP', levelUp: true });
      const bonusGold = level * 10;
      const withBonus = { ...updated, gold: updated.gold + bonusGold };
      await db.players.update(state.player.id!, { gold: withBonus.gold });
      updated = withBonus;
    }
    dispatch({ type: 'SET_PLAYER', player: updated });
    checkAchievements(updated);
  }, [state.player, checkAchievements]);

  const addGold = useCallback(async (amount: number) => {
    if (!state.player) return;
    const bonus = getStatBonus(state.player.stats);
    const multiplier = 1 + (bonus.goldMultiplier || 0);
    const flat = bonus.goldFlat || 0;
    const total = Math.round(amount * multiplier) + flat;
    const newGold = state.player.gold + total;
    await db.players.update(state.player.id!, { gold: newGold });
    const updated = { ...state.player, gold: newGold };
    dispatch({ type: 'SET_PLAYER', player: updated });
    checkAchievements(updated);
  }, [state.player, checkAchievements]);

  const updateStats = useCallback(async (stats: Partial<PlayerStats>) => {
    if (!state.player) return;
    const bonus = getStatBonus(state.player.stats);
    const maxStat: Record<string, number> = {
      stamina: 10 + (bonus.staminaCapBonus || 0),
    };
    const newStats = { ...state.player.stats };
    for (const key in stats) {
      const k = key as keyof PlayerStats;
      const max = maxStat[k] || 10;
      newStats[k] = Math.min(max, Math.max(1, Math.round((newStats[k] + (stats[k] || 0)) * 10) / 10));
    }
    await db.players.update(state.player.id!, { stats: newStats as any });
    const updated = { ...state.player, stats: newStats };
    dispatch({ type: 'SET_PLAYER', player: updated });
    checkAchievements(updated);
  }, [state.player, checkAchievements]);

  const refreshPlayer = useCallback(async () => {
    const player = await getPlayer();
    if (player) {
      dispatch({ type: 'SET_PLAYER', player });
    }
  }, []);

  const resetLevelUp = useCallback(() => {
    dispatch({ type: 'SET_LEVEL_UP', levelUp: false });
  }, []);

  const clearAchievements = useCallback(() => {
    dispatch({ type: 'CLEAR_ACHIEVEMENTS' });
  }, []);

  return (
    <GameContext.Provider value={{
      state,
      createPlayer,
      addXP,
      addGold,
      updateStats,
      refreshPlayer,
      resetLevelUp,
      clearAchievements,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

// 初始化预设成就
async function initAchievements() {
  const existing = await db.achievements.count();
  if (existing > 0) return;

  const defaults = [
    { key: 'first_quest', title: '初出茅庐', description: '完成第一个任务', icon: '📜', category: '任务', tier: '银星' },
    { key: 'quest_10', title: '任务粉碎机', description: '累计完成10个任务', icon: '⚔️', category: '任务', tier: '银星' },
    { key: 'quest_50', title: '任务收割者', description: '累计完成50个任务', icon: '🏆', category: '任务', tier: '铱星' },
    { key: 'quest_all_30', title: '全勤月', description: '连续30天完成所有每日任务', icon: '📋', category: '任务', tier: '铱星' },
    { key: 'pomo_10', title: '番茄学徒', description: '累计10个番茄钟', icon: '🍅', category: '番茄', tier: '银星' },
    { key: 'pomo_50', title: '番茄农场主', description: '累计50个番茄钟', icon: '🍅', category: '番茄', tier: '金星' },
    { key: 'pomo_100', title: '番茄大师', description: '累计100个番茄钟', icon: '🌟', category: '番茄', tier: '铱星' },
    { key: 'pomo_day_8', title: '拼命三郎', description: '单日完成8个番茄钟', icon: '🔥', category: '番茄', tier: '铱星' },
    { key: 'study_50', title: '学神降临', description: '累计学习50小时', icon: '📚', category: '番茄', tier: '铱星' },
    { key: 'streak_7', title: '七日连勤', description: '连续7天记录日常', icon: '📅', category: '习惯', tier: '金星' },
    { key: 'streak_30', title: '月之守护', description: '连续30天记录日常', icon: '🌙', category: '习惯', tier: '铱星' },
    { key: 'early_7', title: '早起鸟', description: '连续7天9点前起床', icon: '🐔', category: '生活', tier: '金星' },
    { key: 'early_30', title: '早起成习', description: '累计30天9点前起床', icon: '🌅', category: '生活', tier: '铱星' },
    { key: 'healthy_7', title: '规律进食', description: '连续7天三餐不漏', icon: '🥗', category: '生活', tier: '金星' },
    { key: 'sleep_7', title: '早睡挑战', description: '连续7天凌晨1点前睡', icon: '💤', category: '生活', tier: '金星' },
    { key: 'mood_good_7', title: '阳光心情', description: '累计14天心情4星以上', icon: '☀️', category: '生活', tier: '金星' },
    { key: 'level_5', title: '小有成就', description: '达到5级', icon: '⭐', category: '成长', tier: '金星' },
    { key: 'level_10', title: '勇者之路', description: '达到10级', icon: '👑', category: '成长', tier: '铱星' },
    { key: 'gold_500', title: '小富翁', description: '累计获得500金币', icon: '💰', category: '成长', tier: '金星' },
    { key: 'all_stats_5', title: '全面发展', description: '所有属性达到5级', icon: '🎯', category: '成长', tier: '铱星' },
    { key: 'first_shop', title: '首次购物', description: '在商城兑换任意1个商品', icon: '🛍️', category: '消费', tier: '银星' },
    { key: 'foodie', title: '吃货认证', description: '累计消费「饮食」板块10次', icon: '🍽️', category: '消费', tier: '银星' },
    { key: 'drinker', title: '饮品品鉴师', description: '累计消费「饮品」板块10次', icon: '🥤', category: '消费', tier: '银星' },
    { key: 'player_10', title: '玩心不改', description: '累计消费「娱乐」板块10次', icon: '🎮', category: '消费', tier: '银星' },
    { key: 'big_spender', title: '挥金如土', description: '单日消费满100G', icon: '💸', category: '消费', tier: '金星' },
    { key: 'shopaholic', title: '消费达人', description: '累计消费满300G', icon: '🏦', category: '消费', tier: '铱星' },
  ];

  await db.achievements.bulkAdd(defaults);
}
