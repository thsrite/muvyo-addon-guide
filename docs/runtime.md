# 运行环境

插件代码运行在 Muvyo 的 QuickJS 沙箱里：标准 JavaScript（ES2020），**没有** Node.js、浏览器 API、`require`/`import`、`setTimeout`、`fetch`。全部外部能力都在全局对象 `mv` 上。

Muvyo 按能力调用你在入口文件里定义的**全局函数**（例如 `search`、`vlibItems`），传入一个参数对象，把返回值作为结果。函数可以是普通函数，也可以是 `async` 函数；抛出异常即表示这次调用失败，异常信息会显示给管理员。

```js
function search(q) {
  const res = mv.fetch('https://api.example.com/search?q=' + encodeURIComponent(q.keyword));
  if (res.status !== 200) throw new Error('接口返回 HTTP ' + res.status);
  return { items: JSON.parse(res.body).list.map(toItem) };
}
```

## mv.fetch(request)

发起 HTTP 请求，**同步返回**结果（不需要 await）。

```js
const res = mv.fetch({
  url: 'https://api.example.com/search',
  method: 'POST',                // GET（默认）、POST、HEAD
  headers: { 'Content-Type': 'application/json', 'Referer': 'https://example.com/' },
  body: JSON.stringify({ q: 'xx' })   // 字符串，≤ 1 MB
});
// 也可以直接传地址：mv.fetch('https://api.example.com/x')

res.status   // 数字
res.headers  // 对象，头名一律小写
res.body     // 字符串（按 UTF-8 解码），≤ 4 MB
res.url      // 跟随跳转后的最终地址
```

- 只能访问 manifest `permissions.domains` 里、且管理员确认过的地址，以及用户填写的服务地址（`permissions.service`）；否则抛出「插件未获准访问 …」。
- 最多跟随 3 次跳转，每一跳都重新检查权限。
- 单个请求 20 秒超时；**一次调用最多 30 个请求**。
- 没设置 `User-Agent` 时默认带 `Muvyo-Addon/1`；`Host`、`Content-Length`、`Connection` 等请求头会被去掉。
- 网络失败、超时、不允许的地址都会抛异常，需要容错就 `try/catch`。

## mv.config

用户在设置页填写的配置，只读。值类型见 [manifest.md](manifest.md#config-配置项)。

```js
const size = Math.min(Number(mv.config.size || 20), 50);
const token = mv.config.token || '';
```

## mv.service

用户填写的服务地址（只有声明了 `permissions.service` 才有），字符串，没填为空串。

```js
const base = mv.service.replace(/\/+$/, '');
const res = mv.fetch(base + '/api/list?page=1');
```

## mv.storage

插件自己的小型持久存储，跨调用保留，适合缓存登录令牌、上次刷新时间等。

```js
mv.storage.get('token')          // 没有返回 null
mv.storage.set('token', 'abc')   // 值可以是任何能 JSON 序列化的数据
mv.storage.remove('token')
```

- 整体 ≤ 64 KB（JSON 序列化后），超过则本次调用失败。
- 只有调用**成功结束**时才保存本次的修改。

## mv.log

写进 Muvyo 日志，管理员可在插件日志里看到。

```js
mv.log.info('刷新成功');
mv.log.warn('第 2 页没有数据');
mv.log.error('登录失败');
```

每条最多 500 字；一次调用最多 200 条（只记前 50 条），超过会终止调用。不要把令牌、密码写进日志。

## mv.crypto

常用的哈希与编码（字符串按 UTF-8 处理，哈希结果为十六进制小写）。

```js
mv.crypto.sha256('text')
mv.crypto.md5('text')
mv.crypto.hmacSha256('key', 'text')
mv.crypto.base64Encode('text')
mv.crypto.base64Decode('dGV4dA==')
mv.crypto.randomHex(16)   // 16 字节随机数 → 32 个十六进制字符，n 取 1–256
```

## 限制

| 项目 | 限制 |
|---|---|
| 单次调用时长 | 默认 60 秒（插件设置里「单次执行时限」可调成 5–300 秒），超时终止 |
| 内存 | 64 MB |
| 网络请求 | 每次调用 30 个，每个 20 秒，响应 ≤ 4 MB |
| 存储 | 64 KB |
| 代码 | 入口文件 ≤ 1 MB，只能有一个 JS 文件 |

每次调用都在全新的 JS 环境里执行：全局变量**不会**在两次调用之间保留，需要保留的数据放 `mv.storage`。

同一个插件同一时间只执行一个调用，其余排队；函数要尽快返回，别在一次调用里做太多请求。

插件停用、没有有效 Muvyo 授权、或插件被官方停用时不会被调用。
