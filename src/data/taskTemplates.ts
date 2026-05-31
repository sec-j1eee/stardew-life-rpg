interface TemplateQuest {
  title: string;
  description: string;
  xpReward: number;
  goldReward: number;
  subtasks?: string[];
  deadline?: string;
}

interface TaskTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'survival' | 'light' | 'rest' | 'full';
  quests: TemplateQuest[];
}

export type { TemplateQuest, TaskTemplate };

export const PRESET_TEMPLATES: TaskTemplate[] = [
  {
    id: 'survival',
    name: '生存模式',
    icon: '/assets/sdv/icons/cat_habit.png',
    description: '状态最差的时候用，只做这些就已经赢了一天',
    category: 'survival',
    quests: [
      { title: '洗漱', description: '刷牙洗脸，换上干净衣服', xpReward: 20, goldReward: 4 },
      { title: '喝足水', description: '今天喝够3杯水', xpReward: 15, goldReward: 3 },
      { title: '吃一顿饭', description: '食堂吃也行，外卖也行', xpReward: 25, goldReward: 5 },
      { title: '出门一趟', description: '哪怕只是拿快递、买瓶水', xpReward: 30, goldReward: 6 },
      { title: '整理床铺', description: '把被子叠了，枕头摆好', xpReward: 15, goldReward: 3 },
    ],
  },
  {
    id: 'light_study',
    name: '轻型学习日',
    icon: '/assets/sdv/icons/cat_quest.png',
    description: '有学习意愿但专注力不够的日子',
    category: 'light',
    quests: [
      { title: '去图书馆/自习室待1小时', description: '去了就算，学多少无所谓', xpReward: 35, goldReward: 8 },
      { title: '整理一科笔记/课件', description: '梳理比新学容易起步', xpReward: 30, goldReward: 6 },
      { title: '搞定一项课后作业', description: '一份报告/几道题就行', xpReward: 35, goldReward: 8 },
      { title: '学习间隙走一圈', description: '换换脑子', xpReward: 15, goldReward: 3 },
      { title: '按时吃两顿饭', description: '规律进食', xpReward: 20, goldReward: 4 },
      { title: '写明天的待办', description: '哪怕只写3件', xpReward: 20, goldReward: 4 },
    ],
  },
  {
    id: 'recharge',
    name: '充电休息日',
    icon: '/assets/sdv/icons/tpl_rest.png',
    description: '课业缝隙里，给大脑回个血',
    category: 'rest',
    quests: [
      { title: '午休时认真躺30分钟', description: '不玩手机，就是躺着', xpReward: 25, goldReward: 5 },
      { title: '整理桌面/书包/衣柜', description: '物理空间清爽，心情会跟着好', xpReward: 20, goldReward: 5 },
      { title: '校园溜达20分钟', description: '不赶课，不听东西，纯散步', xpReward: 25, goldReward: 6 },
      { title: '洗个不赶时间的澡', description: '热水冲一冲', xpReward: 25, goldReward: 5 },
      { title: '和饭搭子吃顿慢饭', description: '不打包不赶场，坐着聊', xpReward: 25, goldReward: 5 },
      { title: '复盘本周课业安排', description: '看清接下来几天，减少焦虑', xpReward: 25, goldReward: 5 },
    ],
  },
  {
    id: 'full_power',
    name: '火力全开日',
    icon: '/assets/sdv/icons/tpl_power.png',
    description: '精力充沛，痛快推进度',
    category: 'full',
    quests: [
      { title: '图书馆/自习室待3小时', description: '实打实的深度学习', xpReward: 60, goldReward: 12 },
      { title: '完成2项作业或1份报告', description: '把ddl往前推', xpReward: 50, goldReward: 12 },
      { title: '运动30分钟', description: '晨跑/夜跑/体育课', xpReward: 40, goldReward: 10 },
      { title: '清一件拖了很久的事', description: '比如回消息、填表格、选课', xpReward: 45, goldReward: 10 },
      { title: '给自己搞顿好的', description: '食堂加个鸡腿也算', xpReward: 30, goldReward: 6 },
      { title: '打扫宿舍一角', description: '扫地/拖地/倒垃圾', xpReward: 25, goldReward: 5 },
    ],
  },
];
