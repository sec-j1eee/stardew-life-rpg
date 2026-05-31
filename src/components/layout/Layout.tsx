import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useGame } from '../../contexts/GameContext';
import LevelUpModal from '../player/LevelUpModal';

export default function Layout() {
  const { state, resetLevelUp, clearAchievements } = useGame();
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="app-layout">
      {!isHome && <Sidebar />}
      <main className="main-content" style={isHome ? { padding: 0 } : undefined}>
        <Outlet />
      </main>
      {state.levelUp && (
        <LevelUpModal
          player={state.player!}
          onClose={resetLevelUp}
        />
      )}
      {state.newAchievements.length > 0 && (
        <div className="modal-overlay" onClick={clearAchievements}>
          <div className="modal-content pixel-panel animate-pop-in" style={{ textAlign: 'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 8 }}>
              <img src="/assets/sdv/icons/ach_unlock.png" alt="" style={{ width: 56, height: 56, imageRendering: 'pixelated' }} />
            </div>
            <div className="pixel-title" style={{ color: 'var(--color-gold)', fontSize: 20 }}>成就解锁！</div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {state.newAchievements.map(ach => (
                <div key={ach.key} style={{
                  fontFamily: 'var(--font-pixel)', fontSize: 14,
                  background: 'rgba(212,160,23,0.1)', padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <img src={
                    ach.tier === '铱星' ? '/assets/sdv/icons/tier_iridium.png' :
                    ach.tier === '金星' ? '/assets/sdv/icons/tier_gold.png' :
                    '/assets/sdv/icons/tier_silver.png'
                  } alt="" style={{ width: 22, height: 22, imageRendering: 'pixelated' }} />
                  {ach.title}
                </div>
              ))}
            </div>
            <button className="pixel-btn primary" style={{ marginTop: 16 }}
              onClick={clearAchievements}>
              太棒了！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
