import { useGame } from '../../contexts/GameContext';

interface Props {
  player: NonNullable<ReturnType<typeof useGame>['state']['player']>;
  onClose: () => void;
}

export default function LevelUpModal({ player, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content pixel-panel animate-pop-in" onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <div className="pixel-title" style={{ fontSize: 20, color: 'var(--color-gold)' }}>
            LEVEL UP!
          </div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, margin: '12px 0' }}>
            {player.name} 升到了 Lv.{player.level}
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-text-light)', marginBottom: 16 }}>
            你变得更加强大了！
          </div>
          <button className="pixel-btn primary" onClick={onClose}>
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
