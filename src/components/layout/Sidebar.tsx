import { NavLink } from 'react-router-dom';
import { useGame } from '../../contexts/GameContext';

export default function Sidebar() {
  const { state } = useGame();
  const { player } = state;

  const links: { to: string; label: string; img?: string; end?: boolean }[] = [
    { to: '/', label: '主页', img: '/assets/sdv/icons/home_nav.png', end: true },
    { to: '/dashboard', label: '仪表盘', img: '/assets/sdv/icons/gaming.png' },
    { to: '/quests', label: '任务', img: '/assets/sdv/icons/quest_nav.png' },
    { to: '/pomodoro', label: '番茄钟', img: '/assets/sdv/icons/pomodoro.png' },
    { to: '/journal', label: '日常记录', img: '/assets/sdv/icons/journal_nav.png' },
    { to: '/achievements', label: '成就', img: '/assets/sdv/icons/tier_gold.png' },
    { to: '/summary', label: '每日总结', img: '/assets/sdv/icons/calendar.png' },
    { to: '/inventory', label: '背包', img: '/assets/sdv/icons/backpack.png' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-title" style={{ padding: '8px 0' }}>
        <div style={{
          fontFamily: 'var(--font-pixel)', fontSize: 15, color: 'var(--color-gold)',
          textAlign: 'center', letterSpacing: 3, lineHeight: 1.6,
        }}>
          STARDEW<br />LIFE
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}`
            }
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {link.img && (
              <img src={link.img} alt={link.label}
                style={{ width: 22, height: 22, imageRendering: 'pixelated' }} />
            )}
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ borderTop: '2px solid rgba(255,255,255,0.1)', paddingTop: 8, display: 'flex', gap: 4 }}>
        <button
          onClick={async () => {
            const db = (await import('../../db/database')).db;
            const data: any = {};
            for (const table of db.tables) {
              data[table.name] = await table.toArray();
            }
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `stardew-life-${new Date().toISOString().slice(0,10)}.json`;
            a.click(); URL.revokeObjectURL(url);
          }}
          className="pixel-btn small"
          style={{ flex: 1, fontSize: 9, padding: '4px 6px', letterSpacing: 0 }}
        >
          导出
        </button>
        <button
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.json';
            input.onchange = async (e: any) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const data = JSON.parse(text);
              const db = (await import('../../db/database')).db;
              for (const table of db.tables) {
                await table.clear();
                const rows = data[table.name] || [];
                if (rows.length > 0) await table.bulkAdd(rows);
              }
              alert('导入成功！刷新页面生效。');
              location.reload();
            };
            input.click();
          }}
          className="pixel-btn small"
          style={{ flex: 1, fontSize: 9, padding: '4px 6px', letterSpacing: 0 }}
        >
          导入
        </button>
      </div>
      {player && (
        <div style={{ padding: '8px 0', borderTop: '2px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 9, color: '#f0c75e', fontFamily: 'var(--font-pixel)', marginBottom: 4 }}>
            Lv.{player.level} {player.name}
          </div>
          <div className="gold-display" style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
            <img src="/assets/sdv/icons/coin.png" alt=""
              style={{ width: 12, height: 12, imageRendering: 'pixelated' }} />
            {player.gold}G
          </div>
        </div>
      )}

    </aside>
  );
}
