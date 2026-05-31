import { useState, useEffect, useCallback } from 'react';
import { useGame } from '../contexts/GameContext';
import { db, getDailyQuests, getPhaseQuests } from '../db/database';
import { todayStr } from '../db/models';
import type { Quest, Subtask } from '../db/models';
import { PRESET_TEMPLATES } from '../data/taskTemplates';

export default function Quests() {
  const { state, addXP, addGold, updateStats } = useGame();
  const [dailyQuests, setDailyQuests] = useState<Quest[]>([]);
  const [phaseQuests, setPhaseQuests] = useState<Quest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [tab, setTab] = useState<'daily' | 'phase'>('daily');
  const [showTemplates, setShowTemplates] = useState(false);

  const loadQuests = useCallback(async () => {
    setDailyQuests(await getDailyQuests());
    setPhaseQuests(await getPhaseQuests());
  }, []);

  useEffect(() => { loadQuests(); }, [loadQuests]);

  if (!state.player) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">📜</div>
          <div className="pixel-title">请先创建角色</div>
        </div>
      </div>
    );
  }

  async function completeQuest(quest: Quest) {
    if (quest.completed) return;
    const today = todayStr();

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

    // 如果所有子任务都完成了，自动完成主任务
    if (subtasks.every(s => s.completed) && !quest.completed) {
      await completeQuest({ ...quest, subtasks });
    }
    await loadQuests();
  }

  async function deleteQuest(id: number) {
    await db.quests.delete(id);
    await loadQuests();
  }

  async function resetDailyQuests() {
    for (const q of dailyQuests) {
      if (q.completed) {
        await db.quests.update(q.id!, { completed: false, completedDate: undefined });
      }
    }
    loadQuests();
  }

  async function loadTemplate(templateId: string) {
    const template = PRESET_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    const existingTitles = new Set(quests.map(q => q.title));

    for (const tq of template.quests) {
      if (existingTitles.has(tq.title)) continue; // 跳过同名任务

      const quest: Omit<Quest, 'id'> = {
        title: tq.title,
        description: tq.description,
        type: tab,
        subtasks: (tq.subtasks || []).map(title => ({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
          title,
          completed: false,
        })),
        deadline: tq.deadline,
        xpReward: tq.xpReward || (tab === 'daily' ? 50 : 200),
        goldReward: tq.goldReward || (tab === 'daily' ? 10 : 50),
        completed: false,
        archived: false,
        createdAt: new Date(),
      };

      await db.quests.add(quest as Quest);
    }

    setShowTemplates(false);
    await loadQuests();
  }

  const quests = tab === 'daily' ? dailyQuests : phaseQuests;
  const completedCount = quests.filter(q => q.completed).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="pixel-title" style={{ marginBottom: 4 }}>任务面板</div>
          <div className="pixel-subtitle">
            完成 {completedCount}/{quests.length} · 获得经验和金币奖励
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'daily' && (
            <button className="pixel-btn small" onClick={resetDailyQuests}><img src="/assets/sdv/icons/new_day.png" alt="" style={{ width: 16, height: 16, imageRendering: 'pixelated', verticalAlign: 'middle' }} /> 新的一天</button>
          )}
          <button className="pixel-btn primary" onClick={() => { setEditingQuest(null); setShowForm(true); }}>
            ＋ 新任务
          </button>
          <button className="pixel-btn" onClick={() => setShowTemplates(true)}
            style={{ background: 'var(--color-blue)', borderColor: 'var(--color-blue-dark)' }}>
            <img src="/assets/sdv/icons/cat_growth.png" alt="" style={{ width: 16, height: 16, imageRendering: 'pixelated', verticalAlign: 'middle' }} /> 模板库
          </button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`pixel-btn small ${tab === 'daily' ? 'primary' : ''}`}
          onClick={() => setTab('daily')}
        >
          <img src="/assets/sdv/icons/journal_nav.png" alt="" style={{ width: 16, height: 16, imageRendering: 'pixelated', verticalAlign: 'middle' }} /> 每日任务 ({dailyQuests.length})
        </button>
        <button
          className={`pixel-btn small ${tab === 'phase' ? 'primary' : ''}`}
          onClick={() => setTab('phase')}
        >
          <img src="/assets/sdv/icons/quest_nav.png" alt="" style={{ width: 16, height: 16, imageRendering: 'pixelated', verticalAlign: 'middle' }} /> 阶段任务 ({phaseQuests.length})
        </button>
      </div>

      {/* 任务列表 */}
      {quests.length === 0 ? (
        <div className="empty-state pixel-panel">
          <div className="empty-state-icon">📜</div>
          <div className="pixel-subtitle">还没有任务，快来创建一个吧！</div>
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
              onEdit={() => { setEditingQuest(quest); setShowForm(true); }}
              onDelete={() => deleteQuest(quest.id!)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <QuestFormModal
          quest={editingQuest}
          defaultType={tab}
          onClose={() => { setShowForm(false); setEditingQuest(null); }}
          onSaved={loadQuests}
        />
      )}

      {showTemplates && (
        <div className="modal-overlay" onClick={() => setShowTemplates(false)}>
          <div className="modal-content pixel-panel" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="pixel-title" style={{ marginBottom: 0, fontSize: 18 }}><img src="/assets/sdv/icons/cat_growth.png" alt="" style={{ width: 16, height: 16, imageRendering: 'pixelated', verticalAlign: 'middle' }} /> 任务模板库</div>
              <button className="pixel-btn small" onClick={() => setShowTemplates(false)}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 12 }}>
              选择模板一键加载，将添加到当前「{tab === 'daily' ? '每日任务' : '阶段任务'}」列表中
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PRESET_TEMPLATES.map(tmpl => (
                <div key={tmpl.id} className="pixel-border-thin" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, marginBottom: 2 }}>
                        <img src={tmpl.icon} alt="" style={{ width: 22, height: 22, imageRendering: 'pixelated', verticalAlign: 'middle' }} /> {tmpl.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginBottom: 6 }}>
                        {tmpl.description}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {tmpl.quests.map(q => (
                          <span key={q.title} className="pixel-badge" style={{ fontSize: 9, background: '#e8dcc8' }}>
                            {q.title}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="pixel-btn small primary" onClick={() => loadTemplate(tmpl.id)}
                      style={{ flexShrink: 0, marginLeft: 12 }}>
                      加载 {tmpl.quests.length}项
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestCard({
  quest,
  onComplete,
  onUncomplete,
  onToggleSubtask,
  onEdit,
  onDelete,
}: {
  quest: Quest;
  onComplete: () => void;
  onUncomplete: () => void;
  onToggleSubtask: (subtaskId: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const subProgress = quest.subtasks.length > 0
    ? `${quest.subtasks.filter(s => s.completed).length}/${quest.subtasks.length}`
    : null;

  return (
    <div className={`pixel-panel animate-fade-in ${quest.completed ? 'pixel-border-thin' : ''}`}
      style={quest.completed ? { opacity: 0.7, background: '#e8f5e9' } : {}}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 11,
              textDecoration: quest.completed ? 'line-through' : 'none',
            }}>
              {quest.title}
            </span>
            <span className={`pixel-badge ${quest.type === 'daily' ? '' : 'locked'}`}
              style={quest.type === 'phase' ? { background: '#6bceff' } : {}}
            >
              {quest.type === 'daily' ? '每日' : '阶段'}
            </span>
          </div>

          {quest.description && (
            <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 4 }}>
              {quest.description}
            </div>
          )}

          {/* 子任务 */}
          {quest.subtasks.length > 0 && (
            <div style={{ margin: '8px 0', paddingLeft: 8 }}>
              {quest.subtasks.map(st => (
                <label
                  key={st.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, cursor: 'pointer', padding: '2px 0',
                    textDecoration: st.completed ? 'line-through' : 'none',
                    opacity: st.completed ? 0.6 : 1,
                  }}
                  onClick={() => onToggleSubtask(st.id)}
                >
                  <input
                    type="checkbox"
                    checked={st.completed}
                    onChange={() => {}}
                    style={{ accentColor: 'var(--color-green)' }}
                  />
                  {st.title}
                </label>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10, fontFamily: 'var(--font-pixel)', color: 'var(--color-text-light)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <img src="/assets/sdv/icons/xp.png" alt=""
                style={{ width: 14, height: 14, imageRendering: 'pixelated' }} />
              {quest.xpReward}XP
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <img src="/assets/sdv/icons/coin.png" alt=""
                style={{ width: 14, height: 14, imageRendering: 'pixelated' }} />
              {quest.goldReward}G
            </span>
            {subProgress && <span><img src="/assets/sdv/icons/cat_growth.png" alt="" style={{ width: 16, height: 16, imageRendering: 'pixelated', verticalAlign: 'middle' }} /> {subProgress}</span>}
            {quest.deadline && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <img src="/assets/sdv/icons/pomodoro.png" alt=""
                  style={{ width: 14, height: 14, imageRendering: 'pixelated' }} />
                {quest.deadline}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            className={`pixel-btn small ${quest.completed ? 'danger' : 'success'}`}
            onClick={quest.completed ? onUncomplete : onComplete}
          >
            {quest.completed ? '↩' : '✓'}
          </button>
          <button className="pixel-btn small" onClick={onEdit}>✎</button>
          <button className="pixel-btn small danger" onClick={onDelete}>✕</button>
        </div>
      </div>
    </div>
  );
}

function QuestFormModal({
  quest,
  defaultType,
  onClose,
  onSaved,
}: {
  quest: Quest | null;
  defaultType: 'daily' | 'phase';
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(quest?.title || '');
  const [description, setDescription] = useState(quest?.description || '');
  const [type, setType] = useState<'daily' | 'phase'>(quest?.type || defaultType);
  const [xpReward, setXpReward] = useState(quest?.xpReward || (type === 'daily' ? 50 : 200));
  const [goldReward, setGoldReward] = useState(quest?.goldReward || (type === 'daily' ? 10 : 50));
  const [deadline, setDeadline] = useState(quest?.deadline || '');
  const [subtaskText, setSubtaskText] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>(quest?.subtasks || []);

  async function handleSave() {
    if (!title.trim()) return;

    const data = {
      title: title.trim(),
      description: description.trim(),
      type,
      xpReward,
      goldReward,
      deadline: deadline || undefined,
      subtasks,
      completed: quest?.completed || false,
      completedDate: quest?.completedDate,
      archived: false,
      createdAt: quest?.createdAt || new Date(),
    };

    if (quest?.id) {
      await db.quests.update(quest.id, data);
    } else {
      await db.quests.add(data as Quest);
    }

    onSaved();
    onClose();
  }

  function addSubtask() {
    if (!subtaskText.trim()) return;
    setSubtasks([...subtasks, {
      id: Date.now().toString(),
      title: subtaskText.trim(),
      completed: false,
    }]);
    setSubtaskText('');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content pixel-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="pixel-title" style={{ marginBottom: 0 }}>{quest ? '编辑任务' : '新任务'}</div>
          <button className="pixel-btn small" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="pixel-label">任务名称</label>
            <input className="pixel-input" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="例如：背30个单词" autoFocus />
          </div>

          <div className="form-group">
            <label className="pixel-label">描述（可选）</label>
            <input className="pixel-input" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="任务详情..." />
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="pixel-label">类型</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={`pixel-btn small ${type === 'daily' ? 'primary' : ''}`}
                  onClick={() => setType('daily')}>每日</button>
                <button className={`pixel-btn small ${type === 'phase' ? 'primary' : ''}`}
                  onClick={() => setType('phase')}>阶段</button>
              </div>
            </div>
            {type === 'daily' && (
              <div className="form-group" style={{ flex: 1 }}>
                <label className="pixel-label">截止时间</label>
                <input className="pixel-input" type="time" value={deadline}
                  onChange={e => setDeadline(e.target.value)} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="pixel-label">经验奖励</label>
              <input className="pixel-input" type="number" value={xpReward}
                onChange={e => setXpReward(Number(e.target.value))} min={0} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="pixel-label">金币奖励</label>
              <input className="pixel-input" type="number" value={goldReward}
                onChange={e => setGoldReward(Number(e.target.value))} min={0} />
            </div>
          </div>

          {/* 子任务 */}
          <div className="form-group">
            <label className="pixel-label">子任务（可选）</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="pixel-input" value={subtaskText}
                onChange={e => setSubtaskText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubtask()}
                placeholder="添加子任务..." />
              <button className="pixel-btn small primary" onClick={addSubtask}>＋</button>
            </div>
            {subtasks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                {subtasks.map((st, i) => (
                  <div key={st.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <span>• {st.title}</span>
                    <button className="pixel-btn small danger"
                      onClick={() => setSubtasks(subtasks.filter((_, j) => j !== i))}
                      style={{ padding: '1px 6px', fontSize: 8 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="pixel-btn primary" onClick={handleSave} style={{ marginTop: 8 }}>
            {quest ? '保存修改' : '创建任务'}
          </button>
        </div>
      </div>
    </div>
  );
}
