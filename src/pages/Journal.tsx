import { useState, useEffect, useCallback } from 'react';
import { useGame } from '../contexts/GameContext';
import { db } from '../db/database';
import type { DailyLog, MealRecord, EmotionLabel } from '../db/models';
import { XP_TABLE, GOLD_TABLE, todayStr } from '../db/models';

const EMOTIONS: { label: EmotionLabel; icon: string; text: string; sdvSprite?: string }[] = [
  { label: 'happy', icon: '😊', text: '开心', sdvSprite: '/assets/sdv/icons/mood_happy.png' },
  { label: 'calm', icon: '😌', text: '平静', sdvSprite: '/assets/sdv/icons/mood_calm.png' },
  { label: 'anxious', icon: '😰', text: '焦虑', sdvSprite: '/assets/sdv/icons/mood_anxious.png' },
  { label: 'sad', icon: '😢', text: '难过', sdvSprite: '/assets/sdv/icons/mood_sad.png' },
  { label: 'tired', icon: '😴', text: '疲惫', sdvSprite: '/assets/sdv/icons/mood_tired.png' },
  { label: 'motivated', icon: '💪', text: '有动力', sdvSprite: '/assets/sdv/icons/mood_motivated.png' },
  { label: 'frustrated', icon: '😤', text: '烦躁', sdvSprite: '/assets/sdv/icons/mood_frustrated.png' },
];

const MEAL_TYPES: { type: MealRecord['type']; img: string; text: string }[] = [
  { type: 'breakfast', img: '/assets/sdv/icons/breakfast.png', text: '早餐' },
  { type: 'lunch', img: '/assets/sdv/icons/lunch.png', text: '午餐' },
  { type: 'dinner', img: '/assets/sdv/icons/dinner.png', text: '晚餐' },
  { type: 'snack', img: '/assets/sdv/icons/snack.png', text: '零食' },
];

const SOCIAL_ACTIVITIES: { key: string; text: string; socialXP: number }[] = [
  { key: 'message', text: '给家人/朋友发信息', socialXP: 0.05 },
  { key: 'call', text: '给家人/朋友打电话/视频', socialXP: 0.15 },
  { key: 'go_out', text: '和朋友一起出门', socialXP: 0.15 },
  { key: 'class_interact', text: '课堂互动', socialXP: 0.1 },
  { key: 'teacher', text: '和老师/助教交流', socialXP: 0.1 },
];

export default function Journal() {
  const { state, addXP, addGold, updateStats } = useGame();
  const [log, setLog] = useState<DailyLog | null>(null);
  const [mood, setMood] = useState(3);
  const [emotions, setEmotions] = useState<EmotionLabel[]>([]);
  const [notes, setNotes] = useState('');
  const [sleepStart, setSleepStart] = useState('23:00');
  const [sleepEnd, setSleepEnd] = useState('07:00');
  const [sleepQuality, setSleepQuality] = useState(3);
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [mealType, setMealType] = useState<MealRecord['type']>('breakfast');
  const [mealContent, setMealContent] = useState('');
  const [mealRating, setMealRating] = useState<MealRecord['healthRating']>('normal');
  const [activities, setActivities] = useState<string[]>([]);
  const [activityText, setActivityText] = useState('');
  const [socialActivities, setSocialActivities] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [today, setToday] = useState(() => todayStr());

  useEffect(() => {
    const timer = setInterval(() => {
      const d = todayStr();
      setToday(prev => prev !== d ? d : prev);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const loadLog = useCallback(async () => {
    const existing = await db.dailyLogs.where('date').equals(today).first();
    if (existing) {
      setLog(existing);
      setMood(existing.mood);
      setEmotions(existing.emotions);
      setNotes(existing.notes);
      setSleepStart(existing.sleep.startTime);
      setSleepEnd(existing.sleep.endTime);
      setSleepQuality(existing.sleep.quality);
      setMeals(existing.meals);
      setActivities(existing.activities);
      setSocialActivities(existing.socialActivities || []);
      setLog(existing);
    } else {
      resetForm();
    }
  }, [today]);

  useEffect(() => { loadLog(); }, [loadLog]);

  function resetForm() {
    setLog(null);
    setMood(3);
    setEmotions([]);
    setNotes('');
    setSleepStart('23:00');
    setSleepEnd('07:00');
    setSleepQuality(3);
    setMeals([]);
    setActivities([]);
    setSocialActivities([]);
  }

  if (!state.player) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <div className="pixel-title">请先创建角色</div>
        </div>
      </div>
    );
  }

  function toggleEmotion(e: EmotionLabel) {
    setEmotions(prev =>
      prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]
    );
  }

  function addMeal() {
    if (!mealContent.trim()) return;
    setMeals(prev => [...prev, {
      type: mealType,
      content: mealContent.trim(),
      healthRating: mealRating,
    }]);
    setMealContent('');
  }

  function removeMeal(index: number) {
    setMeals(prev => prev.filter((_, i) => i !== index));
  }

  function addActivity() {
    if (!activityText.trim()) return;
    setActivities(prev => [...prev, activityText.trim()]);
    setActivityText('');
  }

  function removeActivity(index: number) {
    setActivities(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    const data = {
      date: today,
      meals,
      sleep: {
        startTime: sleepStart,
        endTime: sleepEnd,
        quality: sleepQuality as 1 | 2 | 3 | 4 | 5,
      },
      mood,
      emotions,
      activities,
      socialActivities,
      rewardsClaimed: [] as string[],
      notes,
    };

    if (log?.id) {
      await db.dailyLogs.update(log.id, data);
    } else {
      await db.dailyLogs.add(data as DailyLog);
    }

    // 奖励（每项每日仅给一次，可分次记录）
    const claimed: string[] = log?.rewardsClaimed || [];

    if (!claimed.includes('meal') && meals.length >= 3 && meals.every(m => m.healthRating === 'healthy')) {
      await addXP(XP_TABLE.HEALTHY_MEAL);
      await updateStats({ health: 0.2 });
      claimed.push('meal');
    }
    if (!claimed.includes('sleep') && sleepQuality >= 4) {
      await addXP(XP_TABLE.GOOD_SLEEP);
      await updateStats({ stamina: 0.3 });
      claimed.push('sleep');
    }
    if (!claimed.includes('mood') && mood >= 4) {
      await addXP(XP_TABLE.GOOD_MOOD);
      await updateStats({ mood: 0.1 });
      claimed.push('mood');
    }
    const journalComplete = meals.length > 0 && activities.length > 0 && notes.length > 0;
    if (!claimed.includes('journal') && journalComplete) {
      await addXP(XP_TABLE.JOURNAL_FULL);
      await addGold(GOLD_TABLE.JOURNAL_FULL);
      await updateStats({ willpower: 0.05 });
      claimed.push('journal');
    }

    // 社交活动奖励（每次保存重新计算，但每日同一活动只给一次）
    const newSocial = socialActivities.filter(k => !claimed.includes(`social_${k}`));
    let socialGain = 0;
    for (const key of newSocial) {
      const act = SOCIAL_ACTIVITIES.find(a => a.key === key);
      if (act) socialGain += act.socialXP;
      claimed.push(`social_${key}`);
    }
    if (socialGain > 0) {
      await updateStats({ social: Math.round(socialGain * 10) / 10 });
    }

    data.rewardsClaimed = claimed;

    await loadLog();
  }

  function sleepDuration(): string {
    const [sh, sm] = sleepStart.split(':').map(Number);
    const [eh, em] = sleepEnd.split(':').map(Number);
    let hours = eh - sh;
    let mins = em - sm;
    if (hours < 0) hours += 24;
    if (mins < 0) { mins += 60; hours--; }
    if (hours < 0) hours += 24;
    return `${hours}小时${mins}分钟`;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="pixel-title" style={{ marginBottom: 4 }}>日常记录</div>
          <div className="pixel-subtitle">{today} · 记录你的每一天</div>
        </div>
        <button className="pixel-btn small" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? '返回记录' : <><img src="/assets/sdv/icons/refresh.png" alt="" style={{ width: 16, height: 16, imageRendering: 'pixelated', verticalAlign: 'middle' }} /> 历史</>}
        </button>
      </div>

      {showHistory ? (
        <HistoryView />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 心情 */}
          <div className="pixel-panel">
            <div className="pixel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src="/assets/sdv/icons/mood_header.png" alt=""
                style={{ width: 32, height: 32, imageRendering: 'pixelated' }} />
              今日心情
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  className={`pixel-btn small ${mood === n ? 'primary' : ''}`}
                  onClick={() => setMood(n)}
                  style={{ fontSize: 20, padding: '4px 12px' }}
                >
                  {n <= mood ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {EMOTIONS.map(e => (
                <button
                  key={e.label}
                  className={`pixel-btn small ${emotions.includes(e.label) ? 'primary' : ''}`}
                  onClick={() => toggleEmotion(e.label)}
                  style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {e.sdvSprite ? (
                    <img src={e.sdvSprite} alt={e.text}
                      style={{ width: 24, height: 24, imageRendering: 'pixelated' }} />
                  ) : e.icon}
                  {e.text}
                </button>
              ))}
            </div>
          </div>

          {/* 睡眠 */}
          <div className="pixel-panel">
            <div className="pixel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src="/assets/sdv/icons/sleep_header.png" alt=""
                style={{ width: 32, height: 32, imageRendering: 'pixelated' }} />
              睡眠记录
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 8 }}>
              <div className="form-group">
                <label className="pixel-label">入睡时间</label>
                <input className="pixel-input" type="time" value={sleepStart}
                  onChange={e => setSleepStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="pixel-label">起床时间</label>
                <input className="pixel-input" type="time" value={sleepEnd}
                  onChange={e => setSleepEnd(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="pixel-label">睡眠质量</label>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      className={`pixel-btn small ${sleepQuality === n ? 'primary' : ''}`}
                      onClick={() => setSleepQuality(n)}
                      style={{ padding: '2px 6px', fontSize: 10 }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-light)' }}>
              预计睡眠时长：{sleepDuration()}
            </div>
          </div>

          {/* 饮食 */}
          <div className="pixel-panel">
            <div className="pixel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src="/assets/sdv/icons/diet_header.png" alt=""
                style={{ width: 32, height: 32, imageRendering: 'pixelated' }} />
              饮食记录
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <select className="pixel-input" style={{ width: 'auto' }}
                value={mealType} onChange={e => setMealType(e.target.value as MealRecord['type'])}>
                {MEAL_TYPES.map(mt => (
                  <option key={mt.type} value={mt.type}>{mt.text}</option>
                ))}
              </select>
              <input className="pixel-input" style={{ flex: 1, minWidth: 150 }}
                value={mealContent} onChange={e => setMealContent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMeal()}
                placeholder="吃了什么？" />
              <div style={{ display: 'flex', gap: 4 }}>
                {([
                  { val: 'healthy' as const, label: '健康', img: '/assets/sdv/icons/tier_gold.png' },
                  { val: 'normal' as const, label: '普通', img: '/assets/sdv/icons/tier_silver.png' },
                  { val: 'indulgent' as const, label: '享受', img: '/assets/sdv/icons/tier_iridium.png' },
                ]).map(r => (
                  <button
                    key={r.val}
                    className={`pixel-btn small ${mealRating === r.val ? 'primary' : ''}`}
                    onClick={() => setMealRating(r.val)}
                    style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '4px 8px' }}
                  >
                    <img src={r.img} alt="" style={{ width: 18, height: 18, imageRendering: 'pixelated' }} />
                    {r.label}
                  </button>
                ))}
              </div>
              <button className="pixel-btn small primary" onClick={addMeal}>＋</button>
            </div>
            {meals.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {meals.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    {(() => {
                      const mt = MEAL_TYPES.find(mt => mt.type === m.type);
                      return mt ? <img src={mt.img} alt={mt.text} style={{ width: 20, height: 20, imageRendering: 'pixelated' }} /> : null;
                    })()}
                    <span>{m.content}</span>
                    <span className="pixel-badge" style={{
                      background: m.healthRating === 'healthy' ? '#4caf50' :
                        m.healthRating === 'indulgent' ? '#e8963e' : '#ff9800',
                      color: '#fff',
                      display: 'flex', alignItems: 'center', gap: 2,
                    }}>
                      <img src={
                        m.healthRating === 'healthy' ? '/assets/sdv/icons/tier_gold.png' :
                        m.healthRating === 'indulgent' ? '/assets/sdv/icons/tier_iridium.png' :
                        '/assets/sdv/icons/tier_silver.png'
                      } alt="" style={{ width: 14, height: 14, imageRendering: 'pixelated' }} />
                      {m.healthRating === 'healthy' ? '健康' : m.healthRating === 'indulgent' ? '享受' : '普通'}
                    </span>
                    <button className="pixel-btn small danger"
                      onClick={() => removeMeal(i)}
                      style={{ padding: '1px 6px', fontSize: 8 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 活动 */}
          <div className="pixel-panel">
            <div className="pixel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src="/assets/sdv/icons/activity_header.png" alt=""
                style={{ width: 32, height: 32, imageRendering: 'pixelated' }} />
              今日活动
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input className="pixel-input" value={activityText}
                onChange={e => setActivityText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addActivity()}
                placeholder="做了什么？学习、运动、社交..."
                style={{ flex: 1 }} />
              <button className="pixel-btn small primary" onClick={addActivity}>＋</button>
            </div>
            {activities.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {activities.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <span>▸ {a}</span>
                    <button className="pixel-btn small danger"
                      onClick={() => removeActivity(i)}
                      style={{ padding: '1px 6px', fontSize: 8 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 社交 */}
          <div className="pixel-panel">
            <div className="pixel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src="/assets/sdv/icons/social_header.png" alt=""
                style={{ width: 32, height: 32, imageRendering: 'pixelated' }} />
              今日社交
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SOCIAL_ACTIVITIES.map(sa => (
                <button
                  key={sa.key}
                  className={`pixel-btn small ${socialActivities.includes(sa.key) ? 'primary' : ''}`}
                  onClick={() => setSocialActivities(prev =>
                    prev.includes(sa.key) ? prev.filter(k => k !== sa.key) : [...prev, sa.key]
                  )}
                  style={{ fontSize: 11 }}
                >
                  {sa.text}
                </button>
              ))}
            </div>
          </div>

          {/* 备注 */}
          <div className="pixel-panel">
            <div className="pixel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src="/assets/sdv/icons/notes_header.png" alt=""
                style={{ width: 32, height: 32, imageRendering: 'pixelated' }} />
              今日笔记
            </div>
            <textarea className="pixel-input pixel-textarea"
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="写下今天的心情或想法..."
              rows={3} />
          </div>

          <button className="pixel-btn primary" onClick={handleSubmit} style={{ alignSelf: 'center', padding: '12px 40px' }}>
<img src="/assets/sdv/icons/save.png" alt="" style={{ width: 18, height: 18, imageRendering: 'pixelated', verticalAlign: 'middle' }} /> 保存今日记录
          </button>
        </div>
      )}
    </div>
  );
}

function HistoryView() {
  const [logs, setLogs] = useState<DailyLog[]>([]);

  useEffect(() => {
    db.dailyLogs.orderBy('date').reverse().limit(30).toArray().then(setLogs);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {logs.length === 0 ? (
        <div className="empty-state pixel-panel">
          <div className="pixel-subtitle">还没有历史记录</div>
        </div>
      ) : (
        logs.map(log => (
          <div key={log.id} className="pixel-panel" style={{ fontSize: 12 }}>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 10, marginBottom: 4 }}>
              📅 {log.date}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>😊 {'⭐'.repeat(log.mood)}</span>
              <span>💤 {log.sleep.quality}/5 · {log.sleep.startTime}-{log.sleep.endTime}</span>
              <span>🍽️ {log.meals.length}餐</span>
              <span>🎯 {log.activities.length}项活动</span>
            </div>
            {log.notes && (
              <div style={{ color: 'var(--color-text-light)', marginTop: 4, fontStyle: 'italic' }}>
                "{log.notes.slice(0, 100)}{log.notes.length > 100 ? '...' : ''}"
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
