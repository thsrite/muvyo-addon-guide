import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = readFileSync(new URL('../examples/search-demo/main.js', import.meta.url), 'utf8');
const torrent = { url: 'https://example.com/download/1.torrent', headers: { Cookie: 'example-cookie' } };

function load(response) {
  const calls = [];
  const context = { mv: {
    service: 'https://example.com', config: {}, time: { remainingMs: () => 30_000 },
    fetch(request) { calls.push(request); return { status: 200, body: JSON.stringify(response) }; },
  } };
  runInNewContext(source, context);
  return { context, calls };
}

test('种子搜索保留下载描述，不把种子当文本下载', () => {
  const { context, calls } = load({ list: [{ id: '1', name: '示例', type: 'torrent', torrent }], more: false });
  const found = context.search({ keyword: '示例', link_types: ['torrent'] });
  assert.deepEqual(JSON.parse(JSON.stringify(found.items[0].torrent)), torrent);
  assert.equal(found.items[0].link_type, 'torrent');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/search'));
});

test('按需换取种子只调用一次获取接口', () => {
  const { context, calls } = load({ torrent });
  assert.deepEqual(JSON.parse(JSON.stringify(context.resolve({ token: 'item-1' }))), { torrent });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/resolve'));
});

test('只要求磁力时不混入种子结果', () => {
  const { context } = load({ list: [{ id: '1', name: '示例', type: 'torrent', torrent }], more: false });
  assert.equal(context.search({ keyword: '示例', link_types: ['magnet'] }).items.length, 0);
});
