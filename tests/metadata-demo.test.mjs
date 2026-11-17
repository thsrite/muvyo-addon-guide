import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const base = readFileSync(new URL('../examples/metadata-demo/main.js', import.meta.url), 'utf8');
const extensions = readFileSync(new URL('../examples/metadata-demo/extensions.js', import.meta.url), 'utf8');
function load(data) {
  const calls = [];
  const context = { mv: { config: { token: 'test-secret' }, fetch(url) {
    calls.push(url);
    return { status: 200, body: JSON.stringify(data) };
  } } };
  runInNewContext(base + '\n' + extensions, context);
  return { context, calls };
}
const plain = (value) => JSON.parse(JSON.stringify(value));

test('识别保留服务明确结果与文件名参数', () => {
  const { context, calls } = load({ status: 'matched', id: 'work:7', media_type: 'movie' });
  const args = { title: '作品', year: 2025, media_type: 'movie', filenames: ['编号 7.mkv'] };
  assert.deepEqual(plain(context.metadataIdentify(args)), { status: 'matched', id: 'work:7', media_type: 'movie' });
  assert.deepEqual(JSON.parse(new URL(calls[0]).searchParams.get('filenames')), args.filenames);
});

test('不确定结果不选首条，错误类型不接受', () => {
  for (const status of ['unmatched', 'ambiguous']) {
    const { context } = load({ status, items: [{ id: 'first' }] });
    assert.deepEqual(plain(context.metadataIdentify({ title: '作品', year: 0, media_type: 'tv' })), { status });
  }
  const { context } = load({ status: 'matched', id: 'wrong', media_type: 'movie' });
  assert.throws(() => context.metadataIdentify({ title: '作品', year: 0, media_type: 'tv' }));
});

test('人物搜索与详情保留来源编号和简介', () => {
  const p = { id: 'person:7', name: '人物甲', image: 'https://img.example.com/7.jpg', biography: '简介' };
  assert.deepEqual(plain(load({ items: [p] }).context.metadataPeopleSearch({ keyword: '人物甲' })), { items: [p] });
  const { context, calls } = load({ ...p, aliases: ['别名'], birthplace: '出生地' });
  const detail = context.metadataPersonDetail({ id: p.id });
  assert.equal(detail.id, p.id);
  assert.equal(detail.biography, p.biography);
  assert.equal(detail.birthplace, '出生地');
  assert.equal(calls[0], 'https://api.example.com/people/person%3A7');
});

test('图片令牌只发送到指定来源，不混入详情', () => {
  const { context } = load({ title: '作品', cast: [] });
  assert.equal(context.metadataImageRequest({ url: 'https://img.example.com/7.jpg' }).headers.Authorization, 'Bearer test-secret');
  for (const url of ['https://img.example.com.evil.org/7.jpg', 'https://img.example.com@evil.org/7.jpg', 'http://img.example.com/7.jpg']) {
    assert.deepEqual(plain(context.metadataImageRequest({ url }).headers), {});
  }
  assert.ok(!JSON.stringify(context.metadataDetail({ id: 'work:7', media_type: 'movie' })).includes('test-secret'));
});
