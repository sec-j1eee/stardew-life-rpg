import { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { db, getTodaysPomodoroCount } from '../db/database';
import { todayStr, DAILY_DECAY, XP_TABLE, GOLD_TABLE } from '../db/models';
import { getDecayAmount, getStatBonus } from '../systems/statBonuses';
import type { DailySummary, DailyLog, PlayerStats } from '../db/models';

export default function Summary() {
  const { state, updateStats, addXP, addGold } = useGame();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [generating, setGenerating] = useState(false);
  const [today, setToday] = useState(() => todayStr());

  useEffect(() => {
    const timer = setInterval(() => {
      const d = todayStr();
      setToday(prev => prev !== d ? d : prev);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadSummary();
    loadHistory();
    generateSummary();
  }, [today]);

  async function loadSummary() {
    const s = await db.dailySummaries.where('date').equals(today).first();
    setSummary(s || null);
  }

  async function loadHistory() {
    const l = await db.dailyLogs.orderBy('date').reverse().limit(7).toArray();
    setLogs(l);
  }

  if (!state.player) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">🌙</div>
          <div className="pixel-title">请先创建角色</div>
        </div>
      </div>
    );
  }

  async function generateSummary() {
    setGenerating(true);

    const todayLog = await db.dailyLogs.where('date').equals(today).first();
    const todayQuests = await db.quests
      .filter(q => q.completed && q.completedDate === today)
      .toArray();
    const todayPomos = await getTodaysPomodoroCount();
    const todaySessions = await db.pomodoroSessions
      .where('date').equals(today)
      .toArray();
    const focusMinutes = Math.floor(
      todaySessions
        .filter(s => s.type === 'focus')
        .reduce((sum, s) => sum + s.duration, 0) / 60
    );

    const xpEarned = todayQuests.reduce((sum, q) => sum + q.xpReward, 0) +
      todaySessions.filter(s => s.type === 'focus').length * 30;
    const goldEarned = todayQuests.reduce((sum, q) => sum + q.goldReward, 0) +
      todaySessions.filter(s => s.type === 'focus').length * 5;

    const mealCounts = todayLog
      ? { total: todayLog.meals.length, healthy: todayLog.meals.filter(m => m.healthRating === 'healthy').length }
      : { total: 0, healthy: 0 };

    const sleepHours = todayLog ? calcSleepHours(todayLog.sleep.startTime, todayLog.sleep.endTime) : 0;

    const highlights: string[] = [];
    if (todayQuests.length > 0) highlights.push(`完成了${todayQuests.length}个任务`);
    if (focusMinutes >= 60) highlights.push(`专注学习了${focusMinutes}分钟`);
    if (mealCounts.healthy >= 3) highlights.push(`三餐营养满满`);
    if (todayLog?.mood && todayLog.mood >= 4) highlights.push(`心情愉快的一天`);
    if (todayLog?.activities.length && todayLog.activities.length > 0) {
      highlights.push(`进行了${todayLog.activities.length}项活动`);
    }

    const data: DailySummary = {
      date: today,
      questsCompleted: todayQuests.length,
      pomodoroCount: todayPomos,
      focusMinutes,
      xpEarned,
      goldEarned,
      statsChanges: {
        study: Math.min(1, todaySessions.filter(s => s.type === 'focus').length * 0.1),
        health: mealCounts.healthy * 0.1,
        willpower: todayQuests.length * 0.05,
        mood: todayLog?.mood && todayLog.mood >= 4 ? 0.1 : 0,
      },
      mealsHealthy: mealCounts.healthy,
      mealsTotal: mealCounts.total,
      sleepHours,
      sleepQuality: todayLog?.sleep.quality || 0,
      mood: todayLog?.mood || 0,
      highlights,
    };

    const isFirstToday = !(await db.dailySummaries.where('date').equals(today).first());

    const existingId = summary?.id;
    if (existingId) {
      data.id = existingId;
      await db.dailySummaries.put(data);
    } else {
      const id = await db.dailySummaries.add(data);
      data.id = id;
    }

    setSummary(data);
    setGenerating(false);

    // 每日衰减、惩罚、连续奖励（仅当天首次结算时触发）
    if (state.player && isFirstToday) {
      // 当天第一次结算时，保存早上快照（当前属性），然后处理衰减
      const morningSnapshot = { ...state.player.stats };
      data.statsMorning = morningSnapshot;

      // 全天任务完成→自制力+0.1
      const allDailyQuests = await db.quests
        .filter(q => q.type === 'daily' && !q.archived)
        .toArray();
      const allDone = allDailyQuests.length > 0 && allDailyQuests.every(q => q.completed && q.completedDate === today);
      if (allDone) {
        await updateStats({ willpower: 0.1 });
      }

      const effectiveDecay = getDecayAmount(state.player.stats, DAILY_DECAY);
      await updateStats(effectiveDecay);

      if (todayLog) {
        const sleepHour = parseInt(todayLog.sleep.startTime.split(':')[0]);
        if (sleepHour >= 2 && sleepHour <= 5) {
          const penaltyReduction = getStatBonus(state.player.stats).penaltyReduction || 0;
          const factor = 1 - penaltyReduction;
          await updateStats({
            stamina: Math.round(-0.5 * factor * 10) / 10,
            health: Math.round(-0.1 * factor * 10) / 10,
          });
        }
        if (todayLog.meals.length < 3) {
          await updateStats({ stamina: -0.2 });
        }
      }

      // 连续打卡奖励
      const allSummaries = await db.dailySummaries.orderBy('date').reverse().toArray();
      let streak = 0;
      const todayDate = new Date(today);
      for (const s of allSummaries) {
        const checkDate = new Date(todayDate);
        checkDate.setDate(checkDate.getDate() - streak);
        const checkStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth()+1).padStart(2,'0')}-${String(checkDate.getDate()).padStart(2,'0')}`;
        if (s.date === checkStr && s.questsCompleted > 0) {
          streak++;
        } else {
          break;
        }
      }

      if (streak === 3) {
        await addXP(XP_TABLE.STREAK_3DAY);
        await addGold(GOLD_TABLE.STREAK_3DAY);
      }
      if (streak === 7) {
        await addXP(XP_TABLE.STREAK_7DAY);
        await addGold(GOLD_TABLE.STREAK_7DAY);
      }

      // 全勤检查（本周7天全有总结且都有任务）
      const weekStart = new Date(todayDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      let fullWeek = true;
      for (let d = 0; d < 7; d++) {
        const checkDate = new Date(weekStart);
        checkDate.setDate(checkDate.getDate() + d);
        const checkStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth()+1).padStart(2,'0')}-${String(checkDate.getDate()).padStart(2,'0')}`;
        const daySummary = allSummaries.find(s => s.date === checkStr);
        if (!daySummary || daySummary.questsCompleted === 0) {
          fullWeek = false;
          break;
        }
      }
      if (fullWeek && todayDate.getDay() === 6) {
        await addXP(XP_TABLE.WEEKLY_FULL);
        await addGold(GOLD_TABLE.WEEKLY_FULL);
      }

      // 保存早上快照到DB
      if (data.id && data.statsMorning) {
        await db.dailySummaries.update(data.id, { statsMorning: data.statsMorning });
      }
    }

    // 每次刷新都计算当日属性总变化（早上快照 vs 当前属性）
    const morningSnapshot = data.statsMorning || summary?.statsMorning;
    if (morningSnapshot && state.player) {
      const updatedPlayer = await db.players.orderBy('id').first();
      if (updatedPlayer) {
        const changes: Partial<PlayerStats> = {};
        const keys = Object.keys(morningSnapshot) as (keyof PlayerStats)[];
        for (const key of keys) {
          const newVal = updatedPlayer.stats[key] as number;
          const oldVal = (morningSnapshot as Record<string, number>)[key] || 0;
          const delta = Math.round((newVal - oldVal) * 10) / 10;
          if (delta !== 0) (changes as Record<string, number>)[key] = delta;
        }
        data.statsChanges = changes;
        if (data.id) {
          await db.dailySummaries.update(data.id, { statsChanges: changes });
        }
        setSummary(prev => prev ? { ...prev, statsChanges: changes } : prev);
      }
    }
  }

  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <div className="page-header">
        <div>
          <div className="pixel-title" style={{ marginBottom: 4, fontSize: 22 }}>每日结算</div>
          <div className="pixel-subtitle" style={{ fontSize: 14 }}>{today}</div>
        </div>
        <button className="pixel-btn primary" onClick={generateSummary} disabled={generating}
          style={{ fontSize: 14, padding: '10px 20px' }}>
          {generating ? '结算中...' : <><img src="/assets/sdv/icons/refresh.png" alt="" style={{ width: 18, height: 18, imageRendering: 'pixelated', verticalAlign: 'middle' }} /> 刷新</>}
        </button>
      </div>

      {summary ? (
        <div className="animate-fade-in">
          {/* 结算面板 */}
          <div className="pixel-panel" style={{
            marginBottom: 20,
            padding: '32px 36px',
          }}>
            {/* 日期和玩家 */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 20,
                color: 'var(--color-brown-dark)',
                letterSpacing: 3,
                marginBottom: 6,
              }}>
                {today} 的结算
              </div>
              <div style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 13,
                color: 'var(--color-text-light)',
              }}>
                {state.player.name} · Lv.{state.player.level}
              </div>
            </div>

            {/* 金币收入 */}
            <div style={{
              textAlign: 'center',
              paddingBottom: 20,
              marginBottom: 20,
              borderBottom: '2px dashed var(--color-cream-dark)',
            }}>
              <div style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 12,
                color: 'var(--color-text-light)',
                marginBottom: 6,
              }}>
                今日收入
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                <img src="/assets/sdv/icons/coin.png" alt=""
                  style={{ width: 32, height: 32, imageRendering: 'pixelated' }} />
                <span style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: 38,
                  color: 'var(--color-brown-dark)',
                }}>
                  {summary.goldEarned}
                </span>
                <span style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: 18,
                  color: '#8b6914',
                }}>G</span>
              </div>
            </div>

            {/* 详细数据 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 32px', marginBottom: 20 }}>
              <ShipItem label="完成任务" value={`${summary.questsCompleted} 个`} />
              <ShipItem label="番茄钟" value={`${summary.pomodoroCount} 个`} />
              <ShipItem label="专注时长" value={`${summary.focusMinutes} 分钟`} />
              <ShipItem label="睡眠" value={`${summary.sleepHours}h  ${'⭐'.repeat(summary.sleepQuality)}`} />
              <ShipItem label="饮食" value={`${summary.mealsHealthy}/${summary.mealsTotal} 营养`} />
              <ShipItem label="心情" value={`${'⭐'.repeat(summary.mood)}`} />
              <ShipItem label="经验" value={`+${summary.xpEarned} XP`} />
              <ShipItem label="金币" value={`+${summary.goldEarned} G`} />
            </div>

            {/* 属性变化 */}
            {summary.statsChanges && Object.keys(summary.statsChanges).length > 0 && (
              <div>
                <div style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: 13,
                  color: 'var(--color-brown-dark)',
                  marginBottom: 8,
                  paddingTop: 12,
                  borderTop: '2px dashed var(--color-cream-dark)',
                }}>
                  属性变化
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
                  {Object.entries(summary.statsChanges).map(([key, val]) => {
                    const label: Record<string, string> = { study:'学习力', health:'健康度', social:'社交力', mood:'心情值', willpower:'自制力', stamina:'体力' };
                    const v = val as number;
                    return (
                      <div key={key} style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontFamily: 'var(--font-pixel)', fontSize: 12,
                        padding: '3px 0',
                      }}>
                        <span style={{ color: 'var(--color-text-light)' }}>{label[key] || key}</span>
                        <span style={{ color: v > 0 ? '#4caf50' : v < 0 ? '#c0392b' : 'var(--color-text)' }}>
                          {v > 0 ? '+' : ''}{v}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 今日高光 */}
          {summary.highlights.length > 0 && (
            <div className="pixel-panel" style={{ marginBottom: 20 }}>
              <div className="pixel-title" style={{ fontSize: 18 }}>今日高光</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {summary.highlights.map((h, i) => (
                  <div key={i} style={{
                    fontSize: 14, padding: '8px 8px',
                    borderBottom: i < summary.highlights.length - 1 ? '1px dashed var(--color-cream-dark)' : 'none',
                  }}>
                    ✨ {h}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 最近7天 */}
          <div className="pixel-panel">
            <div className="pixel-title" style={{ fontSize: 18 }}>最近7天</div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
              {logs.length === 0 && (
                <span style={{ fontSize: 13, color: 'var(--color-text-light)' }}>还没有历史记录</span>
              )}
              {logs.map(log => (
                <div key={log.id} className="pixel-border-thin" style={{
                  minWidth: 110, padding: 10, textAlign: 'center', fontSize: 12,
                }}>
                  <div style={{
                    fontFamily: 'var(--font-pixel)', fontSize: 11, marginBottom: 6,
                    color: 'var(--color-brown)',
                  }}>
                    {log.date.slice(5)}
                  </div>
                  <div style={{ fontSize: 14 }}>{'⭐'.repeat(log.mood)}</div>
                  <div style={{ color: 'var(--color-text-light)', fontSize: 11 }}>
                    💤 {log.sleep.quality}/5
                  </div>
                  <div style={{ color: 'var(--color-text-light)', fontSize: 11 }}>
                    🍽️ {log.meals.length}餐
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state pixel-panel">
          <div className="empty-state-icon">🌙</div>
          <div className="pixel-title">今天还没有数据</div>
          <div className="pixel-subtitle" style={{ marginBottom: 16 }}>去完成任务、记录日常后再来看看吧</div>
          <button className="pixel-btn primary" onClick={generateSummary} disabled={generating}>
            {generating ? '结算中...' : <><img src="/assets/sdv/icons/refresh.png" alt="" style={{ width: 16, height: 16, imageRendering: 'pixelated', verticalAlign: 'middle' }} /> 刷新试试</>}
          </button>
        </div>
      )}
    </div>
  );
}

function ShipItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 10px',
      borderBottom: '1px dotted var(--color-cream-dark)',
    }}>
      <span style={{
        fontFamily: 'var(--font-pixel)',
        fontSize: 13,
        color: 'var(--color-text-light)',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-pixel)',
        fontSize: 13,
        color: 'var(--color-brown-dark)',
      }}>
        {value}
      </span>
    </div>
  );
}

function calcSleepHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let h = eh - sh;
  let m = em - sm;
  if (h < 0) h += 24;
  if (m < 0) { m += 60; h--; }
  if (h < 0) h += 24;
  return Math.round((h + m / 60) * 10) / 10;
}
