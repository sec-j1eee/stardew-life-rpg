import { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { xpForLevel } from '../db/models';
import type { PlayerStats } from '../db/models';
import { getEffectiveMaxStat } from '../systems/statBonuses';
import { MoodTrendChart, SleepBarChart, MealPieChart, FocusTimeChart, MoodSleepScatter } from '../components/stats/StatsCharts';

const STAT_CONFIG: { key: keyof PlayerStats; label: string; img: string; color: string }[] = [
  { key: 'study', label: '学习力', img: '/assets/sdv/icons/study_stat.png', color: '#6bceff' },
  { key: 'health', label: '健康度', img: '/assets/sdv/icons/health_stat.png', color: '#4caf50' },
  { key: 'social', label: '社交力', img: '/assets/sdv/icons/social_stat.png', color: '#ff9800' },
  { key: 'mood', label: '心情值', img: '/assets/sdv/icons/mood_stat.png', color: '#e91e63' },
  { key: 'willpower', label: '自制力', img: '/assets/sdv/icons/willpower_stat.png', color: '#9c27b0' },
  { key: 'stamina', label: '体力', img: '/assets/sdv/icons/stamina_stat.png', color: '#f0c75e' },
];

export default function Dashboard() {
  const { state } = useGame();
  const player = state.player;
  const [showCharts, setShowCharts] = useState(false);

  if (!player) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="pixel-title">请先创建角色</div>
        </div>
      </div>
    );
  }

  const xpNeeded = xpForLevel(player.level);
  const xpPercent = Math.round((player.xp / xpNeeded) * 100);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="pixel-title" style={{ marginBottom: 4 }}>玩家仪表盘</div>
          <div className="pixel-subtitle">{player.name} 的冒险日志</div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div className="level-badge">{player.level}</div>
          <div className="gold-display" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <img src="/assets/sdv/icons/coin.png" alt=""
              style={{ width: 16, height: 16, imageRendering: 'pixelated' }} />
            {player.gold}G
          </div>
        </div>
      </div>

      {/* 经验条 */}
      <div className="pixel-panel" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
          <span className="pixel-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src="/assets/sdv/icons/xp.png" alt=""
              style={{ width: 20, height: 20, imageRendering: 'pixelated' }} />
            经验值 Lv.{player.level}
          </span>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: 'var(--color-text-light)' }}>
            {player.xp}/{xpNeeded} XP
          </span>
        </div>
        <div className="pixel-progress">
          <div className="pixel-progress-fill xp" style={{ width: `${xpPercent}%` }} />
          <span className="progress-label">{xpPercent}%</span>
        </div>
      </div>

      {/* 属性面板 */}
      <div className="pixel-panel">
        <div className="pixel-title" style={{ marginBottom: 16 }}>属性</div>
        {STAT_CONFIG.map(stat => (
          <div className="stat-row" key={stat.key}>
            <span className="stat-icon">
              <img src={stat.img} alt={stat.label}
                style={{ width: 28, height: 28, imageRendering: 'pixelated' }} />
            </span>
            <span className="stat-label">{stat.label}</span>
            <div className="stat-bar-wrap">
              <div className="pixel-progress" style={{ height: 12 }}>
                <div
                  className="pixel-progress-fill"
                  style={{
                    width: `${(player.stats[stat.key] / 10) * 100}%`,
                    background: stat.color,
                  }}
                />
              </div>
            </div>
            <span className="stat-level">Lv.{Number(player.stats[stat.key].toFixed(1))}{stat.key === 'stamina' && getEffectiveMaxStat(player.stats, 'stamina') > 10 ? ` / ${getEffectiveMaxStat(player.stats, 'stamina')}` : ''}</span>
          </div>
        ))}
      </div>

      {/* 趋势图表 */}
      <div className="pixel-panel" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowCharts(!showCharts)}>
          <div className="pixel-subtitle" style={{ marginBottom: 0 }}>
            趋势分析
          </div>
          <button className="pixel-btn small">
            {showCharts ? '收起 ▲' : '展开 ▼'}
          </button>
        </div>
        {showCharts && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MoodTrendChart />
            <SleepBarChart />
            <MealPieChart />
            <FocusTimeChart />
            <MoodSleepScatter />
          </div>
        )}
      </div>
    </div>
  );
}
