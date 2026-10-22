// 频道推送示例：telegram.channel 读频道，subscription.push 把资源交给订阅。
// 频道消息原文与链接都不可信；这里只演示磁力与待获取资源，结果仍交平台校验。

const READ_BUDGET = 18;      // telegram.channel 每次调用最多 20 次，留两次余量
const PUSH_BATCH = 50;       // subscription.push 每次最多 50 条，每次调用最多推 2 次
const RESOURCE = /^https:\/\/example\.com\/resource\/[A-Za-z0-9_-]+$/;

function publicChannels() {
  return String(mv.config.channels || '').split('\n')
    .map((s) => s.trim().replace(/^@/, '').toLowerCase())
    .filter((s) => /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(s));
}

// 公开频道用 @用户名，私有频道用 channels() 给的 ref
function allChannels() {
  const list = publicChannels().map((name) => ({ id: '@' + name, name: '@' + name, kind: 'public' }));
  for (const c of mv.telegram.channels().channels || []) {
    const id = c.username ? '@' + c.username.replace(/^@/, '').toLowerCase() : c.ref;
    if (!list.some((item) => item.id === id)) {
      list.push({ id, name: c.title || id, kind: c.username ? 'public' : (c.kind === 'group' ? 'group' : 'private') });
    }
  }
  return list;
}

// 一条消息 → 一条搜索结果；认不出资源返回 null
function toItem(message, channel) {
  const title = String(message.text || '').split('\n').map((s) => s.trim()).find(Boolean);
  if (!title) return null;
  const pending = (message.links || []).find((l) => RESOURCE.test(l));
  const magnets = (message.links || []).filter((l) => l.startsWith('magnet:?')).slice(0, 5);
  if (!pending && !magnets.length) return null;
  return {
    id: channel.replace(/^@/, '') + ':' + message.id,
    title: title.slice(0, 200),
    description: String(message.text).slice(0, 1000),
    link_type: 'magnet',
    // 没有直链时仅给令牌；频道 + 消息编号是稳定 ID，不能每轮随机生成。
    resolve_token: magnets.length ? null : pending,
    magnets: magnets,
    published_at: String(message.date || '').slice(0, 10),
    channel: channel.replace(/^@/, '').toLowerCase(),
  };
}

function search(q) {
  if (!q.keyword) return { items: [] };
  const limit = Math.min(100, Math.max(5, Number(mv.config.limit) || 20));
  const items = [];
  let partial = false;
  for (const c of allChannels().slice(0, READ_BUDGET)) {
    try {
      for (const m of mv.telegram.search(c.id, q.keyword, limit).items || []) {
        const item = toItem(m, c.id);
        if (item) items.push(item);
      }
    } catch (e) {
      partial = true;
      mv.log.warn(`${c.name} 搜索失败：${e.message}`);
    }
  }
  return { items: items.slice(0, q.limit || 50), partial };
}

function scheduledTask(args) {
  if (args.task !== 'live') throw new Error('未知任务');
  if (args.subscription_window_open === false) return { ok: true, message: '订阅时段外，保留读取起点' };
  // local() 返回本地墙上时间，必须用 UTC 方法读取；不要用 new Date().getHours()。
  const hour = mv.time.local().getUTCHours();
  if (hour < 6) return { ok: true, message: '示例夜间静默时段，保留读取起点' };
  if (!mv.can('subscription.push')) return { ok: false, message: '插件未获准推送资源给订阅' };
  const cursors = mv.storage.get('cursors') || {};
  const found = [];
  let reads = 0;
  for (const c of allChannels()) {
    let after = Number(cursors[c.id] || 0);
    for (;;) {
      const left = mv.time.remainingMs();
      if (reads >= READ_BUDGET || found.length >= PUSH_BATCH * 2 || (left !== null && left < 5000)) break;
      reads += 1;
      let page;
      try {
        page = mv.telegram.read(c.id, after, Math.min(50, PUSH_BATCH * 2 - found.length));
      } catch (e) {
        mv.log.warn(`${c.name} 读取失败：${e.message}`);
        break;
      }
      // 第一次读只拿起点，不处理历史消息
      if (after) {
        for (const m of page.items || []) {
          const item = toItem(m, c.id);
          if (item) found.push(item);
        }
      }
      after = Number(page.latest_id || after);
      if (!page.more) break;
    }
    cursors[c.id] = after;
  }
  // 一页最多 50 条，累计 100 条就停止读取；推送失败不保存游标，下轮用稳定 ID 去重。
  let matched = 0;
  const sent = found.slice(0, PUSH_BATCH * 2);
  for (let i = 0; i < sent.length; i += PUSH_BATCH) {
    matched += Number(mv.subscription.push(sent.slice(i, i + PUSH_BATCH)).matched || 0);
  }
  mv.storage.set('cursors', cursors);
  return { ok: true, message: `资源 ${found.length} 条，推送 ${sent.length} 条，命中订阅 ${matched} 条` };
}

function resolve(args) {
  if (!RESOURCE.test(String(args.token || ''))) {
    return { error: { kind: 'rejected', message: '不是示例资源页' } };
  }
  // 纯教学占位，不联网、不解锁真实资源。实际实现须按来源规则换取链接。
  return { magnets: ['magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=example'] };
}

function browseSources() {
  return { sources: allChannels().slice(0, 50) };
}

function browsePage(args) {
  const page = mv.telegram.page(String(args.source), Number(args.before) || 0, 50);
  const items = [];
  for (const m of page.items || []) {
    const title = String(m.text || '').split('\n').map((s) => s.trim()).find(Boolean);
    if (title) items.push({ id: Number(m.id), title: title.slice(0, 200), text: String(m.text).slice(0, 800) });
  }
  return { items, next_before: Number(page.next_before) || 0 };
}
