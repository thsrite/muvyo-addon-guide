// 搜索服务须返回资源自身核验过的 TMDB 身份；不能直接套用搜索条件里的编号。
function identity(row) {
  if (!Number.isInteger(row.tmdb_id) || row.tmdb_id < 1 || row.tmdb_id > 2000000000) return null;
  if (row.type !== 'movie' && row.type !== 'tv') return null;
  const key = { tmdb_id: row.tmdb_id, type: row.type };
  if (row.type === 'tv') {
    if (!Number.isInteger(row.season) || row.season < 0 || row.season > 1000) return null;
    key.season = row.season;
  }
  return key;
}

function toItem(row) {
  const item = {
    id: String(row.id || ''),
    title: String(row.title || ''),
    // 保留一个标签位置给媒体库状态。
    tags: (Array.isArray(row.tags) ? row.tags : [])
      .filter(tag => typeof tag === 'string' && tag !== '已入库').slice(0, 9),
  };
  if (row.link_type === 'magnet') {
    item.link_type = 'magnet';
    item.magnets = Array.isArray(row.magnets) ? row.magnets : [];
  } else {
    item.link_type = '115';
    item.share_link = row.share_link || '';
    item.share_code = row.share_code || '';
  }
  return item;
}

function search(q) {
  const keyword = String(q.keyword || '').trim();
  if (!keyword) return { items: [] };
  if (!mv.service) throw new Error('请先填写搜索服务地址');
  const res = mv.fetch({
    url: mv.service.replace(/\/+$/, '') + '/search',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: keyword, limit: 20 }),
  });
  if (res.status !== 200) throw new Error('搜索服务返回 HTTP ' + res.status);
  const data = JSON.parse(res.body);
  if (!data || !Array.isArray(data.items)) throw new Error('搜索服务应返回 items 数组');
  const limit = Number.isInteger(q.limit) ? Math.max(1, Math.min(q.limit, 20)) : 20;
  const rows = data.items.filter(row => row && typeof row === 'object').slice(0, limit);
  const items = rows.map(toItem);

  // 声明不等于授权。这里只降级运行时行为，不保证旧版能安装 manifest。
  if (typeof mv.can !== 'function' || !mv.can('library.lookup')) return { items: items };

  const targets = [];
  const positions = [];
  rows.forEach((row, index) => {
    const key = identity(row);
    if (key) { targets.push(key); positions.push(index); }
  });
  if (!targets.length) return { items: items };

  try {
    // 最多 20 部，一次批量查询；不逐条查询，不在失败时密集重试。
    const states = mv.library.lookup(targets);
    states.forEach((state, index) => {
      const position = positions[index];
      const row = rows[position];
      let inLibrary = state.exists;
      if (row.type === 'tv') {
        // Series 存在不等于本资源所含剧集已入库；只在集号明确且全部命中时标记。
        const episodes = row.episodes;
        inLibrary = inLibrary && Array.isArray(episodes) && episodes.length > 0
          && episodes.every(n => Number.isInteger(n) && n >= 0 && state.episodes.includes(n));
      }
      if (inLibrary) items[position].tags.push('已入库');
      else if (!state.complete) items[position].tags.push('入库状态未查全');
      // 即使 complete=true，也不把电视剧未命中当前集号标成整部作品未入库。
    });
  } catch (error) {
    // 授权通过也可能没配媒体库、限流或读取失败；不记录用户的查询内容。
    mv.log.warn('媒体库状态暂时无法查询，已保留搜索结果');
  }
  return { items: items };
}
