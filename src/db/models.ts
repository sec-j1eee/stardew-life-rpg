// 玩家数据
export interface PlayerStats {
  study: number;    // 学习力
  health: number;   // 健康度
  social: number;   // 社交力
  mood: number;     // 心情值
  willpower: number; // 自制力
  stamina: number;  // 体力
}

export interface Player {
  id?: number;
  name: string;
  level: number;
  xp: number;
  gold: number;
  stats: PlayerStats;
  createdAt: Date;
}

// 任务
export type QuestType = 'daily' | 'limited' | 'phase';
export type RepeatPattern = 'everyday' | 'weekday' | 'weekend' | 'custom';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Quest {
  id?: number;
  title: string;
  description: string;
  type: QuestType;
  subtasks: Subtask[];
  repeatPattern?: RepeatPattern;
  deadline?: string; // HH:mm
  xpReward: number;
  goldReward: number;
  itemReward?: string;
  completed: boolean;
  completedDate?: string; // YYYY-MM-DD
  date?: string; // YYYY-MM-DD for limited/daily quests
  createdAt: Date;
  archived: boolean;
}

// 番茄钟
export type SessionType = 'focus' | 'break';

export interface PomodoroSession {
  id?: number;
  duration: number; // 秒
  type: SessionType;
  completedAt: Date;
  date: string; // YYYY-MM-DD
  taskName?: string;
}

// 日常记录
export interface MealRecord {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  content: string;
  healthRating: 'healthy' | 'normal' | 'indulgent';
}

export interface SleepRecord {
  startTime: string;
  endTime: string;
  quality: 1 | 2 | 3 | 4 | 5;
}

export type EmotionLabel = 'happy' | 'calm' | 'anxious' | 'sad' | 'tired' | 'motivated' | 'frustrated';

export interface DailyLog {
  id?: number;
  date: string; // YYYY-MM-DD
  meals: MealRecord[];
  sleep: SleepRecord;
  mood: number; // 1-5
  emotions: EmotionLabel[];
  activities: string[];
  socialActivities: string[];
  rewardsClaimed: string[];
  notes: string;
}

// 成就
export interface Achievement {
  id?: number;
  key: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  tier: string;
  unlockedAt?: Date;
}

// 预设成就定义
export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: string;
  check: (state: AchievementCheckState) => boolean;
}

export interface AchievementCheckState {
  totalPomodoros: number;
  totalQuestsCompleted: number;
  streakDays: number;
  healthyMealStreak: number;
  earlyWakeStreak: number;
  goodSleepStreak: number;
  goodMoodStreak: number;
  totalStudyHours: number;
  totalGold: number;
  level: number;
  allDailyCompleteStreak: number;
  singleDayPomoCount: number;
  allStatsAtLeast5: boolean;
}

// 背包物品
export interface InventoryItem {
  id?: number;
  name: string;
  description: string;
  quantity: number;
  icon: string;
  type: 'food' | 'drink' | 'entertainment' | 'rest' | 'other';
}

// 每日总结
export interface DailySummary {
  id?: number;
  date: string;
  questsCompleted: number;
  pomodoroCount: number;
  focusMinutes: number;
  xpEarned: number;
  goldEarned: number;
  statsChanges: Partial<PlayerStats>;
  statsMorning?: Partial<PlayerStats>;
  mealsHealthy: number;
  mealsTotal: number;
  sleepHours: number;
  sleepQuality: number;
  mood: number;
  highlights: string[];
}

// 经验计算常量
export const XP_TABLE = {
  POMODORO_FOCUS: 15,
  HEALTHY_MEAL: 20,
  GOOD_SLEEP: 15,
  GOOD_MOOD: 10,
  JOURNAL_FULL: 20,
  STREAK_3DAY: 50,
  STREAK_7DAY: 100,
  WEEKLY_FULL: 150,
} as const;

export const GOLD_TABLE = {
  POMODORO_FOCUS: 2,
  JOURNAL_FULL: 3,
  STREAK_3DAY: 10,
  STREAK_7DAY: 20,
  WEEKLY_FULL: 30,
} as const;

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

export interface Purchase {
  id?: number;
  name: string;
  category: string;
  price: number;
  date: string;
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function defaultStats(): PlayerStats {
  return { study: 1, health: 1, social: 1, mood: 1, willpower: 2, stamina: 3 };
}

// 每日属性衰减
export const DAILY_DECAY: Partial<PlayerStats> = {
  stamina: -0.3,
  mood: -0.1,
  willpower: -0.05,
};

// 属性增益效果
export const STAT_BONUSES: Record<number, Partial<Record<keyof PlayerStats, string>>> = {
  3: {},
  5: {},
  8: {},
};
