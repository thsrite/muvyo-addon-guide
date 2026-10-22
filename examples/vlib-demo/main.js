// 全为教学占位片名，不指向真实作品；实际使用请换成有权展示的作品身份。
const CLASSIC = [{ title: '示例电影', year: 2026, media_type: 'movie' }];
const MIXED = [...CLASSIC, { title: '示例剧', year: 2026, media_type: 'tv' }];

function vlibItems(args) {
  if (args.list === 'classic') return { items: CLASSIC };
  if (args.list === 'mixed') {
    const kind = (args.params && args.params.kind) || 'all';
    return { items: MIXED.filter(item => kind === 'all' || item.media_type === kind) };
  }
  throw new Error('没有这个片单');
}
