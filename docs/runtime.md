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
  body: JSON.stringify({ q: 'xx' }),  // 字符串，≤ 1 MB
  binary: false,                      // true：正文按二进制取回，见下方 body_base64
  follow_redirects: true,             // false：不跟随跳转，直接拿到 3xx 响应（登录接口常把 Cookie 设在 302 上）
  timeout: 6,                         // 可选：这个请求（含跳转、读完正文）最多等几秒，只能比默认的 20 秒短
  proxy: true                         // 可选：经用户在 Muvyo 填的系统代理发出（没填就直连），见下方说明
});
// 也可以直接传地址：mv.fetch('https://api.example.com/x')

res.status       // 数字
res.headers      // 对象，头名一律小写；同名响应头只留最后一条
res.set_cookies  // 全部 Set-Cookie 响应头的数组（最多 50 条），登录态从这里取
res.body         // 字符串（按 UTF-8 解码），≤ 4 MB；binary 为 true 时是空串
res.body_base64  // 仅 binary 为 true 时有：正文的 base64，验证码图片等二进制内容用它
res.url          // 跟随跳转后的最终地址
res.proxied      // 这次实际是否经了系统代理
```

- 只能访问 manifest `permissions.domains` 里、且管理员确认过的地址，以及用户填写的服务地址（`permissions.service`）；否则抛出「插件未获准访问 …」。
- 最多跟随 3 次跳转，每一跳都重新检查权限。
- **跳到别的网站**（协议、域名或端口变了）时只带通用请求头：`Accept`、`Accept-Language`、`Accept-Encoding`、`User-Agent`、`Content-Type`。`Cookie`、`Authorization` 和你自定义的头（`X-Api-Key`、`Token` 等）都不会带过去，需要的话在最终地址上重新请求。带着请求正文的跳转（307 / 308）只能留在同一个网站，跳到别的网站直接失败，避免把登录用的账号密码发给跳转目标。
- 响应是 `gzip` / `deflate` 压缩的会自动解压，`res.body` 就是解压后的内容（`content-encoding` 头随之去掉）；解压后同样 ≤ 4 MB。
- `proxy: true`：用户在 Muvyo 填了系统代理时经它发出，没填就直连。只对已获准的域名生效；经代理时拒绝内网、本机与 IP 字面量，全部 A/AAAA 解析结果只要有一个非公网地址就拒绝，包括内嵌内网 IPv4 的 IPv6、站点本地与保留段。加密 DNS 不可达时回退系统解析，全部地址接受同样校验。代理连接固定到已校验的 IP，保留原域名的 Host、SNI 和证书校验，跳转同样逐跳校验。连接失败时在统一时限内尝试下一个候选；请求已发送后的读取、写入或协议失败不重试。代理必须支持固定公网 IP（HTTPS 需支持 CONNECT IP），不支持会明确报错，不会退回代理按域名解析。通常被墙的公开站点（例如 Telegram 网页版）用它；服务地址在内网时不要用。
- 单个请求默认 20 秒超时，可用 `timeout` 设得更短（不能更长）；**一次调用最多 30 个请求**；另有每分钟上限：每个插件 300 个请求、64 MB 流量（全部插件合计 1200 个、256 MB），超出时抛出「插件联网太频繁」，下一分钟恢复。
- 没设置 `User-Agent` 时默认带 `Muvyo-Addon/1`；`Host`、`Content-Length`、`Connection` 等请求头会被去掉。
- 网络失败、超时、不允许的地址都会抛异常，需要容错就 `try/catch`。

### mv.fetchAll(requests)

一组请求由 Muvyo 同时发出，适合同时读多个频道、多个分页（Muvyo 3.13.2 起，`min_mv_version` 写 `3.13.2`，或先判断 `typeof mv.fetchAll === 'function'`，没有时逐个 `mv.fetch`）：

```js
const pages = mv.fetchAll([
  { url: 'https://t.me/s/channel_a?q=' + encodeURIComponent(q.keyword), timeout: 20, proxy: true },
  { url: 'https://t.me/s/channel_b?q=' + encodeURIComponent(q.keyword), timeout: 20, proxy: true },
]);
for (const res of pages) {
  if (res.error) continue;        // 这一个失败：{ error: '原因' }，其它照常返回
  // res 与 mv.fetch 的返回值相同：status、headers、body、url…
}
```

- 每项的写法与 `mv.fetch` 相同（也可以直接传地址字符串），按传入顺序返回；一批 1–8 个，最多 4 个同时进行。
- 某一项失败（超时、不允许的地址、网络错误）只在那一项返回 `{ error }`，不会整批抛错；传的不是数组、或超过 8 个时整次调用抛错。
- 每个请求照样计入「一次调用最多 30 个请求」和每分钟用量，校验、代理、跳转规则与 `mv.fetch` 完全一样；整批响应正文合计不超过 6 MB，超出的项按失败返回。

## 使用 Muvyo 的服务

在 [manifest](manifest.md#permissionsmuvyo-使用-muvyo-的服务) 的 `permissions.muvyo` 声明所需服务，管理员安装 / 更新确认后，插件可请 Muvyo 用已配置的实例办下面这些事。接口同步返回，不需要 `await`，也不需要插件持有这些实例的凭据。

除 `subscription.push`（把资源交给订阅）和两项 Telegram 发消息的服务（`telegram.bot`、`telegram.botsearch` 的 `query` 方式）外，其余都是只读查询。

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

各接口均严格检查参数：不接受额外字段，不把数字字符串自动转成数字。尤其 `tmdb_id` 必须是数字整数，`'1399'` 会被拒绝；`season`、`limit` 同样要用数字整数。

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

### 读取 Telegram 频道（telegram.channel）

用用户在 Muvyo「Telegram 账号」里登录的个人账号读取频道和群组。四个方法都属于 `telegram.channel` 这一项服务。

- **公开**频道、公开超级群：直接写用户名（`@example`、`example` 或 `https://t.me/example`），不要求账号已加入。
- **私有**频道、私有群组：只能读管理员在插件设置「可读取的频道和群组」里勾选给这个插件的；用 `channels()` 返回的 `ref` 指代，插件拿不到真实编号和消息地址。
- 不给发送人，不开放私聊、联系人和成员列表。
- 消息原文去掉控制字符后最多 4000 字；`links` 合并文字链接、按钮链接和正文里的 `http(s)://`、`magnet:?`、`ed2k://`，最多 20 条、每条 ≤ 2000 字符，**不做网盘白名单校验**，要交给 Muvyo 的资源仍按搜索结果的规则校验。
- 只返回有文字或按钮的消息。

> 旧的 `mv.telegram.search({keyword, limit})`（服务 `telegram.search`）已下线。同名的 `mv.telegram.search(channel, keyword, limit)` 是下面这一项，参数不同，旧代码照原样调用会失败（没获准 `telegram.channel` 时报未获准，获准了也会因频道名不对报错）。

#### mv.telegram.channels()

```js
const { channels } = mv.telegram.channels();
// [{ ref: 'p0123456789abcdef', title: '示例私有频道', kind: 'channel' }]
```

| 字段 | 说明 |
|---|---|
| `ref` | 不透明标识：`p` + 16 位十六进制。按插件区分，换一台 Muvyo 会变（存的起点随之作废，按首次读取处理） |
| `title` | 会话名称，最多 80 字 |
| `kind` | `channel`（广播频道）/ `group`（群组或超级群） |
| `username` | 可选，仅公开频道或公开群组返回；优先按用户名读取，也可使用网页版后备 |

返回结构为 `{ channels: [{ ref, title, kind, username? }] }`。列表包含管理员勾选的公开与私有频道、群组，没勾选时返回空数组。公开项按用户名（去掉 `@`、转小写）与手填频道去重；私有项仍用 `ref`，不公开内部编号。

#### mv.telegram.read(channel, afterId, limit)

增量读新消息。

| 参数 | 说明 |
|---|---|
| `channel` | 公开用户名，或 `channels()` 给的 `ref` |
| `afterId` | 上次读到的位置；`0` 表示第一次读 |
| `limit` | 可省略，默认 50，1–100 |

```js
const page = mv.telegram.read('@example', afterId, 50);
// afterId 为 0：{ items: [], latest_id: 1234 }      只给起点，不给历史
// afterId 非 0：{ items: [{ id, date, text, links, url? }], latest_id, more }
```

- `items` 按 `id` 从旧到新；`latest_id` 是读到的最后位置，存进 `mv.storage`，下次从这里接着读。
- `more` 为 `true` 表示积压超过一页，接着用新的 `latest_id` 再读，不会跳过消息。
- `date` 为 ISO 时间；`url` 只有公开会话才有（`https://t.me/<用户名>/<id>`）。

#### mv.telegram.search(channel, keyword, limit)

在一个频道或群组里按关键词找消息。`keyword` 1–100 字，不能为空；`limit` 默认 50，1–100。

```js
const { items } = mv.telegram.search('@example', '示例作品', 20);
// items 格式同 read，从新到旧，没有 latest_id
```

#### mv.telegram.page(channel, beforeId, limit)

往前翻页，适合给 [browse 能力](capabilities.md#browse-分类浏览) 提供数据。`beforeId` 为 `0` 读最新一页。

```js
const { items, next_before } = mv.telegram.page('@example', 0, 50);
// items 从新到旧；next_before 为下一页的 beforeId，为 0 表示到头了
```

#### 失败

都会抛异常，常见原因：Muvyo 还没登录 Telegram 账号；私有 `ref` 没被勾选；用户名对上的不是公开频道或超级群；频道不存在或不可访问；Telegram 限流（报错里带等待秒数）。参数为 `limit` 等超出范围时报「参数不正确」。

与 `telegram.bot`、`telegram.botsearch` 以及 Muvyo 自己的签到共用一个账号会话，同一时间只办一件。

### mv.subscription.push(items)

把找到的资源交给订阅（服务 `subscription.push`），适合在定时任务里监听频道、发现新资源后推送。插件要同时声明 `search` 能力。

| 参数 | 说明 |
|---|---|
| `items` | 1–50 条，每条与 [search 的返回条目](capabilities.md#searchquery) 格式相同（`title` 必填，链接按同一套规则校验，可带 `channel`、`rapid_links`） |

```js
const out = mv.subscription.push([
  { title: '示例作品 S01E05 1080p', link_type: '115', share_link: 'https://115cdn.com/s/xxxx',
    share_code: 'ab12', channel: 'example' }
]);
// { accepted: 1, new: 1, matched: 1 }
```

| 返回字段 | 说明 |
|---|---|
| `accepted` | 通过校验的条数；没有可用链接、字段不合规的条目丢弃，不计入 |
| `new` | 其中第一次推送的条数。同一插件、同一链接、同一标题只处理一次；同一个持续更新的分享换了标题照样处理 |
| `matched` | 片名命中至少一条订阅的条数 |

- 只交给「会用到这个插件」的订阅：订阅勾选了这个插件，或订阅没限定来源且插件打开了「参与订阅与洗版」。
- 片名命中后，过滤、去重、节流、文件身份校验与转存全按订阅原来的规则；转不转存由订阅决定，`matched` 不等于已转存。
- 交给订阅后在后台排队，函数很快返回。排队期间插件被停用、不再是这条订阅的来源或收回了 `subscription.push`，这批资源整批撤销。
- 转存结果不确定时不会自动重提。
- 还要换链接的条目（只给 `resolve_token`、没有链接，例如监听到的资源页）也可以推：按来源 + 条目 `id`（没有就用令牌）去重，命中订阅后由订阅按积分上限等规则调用 `resolve` 换链接；没命中订阅的不会自动换，直接跳过。
- 没命中订阅的资源默认丢弃。管理员可以在插件设置「插件推送的资源」里打开「没命中订阅的资源也转存」，处理方式见 [能力与接口](capabilities.md#没命中订阅的资源)。
- 插件没有声明 `search` 能力时直接报错；条数超出 1–50 时报错。

### mv.telegram.botSearch({bot, keyword, mode, ...})

用用户的 Telegram 账号向搜索机器人查资源（服务 `telegram.botsearch`）。机器人要在 `permissions.telegram_bots` 里声明，或由管理员在插件设置「可用的搜索机器人」里添加，对方必须是机器人账号。

| 参数 | 说明 |
|---|---|
| `bot` | 必填，机器人用户名（可带 `@`），5–40 字符 |
| `keyword` | 搜索词，≤ 100 字。除 `browse` 外必填；不能以 `/` 开头、不能含 Telegram 深链或换行 |
| `mode` | `query`（默认，发一条查询）/ `history`（只在和它的历史回复里按关键词找，不发消息）/ `inline`（inline 查询）/ `browse`（只往前读已有回复，不发查询、不点按钮） |
| `template` | `query`、`inline` 用，默认 `{keyword}`；必须且只能有一个 `{keyword}`，可写成 `/search {keyword}` 这类单条搜索命令；不能含链接、换行，也不能是启动、支付、解锁、签到等交互命令 |
| `result_buttons` | `query` 用，要点的详情按钮文字（精确匹配，最多 20 个） |
| `next_buttons` | `query` 用，翻页按钮文字（精确匹配，最多 20 个） |
| `max_pages` | 最多翻几页，默认 2，1–5；`inline` 按机器人给的 offset 翻页 |
| `before_id` | `browse` 用，`0` 读最新一页 |
| `timeout_seconds` | 默认 20，3–40 |
| `limit` | 默认 50，1–100 |

```js
const out = mv.telegram.botSearch({ bot: 'example_bot', keyword: '示例作品', mode: 'query',
  template: '/s {keyword}', result_buttons: ['详情'], next_buttons: ['下一页'] });
// { items: [{ id: '812', text: '…', links: ['https://…'] }], skipped: false }
// browse：{ items, skipped: false, next_before }
```

- `items` 只含这个机器人的回复：原文去控制字符、最多 4000 字；`links` 最多 20 条，同样不做网盘白名单校验。`skipped` 为 `true` 表示有按钮或回复被跳过。
- 按钮文字含购买、解锁、加入、登录、积分、会员、签到等字样的，声明时就拒绝；运行时这类按钮和要密码的按钮一律不点，没列出的按钮也不点。点按钮后弹提示或跳转链接的，不当资源。每次最多点 20 次。
- 同一机器人两次查询至少间隔 2 秒。`query` 发出后结果不确定（超时、出错）**不会重发**，这个机器人冷却 60 秒，之后只接收明确回复查询的消息，避免串入迟到回复。Telegram 要求等待时整个账号暂停。
- 机器人既没声明也没被管理员添加、未登录 Telegram、对方不是机器人、冷却中、超时都会抛异常。

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

### mv.tmdb.search({keyword, year, media_type, limit})

请 Muvyo 用用户配置的 TMDB 按关键词识别作品，插件拿不到 TMDB 的 Key。适合只支持按 TMDB 编号查询的来源处理关键词搜索。

| 参数 | 说明 |
|---|---|
| `keyword` | 必填，1–100 字 |
| `year` | 可省略，0 表示不限 |
| `media_type` | 可省略，`movie` / `tv`，空串表示都查 |
| `limit` | 可省略，默认 3，最多 10 |

```js
const works = mv.tmdb.search({ keyword: '流浪地球', limit: 3 }).items;
// [{ tmdb_id: 535167, media_type: 'movie', title: '流浪地球', original_title: '流浪地球', year: 2019 }]
```

没有配置 TMDB 时抛异常；同一关键词 10 分钟内重复查询直接用上次的结果。每次调用最多 3 次，每个插件每分钟 30 次。

### mv.telegram.bot({bot, text, wait_seconds})

请 Muvyo 用用户在「Telegram 账号」里登录的个人账号，给机器人发一条消息并收集它的回复，适合签到、查余额这类操作。要在 manifest 的 `permissions.telegram_bots` 列出能发消息的机器人（见 [manifest](manifest.md#permissionsmuvyo-使用-muvyo-的服务)）。

| 参数 | 说明 |
|---|---|
| `bot` | 必填，机器人用户名（可带 `@`），必须在 `permissions.telegram_bots` 里 |
| `text` | 必填，1–500 字，最多 4 行，不能含控制字符 |
| `wait_seconds` | 可省略，默认 10；0–30。等第一条回复的秒数，收到后再等最多 3 秒收后续消息 |

```js
const out = mv.telegram.bot({ bot: 'example_bot', text: '/checkin', wait_seconds: 10 });
// { sent: true, replies: ['签到成功 +10', '当前积分 100'] }
```

- 对方必须是机器人账号，用户名对上的是真人、群或频道时直接拒绝，不会发出。
- 只收这个机器人在这次对话里的回复（最多 10 条，每条去掉 HTML、最多 2000 字），看不到用户的其他聊天；按钮不会被点击，只能发文字。
- 每个插件每天最多 30 条，用完当天不能再发。与 Muvyo 自己的签到、私有频道搜索共用一个账号会话，同一时间只办一件。
- Muvyo 日志只记「给 @机器人 发了一条消息」，不记内容。
- 消息内容由插件决定，确认安装窗口会提醒用户它可能触发兑换、转赠一类的操作；只发完成功能必需的命令。

### 用量、缓存与失败处理

「单次调用」指 Muvyo 执行一次 `search` 等插件入口函数；各服务分别计数。每分钟用量按滚动 60 秒计算，全部插件共享合计上限。

| 服务 | 单次插件调用最多请求 | 每插件每分钟 | 全部插件合计每分钟 | 全局同时处理 | 单次服务处理时限 |
|---|---|---|---|---|---|
| `library.lookup` | 5 次，每次最多 20 部 | 200 部 | 600 部 | 2 个 | 20 秒 |
| `telegram.channel` | 20 次 | 30 次 | 60 次 | 1 个 | 40 秒 |
| `subscription.push` | 2 次，每次最多 50 条 | 12 次 | 60 次 | 2 个 | 20 秒 |
| `telegram.botsearch` | 2 次 | 6 次 | 12 次 | 1 个 | 45 秒 |
| `share.inspect` | 5 次 | 12 次 | 12 次 | 2 个 | 20 秒 |
| `telegram.bot` | 3 次 | 3 次（每天 30 条） | 6 次 | 1 个 | 50 秒 |
| `tmdb.search` | 3 次 | 30 次 | 60 次 | 2 个 | 20 秒 |

查媒体库的分钟用量按传入部数计，不按批次数计；其余按次数计（推送一次不论几条都算 1 次）；重复条目也占用量。**命中缓存仍计入请求和分钟用量**。无效参数也会消耗单次调用的请求次数；已经计费的请求即使后续失败也不退还用量。

各服务的全局并发独立限制，排队最多 10 秒；处理超时、排队超时或达到用量上限会抛异常。插件整体执行时限仍适用，不会因调用服务而延长。

| 服务 | 短时缓存 |
|---|---|
| 媒体库 | 相同作品、类型、季号的完整查询缓存 60 秒；`complete: false` 不缓存 |
| TMDB 识别 | 相同关键词（忽略大小写）、年份、类型、条数缓存 600 秒 |
| 分享 | 相同链接与提取码：有效结果 600 秒，明确无效结果 60 秒；读取失败不缓存 |

Telegram 频道、机器人和推送不缓存，每次都实际执行；推送另有按链接 + 标题的去重（见上）。

缓存由 Muvyo 在进程内管理，不是插件的 `mv.storage`；结果可能短暂滞后。用 `try/catch` 为辅助查询降级，不要在同一次调用里密集重试，也不要把查询结果或上游凭据写进日志。完整用法见 [已入库标记搜索示例](../examples/library-badge-demo/)。

## mv.flaresolverr

经用户部署的 FlareSolverr 打开有 Cloudflare 验证的网页。要在 manifest 声明 `permissions.flaresolverr`（见 [manifest](manifest.md)），用户在插件设置里填写 FlareSolverr 地址后可用。

```js
if (mv.flaresolverr.available) {
  const page = mv.flaresolverr.get('https://www.example.com/search?q=' + encodeURIComponent(q.keyword), {
    max_timeout: 40000,                                   // 毫秒，5000–60000，默认 40000
    cookies: [{ name: 'cf_clearance', value: saved }]     // 可选，最多 20 个
  });
  // page.status      数字
  // page.url         FlareSolverr 跟随跳转后的最终地址
  // page.body        页面 HTML（≤ 4 MB）
  // page.cookies     只含目标网站的 Cookie：[{name, value, domain, path, expires}]
  // page.user_agent  FlareSolverr 用的 User-Agent，之后用 mv.fetch 带上 cf_clearance 时要用同一个
}
```

- `mv.fetch` 与代理：用户网络里用了透明代理（域名被解析成 198.18.x）时请求交给透明代理转发；用户在 Muvyo「系统设置」里填了代理时，**请求写了 `proxy: true` 才**经这个代理发出（没写就直连）。两种情况都只能访问 `domains` 里的网站，指向局域网的域名会被拒绝。服务地址填的是局域网地址时直连。
- 插件连不到 FlareSolverr，也拿不到它的地址：请求由 Muvyo 拼好发给它，只用 `request.get`，不接受代理、会话、下载等参数（只能传 `url`、`max_timeout`、`cookies`）。
- 要打开的网址必须在 `permissions.domains` 里、解析到公网；FlareSolverr 最终停在的地址也必须在获准的域名里，否则整页不交给插件。
- 每次调用最多 5 次，与 `mv.fetch` 共用每分钟联网上限；单次调用的执行时限照常，FlareSolverr 慢时记得调大插件设置里的「单次执行时限」。
- 没填 FlareSolverr 时 `available` 为 `false`，直接调用会抛「插件设置里还没有填写 FlareSolverr 地址」。
- 不要把 FlareSolverr 声明成 `permissions.service`：Muvyo 会拒绝把它当服务地址。

## mv.config

用户在设置页填写的配置，只读。值类型见 [manifest.md](manifest.md#config-配置项)。

```js
const size = Math.min(Number(mv.config.size || 20), 50);
const token = mv.config.token || '';
```

## mv.service

用户填写的服务地址（只有声明了 `permissions.service` 才有），字符串，没填为空串。地址带了路径（如 `http://192.168.1.10:5000/api`）时，插件只能访问这段路径之下，同一端口上的其它路径会被拒绝；编码过的斜杠和 `..` 也不行。

```js
const base = mv.service.replace(/\/+$/, '');
const res = mv.fetch(base + '/api/list?page=1');
```

## mv.sleep(ms)

等一会儿（毫秒），例如重发前的间隔、站点限频。由 Muvyo 在宿主侧挂起，插件不占 CPU：

```js
for (let attempt = 0; attempt < 3; attempt++) {
  if (attempt) mv.sleep(attempt * 1000);   // 第 2 次前等 1 秒，第 3 次前等 2 秒
  // …发请求…
}
```

- 单次最多 10 秒，一次调用合计最多 30 秒，超出时抛出异常（不会等）。
- 等待照样计入执行时限，不会因此延长；时限到了调用照常按超时终止。
- 命名调用与「测试运行环境」不能用。沙箱里没有定时器，**不要用 `while (Date.now() < t) {}` 忙等**，那会占满一个 CPU 核。

## mv.time

版本说明：本轮新增的剩余时间、`mv.sleep`、单请求总超时、结构化换链接错误和按请求代理，从 Muvyo 3.13.0 开始提供。用到其中任何一项，`min_mv_version` 至少写 `3.13.0`。

服务器所在时区。沙箱只拿到最小的环境变量，容器靠 `TZ` 环境变量设时区时，插件里的 `Date` 多半按 UTC 走；
按本地日期判断（签到日期、「今天 / 3 天前」、监听时段）请用这里的值：

```js
mv.time.offsetMinutes   // 服务器时区相对 UTC 的偏移（分钟），东八区为 480
mv.time.local()         // 服务器本地时间：返回的 Date 用 getUTCHours() / getUTCDate() 等读出来就是本地时间
mv.time.today()         // 服务器本地日期 'YYYY-MM-DD'；mv.time.today(1) 是昨天
mv.time.remainingMs()   // 这次调用还剩多少毫秒会被结束；不知道时为 null
```

调用超过执行时限会被直接结束，**已经拿到的结果全部作废**。要读很多页、很多频道的插件，每做一步前看一眼 `remainingMs()`，不够了就收尾，把拿到的结果标 `partial: true` 交出去。

Muvyo 服务调用的排队与执行共用本次剩余预算，宿主提前三秒取消未完成服务并向插件抛出异常。频道读取和机器人搜索应捕获异常并返回已取得的结果；不能假定每次读取都能用满服务自身的超时上限。

## mv.storage

插件自己的小型持久存储，跨调用保留，适合缓存登录令牌、上次刷新时间等。

```js
mv.storage.get('token')          // 没有返回 null
mv.storage.set('token', 'abc')   // 值可以是任何能 JSON 序列化的数据
mv.storage.remove('token')
```

- 整体 ≤ 64 KB（JSON 序列化后），超过则本次调用失败。
- 调用正常结束，或插件代码自己抛出异常（`throw`）时，都会保存本次的修改，刚轮换的登录令牌不会因为后面出错而丢掉；超时被结束、内存超限、运行环境异常时**不保存**。
- 加密保存在 Muvyo 的数据库里。Muvyo 读不出（数据库暂时不可用、数据目录密钥变了）时本次调用直接失败，不会把空数据交给插件；存不进去时 Muvyo 重试一次，仍失败则本次调用报失败。所以刚轮换的令牌最好在确认保存成功（调用正常结束）后再作废旧的。
- 用户可以在插件设置里点「清除插件数据」清空它，插件下次调用时应能从未登录状态重新开始。

## mv.cache

带有效期的结果缓存，适合定时任务预先取好目录、列表这类数据，普通调用直接读。

```js
mv.cache.set('catalog', page, 7200)   // 暂存 JSON 值，ttl_seconds 必填 1–604800，从 set 时起算
mv.cache.get('catalog')               // 返回 JSON 副本；未命中或过期返回 null
mv.cache.delete('catalog')
mv.cache.limits                       // 只读的当前配额，旧版 Muvyo 没有这个对象
```

- 改动只在整个调用成功、提交时权限仍有效时一次性生效；调用失败、超时、取消或配额不足时本次改动全部作废，旧值照原有效期过期。
- 键以 ASCII 字母或数字开头，可含字母、数字、`.`、`_`、`:`、`-`，共 1–128 字符。
- 单条最多 256 KiB；每个插件最多 20 MiB、512 条；全部插件合计 64 MiB、4096 条。JSON 深度最多 32、节点最多 32768；每次调用最多 1024 次缓存操作、传输 16 MiB。`mv.cache.limits` 给出当前配额（`entry_bytes`、`plugin_bytes`、`plugin_entries`、`transfer_bytes`、`operations`、`max_ttl_seconds`），没有它时按每插件 8 MiB 规划。
- 按插件隔离、加密保存，重启可复用。插件更新、卸载、配置或服务地址变化会清空缓存，它不是永久存储。
- 命名调用不能用缓存；命中缓存也不会跳过授权和权限校验。
- 定时任务成功、或其它调用成功写了缓存，会让本插件的内容结果缓存失效，不影响其它插件。
- 播放直链不要长期缓存。刷新失败时不要先删旧值，也不要把失败结果当正常数据写进去。

## mv.log

写进 Muvyo 日志，管理员可在插件日志里看到。

```js
mv.log.info('刷新成功');
mv.log.warn('第 2 页没有数据');
mv.log.error('登录失败');
```

每条最多 500 字；一次调用最多 200 条（只记前 50 条），超过会终止调用。不要把令牌、密码写进日志：Muvyo 会把配置值、调用开始的存储值和本次已写入 `mv.storage` 的新值在日志与报错里打码；尚未存储的新令牌仍无法识别。定时任务里的日志不记录。

抛出的异常（`throw new Error(...)`）会显示在插件列表、搜索结果和机器人回复里，同样会打码；交给 AI 助手 / MCP 时只给一句「插件执行出错」，不给原文。

## mv.crypto

常用的哈希与编码（字符串按 UTF-8 处理，哈希结果为十六进制小写）。

```js
mv.crypto.sha256('text')
mv.crypto.md5('text')
mv.crypto.hmacSha256('key', 'text')
mv.crypto.base64Encode('text')
mv.crypto.base64Decode('dGV4dA==')
mv.crypto.randomHex(16)   // 16 字节随机数 → 32 个十六进制字符，n 取 1–256
mv.crypto.randomB64u(18)  // n 字节随机数，不带填充的 base64url
mv.crypto.powmod(baseHex, expHex, modHex)          // 模幂，十六进制进出；模数 ≤ 4096 位、指数 ≤ 500 万位
mv.crypto.hkdfSha256(ikm, saltHex, info, length)  // HKDF-SHA256：ikm、info 为文本，salt 为十六进制字节，返回十六进制
mv.crypto.hmacSha256B64u(keyHex, text)            // HMAC-SHA256，密钥为十六进制字节，返回 base64url
mv.crypto.aesGcmEncrypt(keyHex, text)             // AES-GCM（16 / 32 字节密钥）→ base64url(12 字节随机 nonce + 密文)
mv.crypto.aesGcmDecrypt(keyHex, b64u)             // 解密失败抛异常；明文 ≤ 1 MB
```

`powmod` 用于站点的时间锁、工作量证明这类验证：在 Muvyo 里用原生整数计算，比 JS 的 BigInt 快得多，但仍计入单次调用时限。

## 限制

| 项目 | 限制 |
|---|---|
| 单次调用时长 | 默认 60 秒（插件设置里「单次执行时限」可调成 5–300 秒），超时终止 |
| 内存 | 64 MB |
| 网络请求 | 每次调用 30 个，每个 20 秒，响应 ≤ 4 MB；每分钟每插件 300 个、64 MB |
| 无人值守的搜索 | 订阅、机器人、AI 助手调用 `search` 时总时长 ≤ min(单次时限, 90) + 20 秒（含排队）；订阅里连续 3 次失败暂停 10 分钟 |
| 存储 | 64 KB |
| 代码 | 入口文件 ≤ 1 MB，只能有一个 JS 文件 |

每次调用都在全新的 JS 环境里执行：全局变量**不会**在两次调用之间保留，需要保留的数据放 `mv.storage`。

同一个插件同一时间只执行一个调用，其余排队；函数要尽快返回，别在一次调用里做太多请求。排队时，用户在网页、机器人、AI 助手里点的搜索和获取链接排在订阅自动搜索、定时任务、事件前面；正在执行的调用不会被打断，所以定时任务（如签到）别占用太久。

插件停用、没有有效 Muvyo 授权、或插件被官方停用时不会被调用。
