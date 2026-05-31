import Dexie, { type Table } from 'dexie';
import { todayStr } from './models';
import type { Player, Quest, PomodoroSession, DailyLog, Achievement, InventoryItem, DailySummary, Purchase } from './models';

export class GameDatabase extends Dexie {
  players!: Table<Player, number>;
  quests!: Table<Quest, number>;
  pomodoroSessions!: Table<PomodoroSession, number>;
  dailyLogs!: Table<DailyLog, number>;
  achievements!: Table<Achievement, number>;
  inventory!: Table<InventoryItem, number>;
  dailySummaries!: Table<DailySummary, number>;
  purchases!: Table<Purchase, number>;

  constructor() {
    super('StardewLifeRPG');

    this.version(1).stores({
      players: '++id, name',
      quests: '++id, type, completed, completedDate, archived',
      pomodoroSessions: '++id, date, type',
      dailyLogs: '++id, date',
      achievements: '++id, key',
      inventory: '++id, name, type',
      dailySummaries: '++id, date',
      purchases: '++id, date, category',
    });
  }
}

export const db = new GameDatabase();

// 辅助函数
export async function getPlayer(): Promise<Player | undefined> {
  return db.players.orderBy('id').first();
}

export async function getTodaysQuests(): Promise<Quest[]> {
  const today = todayStr();
  return db.quests
    .filter(q => !q.archived && (!q.completed || q.completedDate === today))
    .toArray();
}

export async function getDailyQuests(): Promise<Quest[]> {
  return db.quests
    .filter(q => q.type === 'daily' && !q.archived)
    .toArray();
}

export async function getPhaseQuests(): Promise<Quest[]> {
  return db.quests
    .filter(q => q.type === 'phase' && !q.archived)
    .toArray();
}

export async function getTodaysSummary(): Promise<DailySummary | undefined> {
  const today = todayStr();
  return db.dailySummaries.where('date').equals(today).first();
}

export async function getTodaysPomodoroCount(): Promise<number> {
  const today = todayStr();
  return db.pomodoroSessions.where('date').equals(today).count();
}

export async function getTotalPomodoroCount(): Promise<number> {
  return db.pomodoroSessions.count();
}

export async function getTotalQuestsCompleted(): Promise<number> {
  return db.quests.filter(q => q.completed).count();
}

export async function getConsecutiveDays(): Promise<number> {
  const logs = await db.dailyLogs.orderBy('date').reverse().toArray();
  let streak = 0;
  const today = new Date();

  for (const log of logs) {
    const logDate = new Date(log.date);
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - streak);

    const logStr = `${logDate.getFullYear()}-${String(logDate.getMonth()+1).padStart(2,'0')}-${String(logDate.getDate()).padStart(2,'0')}`;
    const expStr = `${expectedDate.getFullYear()}-${String(expectedDate.getMonth()+1).padStart(2,'0')}-${String(expectedDate.getDate()).padStart(2,'0')}`;
    if (logStr === expStr) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// 连续健康饮食天数
export async function getHealthyMealStreak(): Promise<number> {
  const logs = await db.dailyLogs.orderBy('date').reverse().toArray();
  let streak = 0;
  for (const log of logs) {
    const healthyCount = log.meals.filter(m => m.healthRating === 'healthy').length;
    if (log.meals.length >= 3 && healthyCount === log.meals.length) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// 连续三餐不漏天数（每天3餐以上）
export async function getMealsNotSkippedStreak(): Promise<number> {
  const logs = await db.dailyLogs.orderBy('date').reverse().toArray();
  let streak = 0;
  for (const log of logs) {
    if (log.meals.length >= 3) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// 连续早起天数（可指定几点前）
export async function getEarlyWakeStreak(threshold: number = 7): Promise<number> {
  const logs = await db.dailyLogs.orderBy('date').reverse().toArray();
  let streak = 0;
  for (const log of logs) {
    const wakeHour = parseInt(log.sleep.endTime.split(':')[0]);
    if (wakeHour <= threshold) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// 累计早起天数（不要求连续）
export async function getTotalEarlyWakeDays(threshold: number = 7): Promise<number> {
  const logs = await db.dailyLogs.toArray();
  let count = 0;
  for (const log of logs) {
    const wakeHour = parseInt(log.sleep.endTime.split(':')[0]);
    if (wakeHour <= threshold) count++;
  }
  return count;
}

// 连续早睡天数（凌晨1点前）
export async function getEarlySleepStreak(): Promise<number> {
  const logs = await db.dailyLogs.orderBy('date').reverse().toArray();
  let streak = 0;
  for (const log of logs) {
    const sleepHour = parseInt(log.sleep.startTime.split(':')[0]);
    if (sleepHour <= 1 || sleepHour >= 20) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// 累计心情好天数（心情≥4星，不要求连续）
export async function getTotalGoodMoodDays(): Promise<number> {
  const logs = await db.dailyLogs.toArray();
  let count = 0;
  for (const log of logs) {
    if (log.mood >= 4) count++;
  }
  return count;
}

// 连续好睡眠天数（质量>=4 且 时长>=8h）
export async function getGoodSleepStreak(): Promise<number> {
  const logs = await db.dailyLogs.orderBy('date').reverse().toArray();
  let streak = 0;
  for (const log of logs) {
    const [sh, sm] = log.sleep.startTime.split(':').map(Number);
    const [eh, em] = log.sleep.endTime.split(':').map(Number);
    let hours = eh - sh + (em - sm) / 60;
    if (hours < 0) hours += 24;
    if (log.sleep.quality >= 4 && hours >= 8) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// 累计学习总小时数
export async function getTotalStudyHours(): Promise<number> {
  const sessions = await db.pomodoroSessions.filter(s => s.type === 'focus').toArray();
  return Math.floor(sessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
}

// 连续心情好天数（>=4）
export async function getGoodMoodStreak(): Promise<number> {
  const logs = await db.dailyLogs.orderBy('date').reverse().toArray();
  let streak = 0;
  for (const log of logs) {
    if (log.mood >= 4) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// 连续每日任务全部完成天数
export async function getAllDailyCompleteStreak(): Promise<number> {
  const logs = await db.dailyLogs.orderBy('date').reverse().toArray();
  const allQuests = await db.quests.filter(q => !q.archived && q.type === 'daily').toArray();
  let streak = 0;
  for (const log of logs) {
    const completedOnDay = await db.quests
      .filter(q => q.type === 'daily' && q.completedDate === log.date)
      .count();
    if (completedOnDay >= allQuests.length && allQuests.length > 0) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// 今日番茄钟数量
export async function getTodaysPomoCount(): Promise<number> {
  const today = todayStr();
  return db.pomodoroSessions.where('date').equals(today).count();
}

export async function getPurchaseCount(category: string): Promise<number> {
  return db.purchases.where('category').equals(category).count();
}

export async function getTodaysPurchaseTotal(): Promise<number> {
  const today = todayStr();
  const purchases = await db.purchases.where('date').equals(today).toArray();
  return purchases.reduce((sum, p) => sum + p.price, 0);
}

export async function getTotalPurchaseAmount(): Promise<number> {
  const purchases = await db.purchases.toArray();
  return purchases.reduce((sum, p) => sum + p.price, 0);
}
