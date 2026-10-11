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

## 使用 Muvyo 的服务

在 [manifest](manifest.md#permissionsmuvyo-使用-muvyo-的服务) 的 `permissions.muvyo` 声明所需服务，管理员安装 / 更新确认后，插件可请 Muvyo 用已配置的实例执行下面三项**只读**查询。接口同步返回，不需要 `await`，也不需要插件持有这些实例的凭据。

**命名调用（`naming`）与「测试运行环境」不可用**，此时 `mv.can` 返回 `false`，直接调用服务会失败。同一插件的其它能力不受命名调用的限制。把查询放进 `search` 等入口函数，不要在顶层加载代码时执行；「测试运行环境」只检查代码载入，不能验证真实查询。

旧版 Muvyo 会拒绝安装声明了 `permissions.muvyo` 的插件，不要把运行时降级当成旧版安装兼容方案。

### mv.can(name)

```js
if (mv.can('library.lookup')) {
  const state = mv.library.lookup({ tmdb_id: 157336, type: 'movie' });
  // 根据 state.exists 标记结果
}
```

返回布尔值，表示本次调用是否获准使用指定服务；未授权或未知名称返回 `false`。它不检查用户是否已配好实例，也不保证查询成功。没有授权直接调用会抛异常；即使返回 `true`，也应处理实例缺失、限流和读取失败。

三个接口均严格检查参数：不接受额外字段，不把数字字符串自动转成数字。尤其 `tmdb_id` 必须是数字整数，`'1399'` 会被拒绝；`season`、`limit` 同样要用数字整数。

### mv.library.lookup(itemOrItems)

按 TMDB 身份查询已配置、可查询的媒体库，合并 Emby、Jellyfin、Plex 与 Vyo 的结果。

| 参数 | 说明 |
|---|---|
| `tmdb_id` | 必填整数，1–2000000000 |
| `type` | 必填，`movie` / `tv` |
| `season` | 可省略或 `null`；整数 0–1000，0 为特别篇。电影查询忽略季号 |

可以传单个对象，也可以传 1–20 个对象组成的数组；返回形状与输入一致，数组按输入顺序返回。

```js
const movie = mv.library.lookup({ tmdb_id: 157336, type: 'movie' });
// { tmdb_id: 157336, type: 'movie', exists: true, complete: true }
const shows = mv.library.lookup([{ tmdb_id: 1399, type: 'tv', season: 1 }]);
// [{ tmdb_id: 1399, type: 'tv', exists: true, complete: true,
//    season: 1, episodes: [1, 2] }]
// 上面仅示意返回结构，实际内容取决于用户的媒体库。
```

- `exists`：是否找到这部作品。**电视剧找到 Series 即可为 `true`，不保证指定季已有集数，更不表示全季齐全。** 查询某季要结合 `episodes` 判断。
- `complete`：查询是否完整；有媒体服务器未答上来时为 `false`，不是「全集已入库」。`exists: false, complete: false` 不能解释为确定未入库。
- 只有 `type: 'tv'` 且提供非空 `season` 时才返回 `season`、`episodes`；集号合并去重、升序，最多 5000 个，非负整数。电影或未指定季的电视剧没有这两个字段。
- 没有可查询的媒体库时抛异常；部分服务器失败可能返回 `complete: false`，应保留已获得的信息并提示查询不完整。

### mv.telegram.search({keyword, limit})

搜索用户在 Muvyo 中启用并配置的公开 / 私有 Telegram 频道。只搜频道，不发消息、不读私聊、不加群，也不调用搜索机器人。

| 参数 | 说明 |
|---|---|
| `keyword` | 必填字符串，1–100 字符，去首尾空白后不能为空 |
| `limit` | 可省略，默认 20；整数 1–50，是传给各频道搜索的条数限制，不是最终合并结果上限 |

```js
const result = mv.telegram.search({ keyword: '示例作品', limit: 20 });
// { items: [{ channel, date, title, text, share_link?, pan_type?,
//             share_code?, magnets? }], failed }
// 问号表示该字段可能不存在。
```

| 返回字段 | 说明 |
|---|---|
| `items` | 按日期字符串降序合并，最多 100 条；没有合规分享链接或磁力的消息不返回 |
| `channel` / `date` | 频道显示名（最多 60 字符）/ 日期文字（最多 40 字符） |
| `title` / `text` | 标题（最多 200 字符）/ 正文（最多 800 字符），去标签和控制字符后截短 |
| `share_link` / `pan_type` / `share_code` | 有合规分享链接时提供：链接、网盘类型、提取码 |
| `magnets` | 有合规 BTIH 磁力时提供，最多 3 条，每条最多 1024 字符 |
| `failed` | 搜索失败计数；异常批次或带错误的结果会增加计数，不能当作精确的逐频道状态表 |

不提供私有频道编号或消息地址。没有可搜索频道时抛异常；频道搜索失败可能返回 `failed > 0`（甚至空 `items`），不要把这种结果当成确定没有资源。

### mv.share.inspect({url, code})

请 Muvyo 选择同一家、启用且能读取分享的网盘账号，读取分享根目录第一页，**不转存**。链接被识别不代表该安装一定有能读取它的账号。

| 参数 | 说明 |
|---|---|
| `url` | 必填字符串，8–1000 字符，必须是 Muvyo 支持的网盘分享链接 |
| `code` | 可省略，默认空串；字符串，最多 16 字符。使用规整后的提取码，未提供可用值时尝试链接里的 `password` / `pwd` |

```js
const result = mv.share.inspect({ url: 'https://115.com/s/xxxx', code: 'ab12' });
// 链接仅作格式示意，不是真实分享。
// 成功：{ valid: true, drive, title, total, files: [{ name, size, dir }] }
// 明确无效：{ valid: false, drive, reason }
```

- `drive` 是网盘类型，不是用户实例标识。
- `title` 为分享标题，最多 200 字符。`files` 最多 100 条，只含根目录第一页，不递归、不提供分页入口。
- `name` 为清理后的名称，最多 200 字符；`size` 为字节数，目录或无法取得大小时为 0；`dir` 为是否目录。不含文件编号或路径。
- `total` 优先使用上游返回的非负整数总数，取不到时为本次返回的文件条目数；不能保证是整个分享的递归文件总数。
- 只有明确判断分享失效或提取码不对时，才返回 `valid: false`，`reason` 分别为「分享已失效」或「提取码不对」；该结构没有 `title`、`total`、`files`。
- **读取失败抛异常，不等于 `valid: false`**。断网、限流、登录失效、无匹配账号、未知错误等应显示「暂时无法检查」或保留原结果，不要删除资源或标记为失效。

### 用量、缓存与失败处理

「单次调用」指 Muvyo 执行一次 `search` 等插件入口函数；三个服务分别计数。每分钟用量按滚动 60 秒计算，全部插件共享合计上限。

| 服务 | 单次插件调用最多请求 | 每插件每分钟 | 全部插件合计每分钟 | 全局同时处理 | 单次服务处理时限 |
|---|---|---|---|---|---|
| `library.lookup` | 5 次，每次最多 20 部 | 200 部 | 600 部 | 2 个 | 20 秒 |
| `telegram.search` | 2 次 | 6 次 | 6 次 | 1 个 | 30 秒 |
| `share.inspect` | 5 次 | 12 次 | 12 次 | 2 个 | 20 秒 |

查媒体库的分钟用量按传入部数计，不按批次数计；重复条目也占用量。**命中缓存仍计入请求和分钟用量**。无效参数也会消耗单次调用的请求次数；已经计费的请求即使后续失败也不退还用量。

各服务的全局并发独立限制，排队最多 10 秒；处理超时、排队超时或达到用量上限会抛异常。插件整体执行时限仍适用，不会因调用服务而延长。

| 服务 | 短时缓存 |
|---|---|
| 媒体库 | 相同作品、类型、季号的完整查询缓存 60 秒；`complete: false` 不缓存 |
| Telegram | 相同关键词（忽略大小写）、`limit` 和频道配置的结果缓存 120 秒；`failed > 0` 不缓存 |
| 分享 | 相同链接与提取码：有效结果 600 秒，明确无效结果 60 秒；读取失败不缓存 |

缓存由 Muvyo 在进程内管理，不是插件的 `mv.storage`；结果可能短暂滞后。用 `try/catch` 为辅助查询降级，不要在同一次调用里密集重试，也不要把查询结果或上游凭据写进日志。完整用法见 [已入库标记搜索示例](../examples/library-badge-demo/)。

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
