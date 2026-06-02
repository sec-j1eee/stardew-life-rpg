import { useState, useEffect, useCallback } from 'react';
import { useGame } from '../contexts/GameContext';
import { db } from '../db/database';
import { todayStr } from '../db/models';
import type { Quest, Subtask } from '../db/models';
import { PRESET_TEMPLATES } from '../data/taskTemplates';
import { pickDailyQuests } from '../data/limitedQuests';

type TabType = 'daily' | 'limited' | 'phase';

export default function Quests() {
  const { state, addXP, addGold, updateStats } = useGame();
  const [dailyQuests, setDailyQuests] = useState<Quest[]>([]);
  const [limitedQuests, setLimitedQuests] = useState<Quest[]>([]);
  const [phaseQuests, setPhaseQuests] = useState<Quest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [tab, setTab] = useState<TabType>('daily');

  const today = todayStr();

  const loadQuests = useCallback(async () => {
    const allDaily = await db.quests.filter(q => q.type === 'daily' && !q.archived).toArray();
    setDailyQuests(allDaily);

    let allLimited = await db.quests.filter(q => q.type === 'limited' && q.date === today && !q.archived).toArray();
    if (allLimited.length === 0) {
      const picked = pickDailyQuests(4);
      for (const def of picked) {
        const id = await db.quests.add({
          title: def.title, description: def.description, type: 'limited',
          subtasks: [], xpReward: def.xpReward, goldReward: def.goldReward,
          completed: false, archived: false, date: today, createdAt: new Date(),
        } as Quest);
      }
      allLimited = await db.quests.filter(q => q.type === 'limited' && q.date === today && !q.archived).toArray();
    }
    setLimitedQuests(allLimited);

    setPhaseQuests(await db.quests.filter(q => q.type === 'phase' && !q.archived).toArray());
  }, [today]);

  useEffect(() => { loadQuests(); }, [loadQuests]);

  if (!state.player) {
    return (
      <div className="page">
        <div className="empty-state"><div className="empty-state-icon">📜</div><div className="pixel-title">请先创建角色</div></div>
      </div>
    );
  }

  async function completeQuest(quest: Quest) {
    if (quest.completed) return;
    await db.quests.update(quest.id!, { completed: true, completedDate: today });
    await addXP(quest.xpReward);
    await addGold(quest.goldReward);
    await updateStats({ mood: 0.05 });
    await loadQuests();
  }

  async function uncompleteQuest(quest: Quest) {
    if (!quest.completed) return;
    await db.quests.update(quest.id!, { completed: false, completedDate: undefined });
    await loadQuests();
  }

  async function toggleSubtask(quest: Quest, subtaskId: string) {
    const subtasks = quest.subtasks.map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    await db.quests.update(quest.id!, { subtasks } as any);
    if (subtasks.every(s => s.completed) && !quest.completed) {
      await completeQuest({ ...quest, subtasks });
    }
    await loadQuests();
  }

  async function deleteQuest(id: number) {
    await db.quests.delete(id);
    await loadQuests();
  }

  async function loadTemplate(templateId: string) {
    const template = PRESET_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    // Delete existing daily quests for today
    for (const q of dailyQuests) {
      await db.quests.delete(q.id!);
    }

    for (const tq of template.quests) {
      const existing = dailyQuests.find(q => q.title === tq.title && q.type === 'daily');
      if (existing) continue;

      await db.quests.add({
        title: tq.title, description: tq.description, type: 'daily',
        subtasks: (tq.subtasks || []).map(title => ({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 8), title, completed: false,
        })),
        deadline: tq.deadline,
        xpReward: tq.xpReward, goldReward: tq.goldReward,
        completed: false, archived: false, date: today, createdAt: new Date(),
      } as Quest);
    }
    await loadQuests();
  }

  async function resetDailyQuests() {
    for (const q of dailyQuests) {
      if (q.completed) {
        await db.quests.update(q.id!, { completed: false, completedDate: undefined });
      }
    }
    // Also regenerate limited quests
    for (const q of limitedQuests) {
      await db.quests.delete(q.id!);
    }
    loadQuests();
  }

  const quests = tab === 'daily' ? dailyQuests : tab === 'limited' ? limitedQuests : phaseQuests;
  const completedCount = quests.filter(q => q.completed).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="pixel-title" style={{ marginBottom: 4 }}>任务面板</div>
          <div className="pixel-subtitle">
            {tab === 'daily' ? '每天选一个模板，可以删改' : tab === 'limited' ? '每日随机刷新，当日有效' : '自定义长期目标'}
            {quests.length > 0 && <> · 完成 {completedCount}/{quests.length}</>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'daily' && dailyQuests.length > 0 && (
            <button className="pixel-btn small" onClick={resetDailyQuests}>🔄 新的一天</button>
          )}
          {tab === 'phase' && (
            <button className="pixel-btn primary" onClick={() => { setEditingQuest(null); setShowForm(true); }}>＋ 新任务</button>
          )}
        </div>
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([
          { key: 'daily' as TabType, label: '常驻', icon: '/assets/sdv/icons/cat_habit.png', hint: dailyQuests.length > 0 ? `已选 ${dailyQuests.length}项` : '点击加载' },
          { key: 'limited' as TabType, label: '限时', icon: '/assets/sdv/icons/cat_quest.png', hint: `${limitedQuests.length}个任务` },
          { key: 'phase' as TabType, label: '阶段', icon: '/assets/sdv/icons/cat_growth.png', hint: `${phaseQuests.length}个任务` },
        ]).map(t => (
          <button
            key={t.key}
            className={`pixel-btn small ${tab === t.key ? 'primary' : ''}`}
            onClick={() => setTab(t.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            <img src={t.icon} alt="" style={{ width: 18, height: 18, imageRendering: 'pixelated' }} />
            {t.label}
            <span style={{ fontSize: 10, opacity: 0.7 }}>({t.hint})</span>
          </button>
        ))}
      </div>

      {/* 常驻：模板选择 */}
      {tab === 'daily' && dailyQuests.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PRESET_TEMPLATES.map(tmpl => (
            <div key={tmpl.id} className="pixel-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <img src={tmpl.icon} alt="" style={{ width: 22, height: 22, imageRendering: 'pixelated' }} />
                  {tmpl.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginBottom: 4 }}>{tmpl.description}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 10, fontFamily: 'var(--font-pixel)', color: 'var(--color-text-light)' }}>
                  <span>⭐ {tmpl.quests.reduce((s, q) => s + q.xpReward, 0)}XP</span>
                  <span>🪙 {tmpl.quests.reduce((s, q) => s + q.goldReward, 0)}G</span>
                  <span>📋 {tmpl.quests.length}项任务</span>
                </div>
              </div>
              <button className="pixel-btn primary" onClick={() => loadTemplate(tmpl.id)} style={{ flexShrink: 0, marginLeft: 16 }}>
                选择
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 任务列表 */}
      {quests.length === 0 && tab !== 'daily' ? (
        <div className="empty-state pixel-panel">
          <div className="empty-state-icon">📜</div>
          <div className="pixel-subtitle">还没有任务</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {quests.map(quest => (
            <QuestCard
              key={quest.id}
              quest={quest}
              onComplete={() => completeQuest(quest)}
              onUncomplete={() => uncompleteQuest(quest)}
              onToggleSubtask={(sid) => toggleSubtask(quest, sid)}
              onEdit={tab === 'phase' ? () => { setEditingQuest(quest); setShowForm(true); } : undefined}
              onDelete={tab === 'daily' ? () => deleteQuest(quest.id!) : tab === 'phase' ? () => deleteQuest(quest.id!) : undefined}
            />
          ))}
        </div>
      )}

      {showForm && tab === 'phase' && (
        <QuestFormModal
          quest={editingQuest}
          onClose={() => { setShowForm(false); setEditingQuest(null); }}
          onSaved={loadQuests}
        />
      )}
    </div>
  );
}

function QuestCard({
  quest, onComplete, onUncomplete, onToggleSubtask, onEdit, onDelete,
}: {
  quest: Quest; onComplete: () => void; onUncomplete: () => void;
  onToggleSubtask: (subtaskId: string) => void;
  onEdit?: () => void; onDelete?: () => void;
}) {
  const subProgress = quest.subtasks.length > 0
    ? `${quest.subtasks.filter(s => s.completed).length}/${quest.subtasks.length}`
    : null;

  return (
    <div className={`pixel-panel animate-fade-in ${quest.completed ? 'pixel-border-thin' : ''}`}
      style={quest.completed ? { opacity: 0.7, background: '#e8f5e9' } : {}}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 11, textDecoration: quest.completed ? 'line-through' : 'none' }}>{quest.title}</span>
            <span className="pixel-badge" style={quest.type === 'daily' ? {} : quest.type === 'limited' ? { background: '#ff9800' } : { background: '#6bceff' }}>
              {quest.type === 'daily' ? '常驻' : quest.type === 'limited' ? '限时' : '阶段'}
            </span>
          </div>
          {quest.description && <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 4 }}>{quest.description}</div>}
          {quest.subtasks.length > 0 && (
            <div style={{ margin: '8px 0', paddingLeft: 8 }}>
              {quest.subtasks.map(st => (
                <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', padding: '2px 0',
                  textDecoration: st.completed ? 'line-through' : 'none', opacity: st.completed ? 0.6 : 1 }}
                  onClick={() => onToggleSubtask(st.id)}>
                  <input type="checkbox" checked={st.completed} onChange={() => {}} style={{ accentColor: 'var(--color-green)' }} />
                  {st.title}
                </label>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10, fontFamily: 'var(--font-pixel)', color: 'var(--color-text-light)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <img src="/assets/sdv/icons/xp.png" alt="" style={{ width: 12, height: 12, imageRendering: 'pixelated' }} />
              {quest.xpReward}XP
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <img src="/assets/sdv/icons/coin.png" alt="" style={{ width: 12, height: 12, imageRendering: 'pixelated' }} />
              {quest.goldReward}G
            </span>
            {subProgress && <span>📋 {subProgress}</span>}
            {quest.deadline && <span>⏰ {quest.deadline}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {onDelete && <button className="pixel-btn small danger" onClick={onDelete} style={{ padding: '2px 8px', fontSize: 10 }}>✕</button>}
          {onEdit && <button className="pixel-btn small" onClick={onEdit} style={{ padding: '2px 8px', fontSize: 10 }}>✎</button>}
          <button className={`pixel-btn small ${quest.completed ? 'danger' : 'success'}`} onClick={quest.completed ? onUncomplete : onComplete} style={{ padding: '2px 10px', fontSize: 10 }}>
            {quest.completed ? '↩' : '✓'}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestFormModal({ quest, onClose, onSaved }: { quest: Quest | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(quest?.title || '');
  const [description, setDescription] = useState(quest?.description || '');
  const [xpReward, setXpReward] = useState(quest?.xpReward || 50);
  const [goldReward, setGoldReward] = useState(quest?.goldReward || 10);
  const [deadline, setDeadline] = useState(quest?.deadline || '');
  const [subtaskText, setSubtaskText] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>(quest?.subtasks || []);

  async function handleSave() {
    if (!title.trim()) return;
    const data = {
      title: title.trim(), description: description.trim(), type: 'phase' as const,
      xpReward, goldReward, deadline: deadline || undefined, subtasks,
      completed: quest?.completed || false, completedDate: quest?.completedDate,
      archived: false, createdAt: quest?.createdAt || new Date(),
    };
    if (quest?.id) { await db.quests.update(quest.id, data); }
    else { await db.quests.add(data as Quest); }
    onSaved(); onClose();
  }

  function addSubtask() {
    if (!subtaskText.trim()) return;
    setSubtasks([...subtasks, { id: Date.now().toString(), title: subtaskText.trim(), completed: false }]);
    setSubtaskText('');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content pixel-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="pixel-title" style={{ marginBottom: 0 }}>{quest ? '编辑任务' : '新阶段任务'}</div>
          <button className="pixel-btn small" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="pixel-label">任务名称</label>
            <input className="pixel-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="任务名称..." autoFocus />
          </div>
          <div className="form-group">
            <label className="pixel-label">描述（可选）</label>
            <input className="pixel-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="任务详情..." />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="pixel-label">经验奖励</label>
              <input className="pixel-input" type="number" value={xpReward} onChange={e => setXpReward(Number(e.target.value))} min={0} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="pixel-label">金币奖励</label>
              <input className="pixel-input" type="number" value={goldReward} onChange={e => setGoldReward(Number(e.target.value))} min={0} />
            </div>
          </div>
          <div className="form-group">
            <label className="pixel-label">子任务（可选）</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="pixel-input" value={subtaskText} onChange={e => setSubtaskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubtask()} placeholder="添加子任务..." />
              <button className="pixel-btn small primary" onClick={addSubtask}>＋</button>
            </div>
            {subtasks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                {subtasks.map((st, i) => (
                  <div key={st.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <span>• {st.title}</span>
                    <button className="pixel-btn small danger" onClick={() => setSubtasks(subtasks.filter((_, j) => j !== i))} style={{ padding: '1px 6px', fontSize: 8 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="pixel-btn primary" onClick={handleSave}>{quest ? '保存修改' : '创建任务'}</button>
        </div>
      </div>
    </div>
  );
}
