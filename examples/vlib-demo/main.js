// 虚拟库片单示例：只需要给出 TMDB 编号（或片名 + 年份），片名、海报、评分由 Muvyo 从 TMDB 获取。
const CLASSIC = [27205, 157336, 603, 78];   // 盗梦空间、星际穿越、黑客帝国、银翼杀手

const MIXED = [
  { tmdb_id: 155, media_type: 'movie' },      // 蝙蝠侠：黑暗骑士
  { tmdb_id: 1396, media_type: 'tv' },        // 绝命毒师
  { title: '三体', year: 2023, media_type: 'tv' },   // 没有编号时按片名 + 年份匹配
];

function vlibItems(args) {
  if (args.list === 'classic') {
    return { items: CLASSIC.map((id) => ({ tmdb_id: id, media_type: 'movie' })) };
  }
  if (args.list === 'mixed') {
    const kind = (args.params && args.params.kind) || 'all';
    return { items: MIXED.filter((item) => kind === 'all' || item.media_type === kind) };
  }
  throw new Error('没有这个片单：' + args.list);
}
