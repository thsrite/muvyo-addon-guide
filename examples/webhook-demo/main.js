// Webhook 事件示例：媒体服务器（Emby / Jellyfin / Plex）发到 Muvyo 的事件统一成固定事件名后交给 webhookEvent。
// 插件拿到的是片名、季集号、用户名和设备名，没有文件路径、来源 IP 和原始报文。

function label(item) {
  const name = item.series_name || item.name || '未知条目';
  if (item.season !== null && item.episode !== null) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${name} S${pad(item.season)}E${pad(item.episode)}`;
  }
  return item.year ? `${name} (${item.year})` : name;
}

function webhookEvent(e) {
  if (e.event === 'system.notificationtest') {
    mv.log.info(`收到 ${e.server || e.source} 的测试通知`);
    return null;
  }
  const onlyFinished = mv.config.only_finished === true || mv.config.only_finished === 'true';
  if (onlyFinished && e.event === 'playback.stop') return null;

  // 每次调用都是全新的 JS 环境：要跨事件保留的数据放 mv.storage
  const counts = mv.storage.get('counts') || {};
  counts[e.event] = (counts[e.event] || 0) + 1;
  mv.storage.set('counts', counts);

  const keep = Math.min(100, Math.max(1, Number(mv.config.keep) || 20));
  const recent = (mv.storage.get('recent') || []).slice(-(keep - 1));
  recent.push({
    event: e.event, title: label(e.item), user: e.user, device: e.device,
    tmdb: e.item.provider_ids.tmdb || '', time: e.time,
  });
  mv.storage.set('recent', recent);

  const who = e.user ? `${e.user}${e.device ? '（' + e.device + '）' : ''}` : '媒体服务器';
  const what = { 'library.new': '新入库', 'playback.stop': '停止播放', 'item.markplayed': '标为已看' }[e.event];
  mv.log.info(`${who} ${what}：${label(e.item)}，累计 ${counts[e.event]} 次`);
  return null;
}
