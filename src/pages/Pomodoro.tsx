import { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../contexts/GameContext';
import { db, getTodaysPomodoroCount } from '../db/database';
import type { PomodoroSession } from '../db/models';
import { XP_TABLE, GOLD_TABLE, todayStr } from '../db/models';

type TimerState = 'idle' | 'focus' | 'break' | 'countup';

const DEFAULT_FOCUS = 25 * 60;

export default function Pomodoro() {
  const { state, addXP, addGold, updateStats } = useGame();
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [timeLeft, setTimeLeft] = useState(DEFAULT_FOCUS);
  const [elapsed, setElapsed] = useState(0);
  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [taskName, setTaskName] = useState('');
  const [todayCount, setTodayCount] = useState(0);
  const [totalFocusSec, setTotalFocusSec] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    loadStats();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  async function loadStats() {
    setTodayCount(await getTodaysPomodoroCount());

    const sessions = await db.pomodoroSessions
      .filter(s => s.type === 'focus')
      .toArray();
    setTotalFocusSec(sessions.reduce((sum, s) => sum + s.duration, 0));
  }

  const startTimer = useCallback((type: 'focus' | 'break') => {
    const duration = type === 'focus' ? focusDuration * 60 : breakDuration * 60;
    setTimerState(type);
    setTimeLeft(duration);
    startTimeRef.current = Date.now();

    intervalRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          if (type === 'focus') {
            completeFocusSession(duration);
            setTimerState('break');
            return breakDuration * 60;
          } else {
            setTimerState('idle');
            return focusDuration * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);
  }, [focusDuration, breakDuration]);

  async function completeFocusSession(duration: number) {
    const today = todayStr();
    const session: PomodoroSession = {
      duration,
      type: 'focus',
      completedAt: new Date(),
      date: today,
      taskName: taskName || undefined,
    };
    await db.pomodoroSessions.add(session);
    await addXP(XP_TABLE.POMODORO_FOCUS);
    await addGold(GOLD_TABLE.POMODORO_FOCUS);
    await updateStats({ study: 0.1 });
    await loadStats();
  }

  const startCountUp = useCallback(() => {
    setTimerState('countup');
    setElapsed(0);
    startTimeRef.current = Date.now();

    intervalRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  function stopTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerState === 'focus') {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (elapsed >= 60) {
        completeFocusSession(elapsed);
      }
    }
    if (timerState === 'countup') {
      const totalElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (totalElapsed >= 60) {
        completeFocusSession(totalElapsed);
      }
    }
    setTimerState('idle');
    setTimeLeft(focusDuration * 60);
    setElapsed(0);
  }

  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function getTimerLabel(): string {
    if (timerState === 'focus') return '专注中...';
    if (timerState === 'break') return '休息一下';
    if (timerState === 'countup') return '正计时中...';
    return '准备开始';
  }

  const displayTime = timerState === 'countup' ? formatTime(elapsed) : formatTime(timeLeft);
  const totalFocusMin = Math.floor(totalFocusSec / 60);
  const progress = timerState === 'idle' ? 0 :
    timerState === 'countup' ? Math.min(1, elapsed / (focusDuration * 60)) :
    1 - (timeLeft / (timerState === 'focus' ? focusDuration * 60 : breakDuration * 60));

  if (!state.player) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">🍅</div>
          <div className="pixel-title">请先创建角色</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="pixel-title" style={{ marginBottom: 4 }}>番茄钟</div>
          <div className="pixel-subtitle">
            今日 {todayCount} 个 · 累计 {totalFocusMin} 分钟
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        {/* 计时器主体 */}
        <div className="pixel-panel" style={{
          width: '100%', maxWidth: 560,
          textAlign: 'center',
          padding: '36px 56px',
          background: timerState === 'focus' ? '#1a2a3a' :
            timerState === 'break' ? '#2a3a1a' :
            timerState === 'countup' ? '#3a2a1a' : undefined,
        }}>
          <div style={{
            fontSize: 60,
            fontFamily: 'var(--font-pixel)',
            color: timerState === 'focus' ? '#6bceff' :
              timerState === 'break' ? '#4caf50' :
              timerState === 'countup' ? '#f0c75e' :
                'var(--color-text)',
            marginBottom: 8,
            transition: 'color 0.3s',
          }}>
            {displayTime}
          </div>

          <div className="pixel-progress" style={{ marginBottom: 12 }}>
            <div
              className={`pixel-progress-fill ${timerState === 'focus' ? 'xp' : timerState === 'countup' ? 'stamina' : 'hp'}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <div style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 11,
            color: timerState === 'focus' ? '#6bceff' :
              timerState === 'break' ? '#4caf50' :
              timerState === 'countup' ? '#f0c75e' :
                'var(--color-text-light)',
            marginBottom: 16,
          }}>
            {getTimerLabel()}
            {timerState === 'focus' && taskName && (
              <span style={{ display: 'block', fontSize: 9, marginTop: 4, opacity: 0.7 }}>
                📖 {taskName}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {timerState === 'idle' ? (
              <>
                <button className="pixel-btn primary" onClick={() => startTimer('focus')}>
                  ▶ 开始专注
                </button>
                <button className="pixel-btn" onClick={() => startTimer('break')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <img src="/assets/sdv/icons/break.png" alt=""
                    style={{ width: 22, height: 22, imageRendering: 'pixelated' }} />
                  休息
                </button>
                <button className="pixel-btn" onClick={startCountUp}
                  style={{ background: '#8b6914', borderColor: '#6b4f3c' }}>
                  ▲ 正计时
                </button>
              </>
            ) : (
              <button className="pixel-btn danger" onClick={stopTimer}>
                ⏹ 停止
              </button>
            )}
          </div>
        </div>

        {/* 设置 */}
        {timerState === 'idle' && (
          <div className="pixel-panel" style={{ width: '100%', maxWidth: 560 }}>
            <div className="pixel-title" style={{ marginBottom: 12 }}>设置</div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="pixel-label">任务名称（可选）</label>
              <input className="pixel-input" value={taskName}
                onChange={e => setTaskName(e.target.value)}
                placeholder="当前正在做什么？" />
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="pixel-label">专注时长（分钟）</label>
                <input className="pixel-input" type="number" value={focusDuration}
                  onChange={e => setFocusDuration(Number(e.target.value))}
                  min={1} max={120} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="pixel-label">休息时长（分钟）</label>
                <input className="pixel-input" type="number" value={breakDuration}
                  onChange={e => setBreakDuration(Number(e.target.value))}
                  min={1} max={30} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
