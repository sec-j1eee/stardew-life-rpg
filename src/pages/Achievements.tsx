import { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import {
  db, getTotalPomodoroCount, getTotalQuestsCompleted, getConsecutiveDays,
  getMealsNotSkippedStreak, getEarlyWakeStreak, getTotalEarlyWakeDays,
  getEarlySleepStreak, getTotalStudyHours, getTotalGoodMoodDays,
  getTodaysPomoCount,
} from '../db/database';
import type { Achievement, AchievementCheckState } from '../db/models';

// 条件检测
async function checkAchievements(state: AchievementCheckState): Promise<string[]> {
  const unlocked: string[] = [];

  const checks: Record<string, boolean> = {
    first_quest: state.totalQuestsCompleted >= 1,
    quest_10: state.totalQuestsCompleted >= 10,
    quest_50: state.totalQuestsCompleted >= 50,
    pomo_10: state.totalPomodoros >= 10,
    pomo_50: state.totalPomodoros >= 50,
    pomo_100: state.totalPomodoros >= 100,
    streak_7: state.streakDays >= 7,
    streak_30: state.streakDays >= 30,
    level_5: state.level >= 5,
    level_10: state.level >= 10,
    gold_500: state.totalGold >= 500,
    healthy_7: state.healthyMealStreak >= 7,
    sleep_7: state.goodSleepStreak >= 7,
    early_7: state.earlyWakeStreak >= 7,
    early_30: state.allDailyCompleteStreak >= 30,
    study_50: state.totalStudyHours >= 50,
    mood_good_7: state.goodMoodStreak >= 14,
    all_stats_5: state.allStatsAtLeast5,
    quest_all_30: state.allDailyCompleteStreak >= 30,
    pomo_day_8: state.singleDayPomoCount >= 8,
  };

  for (const [key, passed] of Object.entries(checks)) {
    if (passed) {
      const ach = await db.achievements.where('key').equals(key).first();
      if (ach && !ach.unlockedAt) unlocked.push(key);
    }
  }

  return unlocked;
}

export default function Achievements() {
  const { state } = useGame();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlocking, setUnlocking] = useState<string[]>([]);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    loadAndCheck();
  }, []);

  async function loadAndCheck() {
    const all = await db.achievements.toArray();
    setAchievements(all);

    if (state.player) {
      const checkState: AchievementCheckState = {
        totalPomodoros: await getTotalPomodoroCount(),
        totalQuestsCompleted: await getTotalQuestsCompleted(),
        streakDays: await getConsecutiveDays(),
        healthyMealStreak: await getMealsNotSkippedStreak(),
        earlyWakeStreak: await getEarlyWakeStreak(9),
        goodSleepStreak: await getEarlySleepStreak(),
        goodMoodStreak: await getTotalGoodMoodDays(),
        totalStudyHours: await getTotalStudyHours(),
        totalGold: state.player.gold,
        level: state.player.level,
        allDailyCompleteStreak: await getTotalEarlyWakeDays(9),
        singleDayPomoCount: await getTodaysPomoCount(),
        allStatsAtLeast5: Object.values(state.player.stats).every(v => v >= 5),
      };

      const newUnlocks = await checkAchievements(checkState);
      if (newUnlocks.length > 0) {
        const today = new Date();
        for (const key of newUnlocks) {
          await db.achievements.where('key').equals(key).modify({ unlockedAt: today });
        }
        setUnlocking(newUnlocks);
        setShowNotification(true);
        await loadAndCheck();
      }
    }
  }

  if (!state.player) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">🏆</div>
          <div className="pixel-title">请先创建角色</div>
        </div>
      </div>
    );
  }

  const unlockedCount = achievements.filter(a => a.unlockedAt).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="pixel-title" style={{ marginBottom: 4 }}>成就</div>
          <div className="pixel-subtitle">
            已解锁 {unlockedCount}/{achievements.length}
          </div>
        </div>
      </div>

      {[
        { key: '任务', img: '/assets/sdv/icons/cat_quest.png' },
        { key: '番茄', img: '/assets/sdv/icons/cat_pomo.png' },
        { key: '习惯', img: '/assets/sdv/icons/cat_habit.png' },
        { key: '生活', img: '/assets/sdv/icons/cat_life.png' },
        { key: '成长', img: '/assets/sdv/icons/cat_growth.png' },
        { key: '消费', img: '/assets/sdv/icons/cat_shop.png' },
      ].map(cat => {
        const catAchievements = achievements.filter(a => a.category === cat.key);
        if (catAchievements.length === 0) return null;
        const catUnlocked = catAchievements.filter(a => a.unlockedAt).length;
        return (
          <div key={cat.key} style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 14,
              color: 'var(--color-brown-dark)',
              marginBottom: 10,
              paddingBottom: 4,
              borderBottom: '2px solid var(--color-gold)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {cat.img && <img src={cat.img} alt="" style={{ width: 22, height: 22, imageRendering: 'pixelated' }} />}
              {cat.key}
              <span style={{ fontSize: 11, color: 'var(--color-text-light)' }}>
                {catUnlocked}/{catAchievements.length}
              </span>
            </div>
            <div className="card-grid">
              {catAchievements.map(ach => (
                <div
                  key={ach.id}
                  className={`pixel-panel ${!ach.unlockedAt ? 'pixel-border-thin' : ''}`}
                  style={{
                    textAlign: 'center',
                    opacity: ach.unlockedAt ? 1 : 0.5,
                    background: ach.unlockedAt ? undefined : '#e0d8c8',
                    transition: 'all 0.3s',
                  }}
                >
                  <div style={{ fontSize: 36, marginBottom: 8 }}>
                    {ach.unlockedAt
                      ? <img src={
                          ach.tier === '铱星' ? '/assets/sdv/icons/tier_iridium.png' :
                          ach.tier === '金星' ? '/assets/sdv/icons/tier_gold.png' :
                          '/assets/sdv/icons/tier_silver.png'
                        } alt="" style={{ width: 36, height: 36, imageRendering: 'pixelated' }} />
                      : <img src="/assets/sdv/icons/tier_silver.png" alt="" style={{ width: 36, height: 36, imageRendering: 'pixelated', opacity: 0.25 }} />
                    }
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-pixel)',
                    fontSize: 10,
                    marginBottom: 4,
                    color: ach.unlockedAt ? 'var(--color-gold)' : 'var(--color-text-light)',
                  }}>
                    {ach.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-light)' }}>
                    {ach.description}
                  </div>
                  {ach.unlockedAt && (
                    <div className="pixel-badge" style={{ marginTop: 6 }}>
                      {new Date(ach.unlockedAt).toLocaleDateString('zh-CN')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* 解锁通知 */}
      {showNotification && unlocking.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowNotification(false)}>
          <div className="modal-content pixel-panel animate-pop-in" style={{ textAlign: 'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
            <div className="pixel-title" style={{ color: 'var(--color-gold)' }}>成就解锁！</div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {unlocking.map(key => {
                const ach = achievements.find(a => a.key === key);
                return ach ? (
                  <div key={key} style={{
                    fontFamily: 'var(--font-pixel)',
                    fontSize: 11,
                    background: 'rgba(212,160,23,0.1)',
                    padding: '8px 12px',
                  }}>
                    {ach.icon} {ach.title}
                  </div>
                ) : null;
              })}
            </div>
            <button className="pixel-btn primary" style={{ marginTop: 16 }}
              onClick={() => setShowNotification(false)}>
              太棒了！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
