import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { db } from '../../db/database';
import type { DailyLog } from '../../db/models';

function useChartData() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [pomoData, setPomoData] = useState<{ date: string; minutes: number }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const rawLogs = await db.dailyLogs.orderBy('date').reverse().limit(30).toArray();
    setLogs(rawLogs.reverse());

    const sessions = await db.pomodoroSessions.toArray();
    const byDay = new Map<string, number>();
    sessions.forEach(s => {
      const prev = byDay.get(s.date) || 0;
      byDay.set(s.date, prev + Math.floor(s.duration / 60));
    });
    const sorted = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30);
    setPomoData(sorted.map(([date, minutes]) => ({ date: date.slice(5), minutes })));
  }

  return { logs, pomoData };
}

const PIE_COLORS = ['#4caf50', '#ff9800', '#c0392b'];

export function MoodTrendChart() {
  const { logs } = useChartData();

  const data = logs.map(l => ({
    date: l.date.slice(5),
    mood: l.mood,
    sleepQuality: l.sleep.quality,
  }));

  if (data.length < 2) {
    return <div className="chart-empty">记录更多天数据后可查看趋势</div>;
  }

  return (
    <div className="chart-container">
      <div className="pixel-label" style={{ marginBottom: 8 }}>😊 心情 & 💤 睡眠趋势</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8dcc8" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'var(--font-pixel)' }} />
          <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="mood" stroke="#e91e63" name="心情" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="sleepQuality" stroke="#2a5f8a" name="睡眠质量" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SleepBarChart() {
  const { logs } = useChartData();

  const data = logs.map(l => {
    const [sh, sm] = l.sleep.startTime.split(':').map(Number);
    const [eh, em] = l.sleep.endTime.split(':').map(Number);
    let hours = eh - sh + (em - sm) / 60;
    if (hours < 0) hours += 24;
    return {
      date: l.date.slice(5),
      hours: Math.round(hours * 10) / 10,
      quality: l.sleep.quality,
    };
  });

  if (data.length < 2) {
    return <div className="chart-empty">记录更多天数据后可查看趋势</div>;
  }

  return (
    <div className="chart-container">
      <div className="pixel-label" style={{ marginBottom: 8 }}>💤 睡眠时长</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8dcc8" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'var(--font-pixel)' }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="hours" name="睡眠时长(h)" fill="#2a5f8a" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MealPieChart() {
  const { logs } = useChartData();

  let healthy = 0, normal = 0, indulgent = 0;
  logs.forEach(l => {
    l.meals.forEach(m => {
      if (m.healthRating === 'healthy') healthy++;
      else if (m.healthRating === 'normal') normal++;
      else indulgent++;
    });
  });

  const total = healthy + normal + indulgent;
  if (total === 0) {
    return <div className="chart-empty">记录饮食后可查看分布</div>;
  }

  const data = [
    { name: '健康', value: healthy },
    { name: '一般', value: normal },
    { name: '放纵', value: indulgent },
  ];

  return (
    <div className="chart-container">
      <div className="pixel-label" style={{ marginBottom: 8 }}>🍽️ 饮食健康分布（近30天）</div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value">
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FocusTimeChart() {
  const { pomoData } = useChartData();

  if (pomoData.length < 2) {
    return <div className="chart-empty">完成番茄钟后可查看统计</div>;
  }

  return (
    <div className="chart-container">
      <div className="pixel-label" style={{ marginBottom: 8 }}>⏱️ 每日专注时长（分钟）</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={pomoData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8dcc8" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'var(--font-pixel)' }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="minutes" name="专注分钟" fill="#6bceff" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MoodSleepScatter() {
  const { logs } = useChartData();

  const data = logs.map(l => ({
    sleepQuality: l.sleep.quality,
    mood: l.mood,
    date: l.date.slice(5),
  }));

  if (data.length < 3) {
    return <div className="chart-empty">记录更多天数据后可查看关联</div>;
  }

  return (
    <div className="chart-container">
      <div className="pixel-label" style={{ marginBottom: 8 }}>🔗 睡眠质量 vs 心情</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8dcc8" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'var(--font-pixel)' }} />
          <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="sleepQuality" name="睡眠质量" fill="#2a5f8a" radius={[2, 2, 0, 0]} />
          <Bar dataKey="mood" name="心情" fill="#e91e63" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
