export interface LimitedQuestDef {
  title: string;
  description: string;
  category: 'study' | 'life' | 'social' | 'random';
  xpReward: number;
  goldReward: number;
  condition?: string; // e.g. 'rain', 'sunny', 'any'
}

export const LIMITED_QUEST_POOL: LimitedQuestDef[] = [
  // 学习类
  { title: '专注挑战', description: '完成3个番茄钟', category: 'study', xpReward: 60, goldReward: 12 },
  { title: '笔记整理', description: '整理一科的笔记或课件', category: 'study', xpReward: 40, goldReward: 8 },
  { title: '攻克难点', description: '搞懂一个一直没弄明白的知识点', category: 'study', xpReward: 50, goldReward: 10 },
  { title: '提前预习', description: '预习明天的一节课内容', category: 'study', xpReward: 40, goldReward: 8 },
  // 生活类
  { title: '断舍离', description: '扔掉/处理掉一件不再需要的东西', category: 'life', xpReward: 30, goldReward: 6 },
  { title: '换洗床单', description: '把床单被套换洗了', category: 'life', xpReward: 40, goldReward: 8 },
  { title: '照料植物', description: '浇水/修剪，没有植物就整理书架', category: 'life', xpReward: 20, goldReward: 4 },
  { title: '护肤全套', description: '认真做一次完整护肤流程', category: 'life', xpReward: 25, goldReward: 5 },
  // 社交类
  { title: '主动联系', description: '给一个很久没联系的朋友发消息', category: 'social', xpReward: 35, goldReward: 7 },
  { title: '打个电话', description: '给家人或朋友打一个电话', category: 'social', xpReward: 40, goldReward: 8 },
  { title: '约人出门', description: '约一个人一起吃饭/散步/自习', category: 'social', xpReward: 45, goldReward: 10 },
  // 随机事件类
  { title: '雨天限定', description: '下雨了？窝在宿舍看一部电影', category: 'random', xpReward: 30, goldReward: 8, condition: 'rain' },
  { title: '晴天限定', description: '今天阳光很好，出门晒太阳20分钟', category: 'random', xpReward: 30, goldReward: 8, condition: 'sunny' },
  { title: '幸运日', description: '今天写日记就行，额外加送金币', category: 'random', xpReward: 20, goldReward: 15 },
  { title: '随机掉落', description: '完成今天任意模板即可额外领取', category: 'random', xpReward: 0, goldReward: 10 },
];

export function pickDailyQuests(count: number = 3): LimitedQuestDef[] {
  const shuffled = [...LIMITED_QUEST_POOL].sort(() => Math.random() - 0.5);
  const result: LimitedQuestDef[] = [];
  const cats = new Set<string>();

  // 先保证每个类别至少一个
  for (const q of shuffled) {
    if (q.condition === 'rain' || q.condition === 'sunny') continue; // 天气相关跳过
    if (!cats.has(q.category)) {
      cats.add(q.category);
      result.push(q);
    }
    if (result.length >= count) break;
  }

  // 不够的话随机补
  if (result.length < count) {
    for (const q of shuffled) {
      if (q.condition === 'rain' || q.condition === 'sunny') continue;
      if (!result.includes(q)) {
        result.push(q);
      }
      if (result.length >= count) break;
    }
  }

  // 概率加天气限定
  const r = Math.random();
  if (r < 0.3) {
    const weatherQuest = shuffled.find(q => q.condition === 'rain');
    if (weatherQuest) result.push(weatherQuest);
  } else if (r < 0.6) {
    const weatherQuest = shuffled.find(q => q.condition === 'sunny');
    if (weatherQuest) result.push(weatherQuest);
  }

  return result;
}
