// 基础刮削示例：接口与字段仅作演示。为兼容旧版使用 HTTPS 图片，图片域名也要声明。
const API = 'https://api.example.com';

function get(path) {
  const res = mv.fetch(API + path);
  if (res.status !== 200) throw new Error('站点返回 HTTP ' + res.status);
  return JSON.parse(res.body);
}

function metadataSearch(args) {
  const query = '/search?q=' + encodeURIComponent(args.keyword) +
    (args.year ? '&year=' + args.year : '') + (args.media_type ? '&type=' + args.media_type : '');
  const data = get(query);
  return {
    items: (data.results || []).map((r) => ({
      id: String(r.id),
      title: r.title,
      original_title: r.original_title || '',
      year: Number(r.year || 0),
      media_type: r.type === 'tv' ? 'tv' : 'movie',
      overview: r.summary || '',
      poster: r.poster || '',
      rating: Number(r.rating || 0),
    })),
  };
}

function metadataDetail(args) {
  const d = get('/subject/' + encodeURIComponent(args.id));
  return {
    title: d.title,
    original_title: d.original_title || '',
    overview: d.summary || '',
    year: Number(d.year || 0),
    premiere_date: d.release_date || '',
    runtime: Number(d.runtime || 0),
    genres: d.genres || [],
    // 新版通用字段；旧服务未返回合集时保留已有归属，不自动换成空数组。
    tags: d.tags || [],
    official_rating: d.official_rating || '',
    collections: d.collections == null ? null : d.collections.map(c => ({ id: String(c.id), name: c.name })),
    rating: Number(d.rating || 0),
    vote_count: Number(d.votes || 0),
    countries: d.countries || [],
    poster: d.poster || '',
    backdrop: d.backdrop || '',
    // 可选：给「编辑图片」多几张备选
    images: { posters: d.posters || [], backdrops: d.fanarts || [] },
    people: [
      ...(d.directors || []).map((p) => ({ name: p.name, type: 'Director' })),
      ...(d.cast || []).map((p) => ({ name: p.name, role: p.character || '', type: 'Actor' })),
    ],
    external_ids: d.imdb ? { imdb_id: d.imdb } : {},
    seasons: args.media_type === 'tv' ? (d.seasons || []).map((s) => ({
      season_number: s.number,
      title: s.title || '',
      episodes: (s.episodes || []).map((e) => ({
        episode_number: e.number, title: e.title || '', overview: e.summary || '', air_date: e.date || '',
      })),
    })) : [],
  };
}
