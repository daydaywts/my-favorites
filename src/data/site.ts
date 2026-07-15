export const site = {
  title: '天天的收藏',
  subtitle: '一个很怪的人',
  avatar: 'images/profile/avatar.webp', // 例如：'images/profile/avatar.webp'
  owner: '天天',
  bio: '理想生活大概就是在世界各地逛游戏展、成人展，通关通关喜欢的游戏，在园子温、驾笼真太郎、贺氏Y太的世界里遨游，听着东方爵士，顺便持续探索人类关于欲望、身体、影像的一切表达。',
  showQuote: true, // 改成 false 即可隐藏左下角的引语文本框
  quote: '记录一切，展示一切',
  //quoteDate: '2026.07.13',
  updatedAt: '2026/7/14 更新', // 左侧日夜模式开关右侧的更新时间
  footer: '© 2026 天天 · All rights reserved.',
};

// 分类页、文章页和标签页标题下方的说明文字都在这里修改。
export const pageDescriptions = {
  movies: '怎么这么多二次元啊',
  manga: '在一格格画面里，遇见另一种人生的可能。',
  games: '在虚拟的世界里，体验另一种真实的生命。',
  notes: '记录作品之外，关于观看、阅读、游玩与收藏的一些想法。',
  tags: '选择一个或多个标签筛选作品；标签可以随时增加、修改或删除。',
};

export const nav = [
  { href: './', label: '首页', key: 'home' },
  { href: 'movies', label: '影视', key: 'movie' },
  { href: 'manga', label: '漫画', key: 'manga' },
  { href: 'games', label: '游戏', key: 'game' },
  { href: 'notes', label: '文章', key: 'notes' },
  { href: 'about', label: '关于我', key: 'about' },
];
