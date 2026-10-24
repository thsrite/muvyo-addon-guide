// 只返回下载描述。mv.fetch 的 body 是文本，不能用它承接二进制种子。
function request(path, body) {
  if (!mv.service) throw new Error('请先填写搜索服务地址');
  const headers = { 'Content-Type': 'application/json' };
  if (mv.config.api_key) headers.Authorization = 'Bearer ' + mv.config.api_key;
  const response = mv.fetch({
    url: mv.service.replace(/\/+$/, '') + path,
    method: 'POST', headers, body: JSON.stringify(body),
  });
  if (response.status !== 200) throw new Error('服务请求失败');
  return JSON.parse(response.body);
}

function torrentDownload(data) {
  if (!data || !data.url) throw new Error('服务没有返回种子下载地址');
  return { url: String(data.url), headers: data.headers || {} };
}

function search(q) {
  if (!String(q.keyword || '').trim()) return { items: [] };
  if (Array.isArray(q.link_types) && !q.link_types.includes('torrent')) return { items: [] };
  const data = request('/search', { keyword: q.keyword, limit: q.limit || 20 });
  return { items: (data.list || []).map(row => {
    const item = { id: String(row.id), title: String(row.name || ''), link_type: 'torrent' };
    if (row.token) item.resolve_token = String(row.token);
    else item.torrent = torrentDownload(row.torrent);
    return item;
  }) };
}

function resolve(args) {
  // 获取只发起一次，不因超时或失败自动重复请求。
  return { torrent: torrentDownload(request('/resolve', { token: args.token }).torrent) };
}
