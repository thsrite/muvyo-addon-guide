// 内容源示例：服务的接口与字段仅作演示，按你的服务修改。
// 视频和封面由 Muvyo 代为请求，地址必须在服务地址或 permissions.domains 范围内。

function api(path) {
  if (!mv.service) throw new Error('请先在插件设置里填写内容服务地址');
  const headers = mv.config.api_key ? { 'X-Api-Key': mv.config.api_key } : {};
  const res = mv.fetch({ url: mv.service.replace(/\/+$/, '') + path, headers: headers });
  if (res.status !== 200) throw new Error('内容服务返回 HTTP ' + res.status);
  return JSON.parse(res.body);
}

function toShow(row) {
  return {
    id: String(row.id),
    title: row.title,
    poster: row.cover,
    description: row.intro || '',
    episode_count: Number(row.episodes || 0),
    remark: row.badge || '',
    tags: row.tags || [],
    rating: Number(row.score || 0),
  };
}

function contentCategories() {
  const data = api('/api/categories');
  return { categories: (data.list || []).map((c) => ({ id: String(c.id), title: c.name })) };
}

function contentList(args) {
  const data = api('/api/shows?category=' + encodeURIComponent(args.category || '') + '&page=' + args.page);
  return { items: (data.list || []).map(toShow), total: data.total, page_count: data.pages };
}

function contentSearch(args) {
  const data = api('/api/search?q=' + encodeURIComponent(args.keyword) + '&page=' + args.page);
  return { items: (data.list || []).map(toShow), total: data.total };
}

function contentDetail(args) {
  const row = api('/api/shows/' + encodeURIComponent(args.id));
  return {
    ...toShow(row),
    status: row.finished ? '已完结' : '连载中',
    people: (row.actors || []).map((a) => ({ name: a.name, role: a.role || '', avatar: a.avatar || '' })),
    episodes: (row.episode_list || []).map((e, i) => ({ index: i + 1, title: e.title || '第 ' + (i + 1) + ' 集', duration: Number(e.seconds || 0) })),
  };
}

function contentPlay(args) {
  const data = api('/api/shows/' + encodeURIComponent(args.id) + '/play?episode=' + args.episode);
  return {
    url: data.url,
    media: { container: 'mp4', video: { codec: 'h264' }, audio: { codec: 'aac', channels: 2 } },
  };
}
