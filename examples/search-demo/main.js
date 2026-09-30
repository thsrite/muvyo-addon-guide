// 资源搜索示例：对接你自己部署的搜索服务。接口与字段仅作演示，按你的服务修改。
// 只对接你有权使用的内容来源，见 docs/policy.md。

function request(path, body) {
  if (!mv.service) throw new Error('请先在插件设置里填写搜索服务地址');
  const headers = { 'Content-Type': 'application/json' };
  if (mv.config.api_key) headers['Authorization'] = 'Bearer ' + mv.config.api_key;
  const res = mv.fetch({
    url: mv.service.replace(/\/+$/, '') + path,
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error('服务密钥无效，请在插件设置里重新填写');
  if (res.status !== 200) throw new Error('搜索服务返回 HTTP ' + res.status);
  return JSON.parse(res.body);
}

function toItem(row) {
  const item = {
    id: String(row.id),
    title: String(row.name || ''),
    description: String(row.intro || '').slice(0, 500),
    size_bytes: Number(row.size || 0),
    tags: (row.tags || []).slice(0, 10),
    published_at: row.created_at || '',
  };
  if (row.type === 'magnet') {
    item.link_type = 'magnet';
    item.magnets = [row.link];
  } else {
    item.link_type = '115';
    item.share_link = row.link;
    item.share_code = row.code || '';
  }
  return item;
}

function search(q) {
  const size = Math.max(1, Math.min(Number(mv.config.size || 20), q.limit || 50));
  const body = q.tmdb_id
    ? { tmdb_id: q.tmdb_id, type: q.media_type, season: q.season, size: size }
    : { keyword: q.keyword, year: q.year || undefined, size: size };
  if (!body.tmdb_id && !String(q.keyword || '').trim()) return { items: [] };
  const data = request('/search', body);
  return { items: (data.list || []).map(toItem) };
}
