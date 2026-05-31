import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';

export default function Home() {
  const { state, createPlayer } = useGame();
  const [name, setName] = useState('');
  const navigate = useNavigate();

  async function handleCreate() {
    if (!name.trim()) return;
    await createPlayer(name.trim());
    navigate('/dashboard');
  }

  if (state.loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="pixel-panel" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🌾</div>
          <div className="pixel-title">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-bg)',
    }}>
      {/* 上半部分：图片 */}
      <div style={{
        flex: '0 0 55%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '20px 40px 0',
      }}>
        <img
          src="/assets/sdv/icons/home_bg.png"
          alt="Stardew Life RPG"
          style={{
            width: '100%',
            maxWidth: 650,
            height: 'auto',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* 下半部分：菜单 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '0 32px 24px',
      }}>
        {state.player ? (
          <>
            <div className="pixel-subtitle" style={{ fontSize: 16, color: 'var(--color-brown-dark)' }}>
              欢迎回来，{state.player.name}！
            </div>
            <div style={{
              fontFamily: 'var(--font-pixel)', fontSize: 13, color: 'var(--color-brown)',
              display: 'flex', gap: 16, alignItems: 'center',
            }}>
              <span>Lv.{state.player.level}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <img src="/assets/sdv/icons/coin.png" alt=""
                  style={{ width: 14, height: 14, imageRendering: 'pixelated' }} />
                {state.player.gold}G
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <button className="pixel-btn primary" onClick={() => navigate('/dashboard')}
                style={{ padding: '12px 32px', fontSize: 15 }}>
                进入游戏
              </button>
              <button className="pixel-btn" onClick={() => navigate('/summary')}
                style={{ padding: '12px 24px', fontSize: 14 }}>
                每日总结
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="pixel-subtitle" style={{ fontSize: 16, color: 'var(--color-brown-dark)' }}>
              将你的日常生活变成一场冒险！
            </div>
            <div style={{ width: 280 }}>
              <label htmlFor="playerName" className="pixel-label" style={{ textAlign: 'center' }}>
                输入你的名字
              </label>
              <input
                id="playerName"
                className="pixel-input"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="农场主..."
                maxLength={12}
                style={{ textAlign: 'center', fontSize: 18, padding: '10px 12px' }}
                autoFocus
              />
            </div>
            <button
              className="pixel-btn primary"
              onClick={handleCreate}
              disabled={!name.trim()}
              style={{ width: 280, padding: '12px 0', fontSize: 16 }}
            >
              开始冒险！
            </button>
            <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginTop: 4 }}>
              数据保存在本地浏览器中
            </div>
          </>
        )}
      </div>
    </div>
  );
}
