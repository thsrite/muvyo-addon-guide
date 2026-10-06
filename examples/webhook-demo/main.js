// Muvyo 事件示例：整理、订阅、下载等完成或失败时，Muvyo 把事件交给 webhookEvent。
// 插件拿到的是片名、文件名、季集号、数量和结果，没有文件路径、目录和网盘账号。

const NAMES = {
  'organize.completed': '整理完成', 'organize.failed': '整理失败',
  'subscription.completed': '订阅完成', 'download.completed': '下载完成', 'download.failed': '下载失败',
};

function label(d) {
  const name = d.title || d.file_name || '未知条目';
  if (d.season !== undefined && d.episode !== undefined) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${name} S${pad(d.season)}E${pad(d.episode)}`;
  }
  if (d.season !== undefined) return `${name} 第 ${d.season} 季`;
  return d.year ? `${name} (${d.year})` : name;
}

function webhookEvent(e) {
  const onlyFailed = mv.config.only_failed === true || mv.config.only_failed === 'true';
  if (onlyFailed && !e.event.endsWith('.failed')) return null;

  // 每次调用都是全新的 JS 环境：要跨事件保留的数据放 mv.storage
  const counts = mv.storage.get('counts') || {};
  counts[e.event] = (counts[e.event] || 0) + 1;
  mv.storage.set('counts', counts);

  const d = e.data;
  const keep = Math.min(100, Math.max(1, Number(mv.config.keep) || 20));
  const recent = (mv.storage.get('recent') || []).slice(-(keep - 1));
  recent.push({ event: e.event, title: label(d), tmdb: d.tmdb_id || null, status: d.status || '', time: e.time });
  mv.storage.set('recent', recent);

  const reason = d.reason ? `（${d.reason}）` : '';
  mv.log.info(`${NAMES[e.event] || e.event}：${label(d)}${reason}，累计 ${counts[e.event]} 次`);
  return null;
}
