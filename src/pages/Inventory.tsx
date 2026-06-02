import { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { db } from '../db/database';
import type { InventoryItem, Purchase, UsageLog } from '../db/models';
import { todayStr } from '../db/models';

const DEFAULT_ITEMS: Omit<InventoryItem, 'id'>[] = [
  { name: '小零食', description: '随手一包饼干/薯片/巧克力', quantity: 0, icon: '/assets/sdv/icons/cookie.png', type: 'food' },
  { name: '水果', description: '一份新鲜水果', quantity: 0, icon: '/assets/sdv/icons/fruit.png', type: 'food' },
  { name: '夜宵', description: '关东煮/烤肠/泡面，深夜暖胃', quantity: 0, icon: '/assets/sdv/icons/night_snack.png', type: 'food' },
  { name: '甜品/冰淇淋', description: '蛋糕/甜筒/冰品，甜食治愈', quantity: 0, icon: '/assets/sdv/icons/dessert.png', type: 'food' },
  { name: '大餐', description: '炸鸡/火锅/烧烤，把一顿饭升级成盛宴', quantity: 0, icon: '/assets/sdv/icons/feast.png', type: 'food' },
  { name: '自制咖啡/饮品', description: '自己动手', quantity: 0, icon: '/assets/sdv/icons/coffee.png', type: 'drink' },
  { name: '奶茶/咖啡/椰子水/果汁', description: '外卖或到店取', quantity: 0, icon: '/assets/sdv/icons/bubble_tea.png', type: 'drink' },
  { name: '摸鱼20分钟', description: '无罪恶感冲浪', quantity: 0, icon: '/assets/sdv/icons/slack.png', type: 'entertainment' },
  { name: '开黑/单机一局', description: '30分钟左右', quantity: 0, icon: '/assets/sdv/icons/gaming.png', type: 'entertainment' },
  { name: '午休延长40分钟', description: '定闹钟的回笼觉', quantity: 0, icon: '/assets/sdv/icons/pomodoro.png', type: 'rest' },
  { name: '看剧/小说30分钟', description: '沉浸式阅读', quantity: 0, icon: '/assets/sdv/icons/reading.png', type: 'entertainment' },
  { name: '明早睡懒觉', description: '某天可以晚起', quantity: 0, icon: '/assets/sdv/icons/calendar.png', type: 'rest' },
  { name: '买个小礼物', description: '书/皮肤/文具/小摆件', quantity: 0, icon: '/assets/sdv/icons/social_stat.png', type: 'entertainment' },
  { name: '整个下午摆烂', description: '4小时纯玩', quantity: 0, icon: '/assets/sdv/icons/chill.png', type: 'rest' },
  { name: '周末一日游', description: '公园/博物馆/探店', quantity: 0, icon: '/assets/sdv/icons/outing.png', type: 'rest' },
  { name: '整日自由日', description: '全天不碰任务', quantity: 0, icon: '/assets/sdv/icons/free_day.png', type: 'rest' },
];

const SHOP_SECTIONS = [
  {
    title: '饮食',
    items: [
      { name: '小零食', price: 8 },
      { name: '水果', price: 8 },
      { name: '夜宵', price: 12 },
      { name: '甜品/冰淇淋', price: 18 },
      { name: '大餐', price: 28 },
      { name: '自制咖啡/饮品', price: 6 },
      { name: '奶茶/咖啡/椰子水/果汁', price: 12 },
    ],
  },
  {
    title: '娱乐',
    items: [
      { name: '摸鱼20分钟', price: 15 },
      { name: '开黑/单机一局', price: 20 },
      { name: '午休延长40分钟', price: 20 },
      { name: '看剧/小说30分钟', price: 30 },
      { name: '明早睡懒觉', price: 40 },
      { name: '买个小礼物', price: 60 },
      { name: '整个下午摆烂', price: 70 },
      { name: '周末一日游', price: 100 },
      { name: '整日自由日', price: 120 },
    ],
  },
];

export default function Inventory() {
  const { state, addGold } = useGame();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showShop, setShowShop] = useState(false);
  const [activeItem, setActiveItem] = useState<InventoryItem | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { loadItems(); }, []);

  async function loadItems() {
    let all = await db.inventory.toArray();
    const names = new Set(all.map(i => i.name));
    const newItems = DEFAULT_ITEMS.filter(d => !names.has(d.name));
    if (newItems.length > 0) {
      await db.inventory.bulkAdd(newItems as InventoryItem[]);
    }
    all = await db.inventory.toArray();
    setItems(all);
  }

  async function buyItem(item: InventoryItem, price: number) {
    if (state.player && state.player.gold >= price) {
      await addGold(-price);
      await db.inventory.update(item.id!, { quantity: item.quantity + 1 });
      await db.purchases.add({ name: item.name, category: item.type, price, date: todayStr() });
      await loadItems();
    }
  }

  async function useItem(item: InventoryItem) {
    if (item.quantity <= 0) return;
    await db.inventory.update(item.id!, { quantity: item.quantity - 1 });
    await db.usageLogs.add({ name: item.name, date: todayStr(), time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) });
    setActiveItem(item);
    await loadItems();
  }

  const ownedItems = items.filter(item => item.quantity > 0);

  if (!state.player) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon"><img src="/assets/sdv/icons/backpack.png" alt="" style={{ width: 56, height: 56, imageRendering: 'pixelated' }} /></div>
          <div className="pixel-title">请先创建角色</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="pixel-title" style={{ marginBottom: 4 }}>背包</div>
          <div className="pixel-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <img src="/assets/sdv/icons/coin.png" alt="" style={{ width: 16, height: 16, imageRendering: 'pixelated' }} />
            {state.player.gold}G · 用金币兑换奖励
          </div>
        </div>
      </div>

      <div className="card-grid">
        {ownedItems.length === 0 ? (
          <div className="empty-state pixel-panel" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state-icon"><img src="/assets/sdv/icons/backpack.png" alt="" style={{ width: 56, height: 56, imageRendering: 'pixelated' }} /></div>
            <div className="pixel-subtitle">背包空空如也</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>去商城用金币兑换些奖励吧</div>
          </div>
        ) : ownedItems.map(item => (
          <div key={item.id} className="pixel-panel" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 8 }}>
              <img src={item.icon} alt={item.name} style={{ width: 40, height: 40, imageRendering: 'pixelated' }} />
            </div>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 13, marginBottom: 8 }}>{item.name}</div>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, color: 'var(--color-gold)', marginBottom: 8 }}>
              x{item.quantity}
            </div>
            <button className="pixel-btn small success" onClick={() => useItem(item)} disabled={item.quantity <= 0}>
              使用
            </button>
          </div>
        ))}
      </div>

      {/* 今日统计 */}
      <DailyStats />

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
        <button className="pixel-btn" onClick={() => setShowHistory(true)}>📋 记录</button>
      </div>

      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <button className="pixel-btn" onClick={() => setShowShop(true)}>商城</button>
      </div>

      {showShop && (
        <div className="modal-overlay" onClick={() => setShowShop(false)}>
          <div className="modal-content pixel-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div className="pixel-title" style={{ marginBottom: 0 }}>商城</div>
              <button className="pixel-btn small" onClick={() => setShowShop(false)}>✕</button>
            </div>
            <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <img src="/assets/sdv/icons/coin.png" alt="" style={{ width: 14, height: 14, imageRendering: 'pixelated' }} />
              当前金币：{state.player.gold}G
            </div>

            {SHOP_SECTIONS.map(section => (
              <div key={section.title} style={{ marginBottom: 16 }}>
                <div style={{
                  fontFamily: 'var(--font-pixel)', fontSize: 13, color: 'var(--color-brown-dark)',
                  marginBottom: 6, paddingBottom: 4,
                  borderBottom: '2px solid var(--color-gold)',
                }}>{section.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {section.items.map(({ name, price }) => {
                    const item = items.find(i => i.name === name);
                    if (!item) return null;
                    return (
                      <div key={name} className="pixel-border-thin"
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                          <img src={item.icon} alt={name} style={{ width: 30, height: 30, imageRendering: 'pixelated' }} />
                          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 13 }}>{name}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 10, color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <img src="/assets/sdv/icons/coin.png" alt="" style={{ width: 12, height: 12, imageRendering: 'pixelated' }} />
                            {price}G
                          </span>
                          <button className="pixel-btn small primary" onClick={() => buyItem(item, price)}
                            disabled={state.player!.gold < price} style={{ fontSize: 10, padding: '3px 10px' }}>
                            兑换
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeItem && (
        <div className="modal-overlay" onClick={() => setActiveItem(null)}>
          <div className="modal-content pixel-panel animate-pop-in" style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 12 }}>
              <img src={activeItem.icon} alt="" style={{ width: 64, height: 64, imageRendering: 'pixelated' }} />
            </div>
            <div className="pixel-title">使用了 {activeItem.name}！</div>
            <div style={{ fontSize: 14, color: 'var(--color-green)', marginBottom: 16 }}>享受你的奖励时刻！</div>
            <button className="pixel-btn primary" onClick={() => setActiveItem(null)}>好的！</button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryModal({ onClose }: { onClose: () => void }) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [usage, setUsage] = useState<UsageLog[]>([]);

  useEffect(() => {
    db.purchases.orderBy('id').reverse().limit(30).toArray().then(setPurchases);
    db.usageLogs.orderBy('id').reverse().limit(30).toArray().then(setUsage);
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content pixel-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="pixel-title" style={{ marginBottom: 0 }}>消费记录</div>
          <button className="pixel-btn small" onClick={onClose}>✕</button>
        </div>
        {purchases.length === 0 && usage.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-light)', textAlign: 'center', padding: 20 }}>
            还没有记录
          </div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {purchases.length > 0 && (
              <>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, marginBottom: 8, color: 'var(--color-brown-dark)' }}>
                  最近购买
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16 }}>
                  {purchases.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 6px', borderBottom: '1px dotted var(--color-cream-dark)' }}>
                      <span style={{ flex: 1 }}>{p.date}  {p.name}</span>
                      <span style={{ fontFamily: 'var(--font-pixel)', color: '#c0392b' }}>-{p.price}G</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {usage.length > 0 && (
              <>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, marginBottom: 8, color: 'var(--color-brown-dark)' }}>
                  最近使用
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {usage.map((u, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '3px 6px', borderBottom: '1px dotted var(--color-cream-dark)' }}>
                      {u.date} {u.time}  使用了 {u.name}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DailyStats() {
  const [spent, setSpent] = useState(0);
  const [used, setUsed] = useState(0);

  useEffect(() => {
    db.purchases.where('date').equals(todayStr()).toArray().then(ps => {
      setSpent(ps.reduce((s, p) => s + p.price, 0));
    });
    db.usageLogs.where('date').equals(todayStr()).count().then(setUsed);
  }, []);

  if (spent === 0 && used === 0) return null;

  return (
    <div className="pixel-panel" style={{ marginTop: 16 }}>
      <div className="pixel-subtitle" style={{ marginBottom: 8, fontSize: 14 }}>今日背包统计</div>
      <div style={{ display: 'flex', gap: 24, fontSize: 13, fontFamily: 'var(--font-pixel)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <img src="/assets/sdv/icons/coin.png" alt="" style={{ width: 16, height: 16, imageRendering: 'pixelated' }} />
          消费 {spent}G
        </span>
        <span>🎒 使用 {used} 次</span>
      </div>
    </div>
  );
}
