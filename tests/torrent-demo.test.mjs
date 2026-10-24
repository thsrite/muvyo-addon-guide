import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const code = readFileSync(new URL('../examples/torrent-demo/main.js', import.meta.url), 'utf8');
const torrent = { url: 'https://example.com/download/1', headers: { Cookie: 'example-cookie' } };
function load(data) {
  const calls = [];
  const context = { mv: {
    service: 'https://example.com/', config: {},
    fetch(req) { calls.push(req); return { status: 200, body: JSON.stringify(data) }; },
  } };
  runInNewContext(code, context);
  return { context, calls };
}
test('基础宿主接口即可搜索直接种子和待获取种子', () => {
  const { context, calls } = load({ list: [
    { id: '1', name: '示例', torrent }, { id: '2', name: '待获取', token: 'item-2' },
  ] });
  const out = JSON.parse(JSON.stringify(context.search({ keyword: '示例', link_types: ['torrent'] })));
  assert.deepEqual(out.items[0].torrent, torrent);
  assert.equal(out.items[1].resolve_token, 'item-2');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.com/search');
});
test('换取只返回下载描述且不重复请求', () => {
  const { context, calls } = load({ torrent });
  assert.deepEqual(JSON.parse(JSON.stringify(context.resolve({ token: 'item-1' }))), { torrent });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.com/resolve');
});
test('不需要种子时不请求服务', () => {
  const { context, calls } = load({ list: [] });
  assert.equal(context.search({ keyword: '示例', link_types: ['magnet'] }).items.length, 0);
  assert.equal(calls.length, 0);
});
