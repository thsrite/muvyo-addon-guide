// 教学服务协议：所有接口与数据均为占位，须替换为自己有权使用的服务。
function hasTime(ms) {
  const left = mv.time.remainingMs();
  return left === null || left > ms;
}

function request(path, body) {
  if (!mv.service) throw new Error('请先填写搜索服务地址');
  const headers = { 'Content-Type': 'application/json' };
  if (mv.config.api_key) headers.Authorization = 'Bearer ' + mv.config.api_key;
  return mv.fetch({
    url: mv.service.replace(/\/+$/, '') + path, method: 'POST', headers,
    body: JSON.stringify(body), proxy: true, timeout: 4,
  });
}

function toItem(row) {
  const item = {
    id: String(row.id), title: String(row.name || ''),
    link_type: row.type, channel: String(row.channel || 'example'),
    description: String(row.intro || '').slice(0, 500),
    season: row.season == null ? null : row.season, episodes: row.episodes || [],
  };
  if (row.token) {
    item.resolve_token = String(row.token);
    item.cost = Number(row.cost || 0);
    item.cost_unknown = row.cost_unknown === true;
  } else if (row.type === '123pan') {
    item.rapid_links = String(row.rapid_links || '');
  } else if (row.type === 'magnet') {
    item.magnets = [row.link];
  }
  return item;
}

function search(q) {
  const completed = q.mode === 'completed';
  if (!completed && !q.tmdb_id && !String(q.keyword || '').trim()) return { items: [] };
  const targets = Array.isArray(q.link_types) ? q.link_types : ['magnet', '123pan'];
  if (!targets.some(t => t === 'magnet' || t === '123pan')) return { items: [] };
  const body = {
    keyword: q.keyword || '', tmdb_id: q.tmdb_id || 0, type: q.media_type || '',
    season: q.season, year: q.year || 0, purpose: q.purpose || 'manual',
    link_types: targets,
    // 由自建服务先筛选，再由平台按订阅规则复核；普通网页搜索不套订阅筛选。
    filters: q.purpose === 'subscription' ? (q.filters || {}) : {},
    size: Math.max(1, Math.min(Number(mv.config.size || 20), q.limit || 50)),
  };
  const items = [];
  // 示例最多两页；每页开始前留足单请求时间与交付结果的余量。
  for (let page = 1; page <= 2; page++) {
    if (!hasTime(5000)) return { items, partial: true };
    let data;
    try {
      let res = request(completed ? '/completed' : '/search', { ...body, page });
      if (res.status === 429) {
        // 仅重试只读搜索；等待计入总时限，不得用循环忙等。
        if (!hasTime(6000)) return { items, partial: true };
        mv.sleep(1000);
        res = request(completed ? '/completed' : '/search', { ...body, page });
      }
      if (res.status !== 200) return { items, partial: true };
      data = JSON.parse(res.body);
      if (!data || !Array.isArray(data.list)) return { items, partial: true };
    } catch (e) {
      return { items, partial: true };
    }
    for (const row of data.list || []) {
      if (targets.includes(row.type)) items.push(toItem(row));
      if (items.length >= body.size) return { items };
    }
    if (!data.more) return { items };
  }
  return { items, partial: true };
}

function resolve(args) {
  if (!hasTime(5000)) return { error: { kind: 'source', message: '剩余时间不足，未发起获取' } };
  try {
    // 购买请求绝不自动重试。此教学服务明确保证以下业务状态均未扣分。
    const res = request('/resolve', { token: args.token });
    if (res.status === 401 || res.status === 429) {
      return { error: { kind: 'source', message: '授权失效或限流，本次未扣分' } };
    }
    if (res.status === 404 || res.status === 402) {
      return { error: { kind: 'rejected', message: '资源失效或积分不足，本次未扣分' } };
    }
    if (res.status !== 200) return { error: { kind: 'uncertain', message: '请求已发出，可能已扣分，请核对' } };
    const data = JSON.parse(res.body);
    if (data.rapid_links) return { rapid_links: data.rapid_links };
    if (Array.isArray(data.magnets) && data.magnets.length) return { magnets: data.magnets };
    return { error: { kind: 'uncertain', message: '响应缺少链接，请核对是否已扣分' } };
  } catch (e) {
    return { error: { kind: 'uncertain', message: '请求或解析失败，可能已扣分，请核对' } };
  }
}

function accountInfo() {
  // 最小示例不联网；真实插件可查询自己的账号接口或读取自己的存储。
  return {
    items: [
      { label: '账号', value: 'example', tone: 'ok' },
      { label: '积分', value: 42, tone: 'warn' },
      { label: '授权', value: '示例未授权', tone: 'error' },
    ],
    note: '仅为示例数据，不代表真实账号状态',
  };
}
