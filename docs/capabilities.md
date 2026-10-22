# 能力与接口

在 manifest 的 `capabilities` 里声明能力，在入口文件里实现对应的全局函数。每个函数收到一个参数对象，返回一个对象。

返回结果都会经过 Muvyo 校验：字段类型不对、超长、链接不合规的**单条结果会被丢弃**，不影响其它条目；整体格式不对（比如缺 `items` 数组）则这次调用失败。表里没列的多余字段会被忽略。

- [search 资源搜索](#search-资源搜索)
- [browse 分类浏览](#browse-分类浏览)
- [vlib 虚拟库片单](#vlib-虚拟库片单)
- [content 内容源](#content-内容源)
- [metadata 刮削来源](#metadata-刮削来源)
- [webhook 事件](#webhook-事件) — 接收 Muvyo 自己的事件，返回值被忽略
- [mascot 慕慕形象](#mascot-慕慕形象) — 只在清单里声明名字与包内立绘，不需要写函数
- [tasks 定时任务](#tasks-定时任务) — 按间隔或每天定时执行 `scheduledTask`
- [account 账号信息](#account-账号信息) — 插件设置页顶部只读显示账号情况
- [naming 整理命名（待发布）](naming.md) — 独立协议；返回对象或 `null`，未知字段拒绝，不适用上面的单条丢弃规则

除声明能力外，插件还可通过 `permissions.muvyo` 申请[使用 Muvyo 的服务](runtime.md#使用-muvyo-的服务)：查询媒体库、读取 Telegram 频道、用机器人搜索、推送资源给订阅、检查网盘分享等，管理员确认后生效（命名调用不可用）。

---

## search 资源搜索

> 只能对接你或用户有权使用、分发内容的来源（例如用户自己部署的服务、公开授权的资源）。聚合未经授权的分享资源属于 [开发者协议与内容政策](policy.md) 禁止的插件。

插件作为一个搜索来源，出现在资源搜索、订阅自动搜索、机器人搜索里。用户可以在插件设置里决定它是否参与订阅与洗版（「参与订阅与洗版」开关）。

### 声明

```json
"capabilities": {
  "search": {
    "link_types": ["115", "magnet"],
    "supports_tmdb": false,
    "resolve": false,
    "resolve_cost": "none",
    "modes": ["completed"]
  }
}
```

| 字段 | 说明 |
|---|---|
| `link_types` | 会返回的资源类型：`115`、`123pan`、`baidupan`、`guangyapan`、`aliyundrive`、`cloud189`、`magnet`、`ed2k`；返回 123 秒传清单的写 `123pan` |
| `supports_tmdb` | 能按 TMDB 编号精确搜索时设为 `true`，Muvyo 会把它的结果当作精确匹配 |
| `resolve` | 搜索结果先不给链接、用户选中后再换取链接时设为 `true`，并实现 `resolve` |
| `resolve_cost` | 来源站点自身是否按积分计费：`none` 或 `points` |
| `link_hosts` | 可选，能解析的网站（例如资源页所在的域名，可写 `*.example.com`），用户把带这些网站链接的消息转发给 Muvyo 机器人时调用 `parseLink`；每一项都必须在 `permissions.domains` 里 |
| `modes` | 可选，额外支持的搜索方式。目前只有 `completed`：资源推荐里的「完结剧集」只问声明了它的插件 |

### search(query)

参数：

```js
{
  keyword: "流浪地球",   // 搜索词，可能为空串（按 TMDB 搜索时）
  tmdb_id: 0,            // 按 TMDB 搜索时为编号，否则 0
  media_type: "",        // 按 TMDB 搜索时为 "movie" / "tv"，否则空串
  year: 0,               // 年份，未知为 0
  season: null,          // 季号，未知为 null
  episode: null,
  limit: 50,             // 建议返回的最大条数
  purpose: "subscription", // 哪个入口在搜：manual 网页 / subscription 订阅 / wash 洗版 / bot 机器人 / agent 配置助手
  link_types: ["115", "magnet"], // 这次能收的资源类型（目标网盘能接收的）；没有这个字段表示不限
  filters: { resolution: "2160p", effect: "", include_regex: "", exclude_regex: "" }, // 订阅的筛选条件，只在订阅里出现
  mode: "completed"      // 只在「完结剧集」里出现，普通搜索没有这个字段
}
```

- `year` 在订阅里是剧集首播年或电影年份；网页搜索选定了作品时给出。
- `purpose` 可以用来区分入口：例如只在订阅里做官组 / 发布者过滤，网页搜索照常给全部结果。
- `filters` 只给值，插件可以先按它们筛掉不合格的候选、再去解析详情，避免把有限的解析次数花在一定会被丢掉的结果上；Muvyo 收到结果后还会再按订阅规则筛一遍。
- 同一插件的调用一次只执行一个：Muvyo 按插件排队，同样参数的请求正在执行时直接共用它的结果。排队等待不算插件的执行时间，排队超时也不算插件失败（不会触发订阅的连续失败暂停）。

`mode` 为 `"completed"` 时 `keyword` 可能为空串，`tmdb_id` 为 0：由插件自己决定怎么找已完结的剧集资源（例如读取来源的「完结」分区）。没声明 `modes: ["completed"]` 的插件不会收到这种调用。

返回：

```js
{
  items: [
    {
      id: "abc123",                 // 可选，结果在你站点上的 ID
      title: "流浪地球 2 4K",        // 必填，≤ 500 字
      description: "",              // ≤ 4000 字
      link_type: "115",             // 同 link_types 取值
      share_link: "https://115cdn.com/s/xxxx",
      share_code: "abcd",           // 提取码，≤ 32 字
      magnets: [],                  // 磁力链接数组（link_type 为 magnet 时）
      ed2k: [],                     // 电驴链接数组（link_type 为 ed2k 时）
      resolve_token: null,          // 需要换取链接时给一个令牌，此时可以不给 share_link
      cost: 0,                      // 来源站点自身对换取链接的计费（积分）
      cost_unknown: false,          // 说不准要几分时设为 true，机器人会提示可能扣积分并先确认
      size_bytes: 0,
      season: null,                 // 资源对应的季
      episodes: [],                 // 资源包含的集号
      tmdb_id: 0,                   // 可选，资源对应作品的 TMDB 编号
      media_type: "",               // 可选，"movie" / "tv"
      media_title: "",              // 可选，资源对应作品的片名（例如中文名），标题只写原名时按关键词筛选不会误杀
      tags: ["4K", "HDR"],          // 只取前 10 个
      published_at: "2026-09-01",   // ≤ 40 字
      channel: "example",           // 可选，资源出自哪个频道 / 群组 / 分区，≤ 64 字
      rapid_links: "",              // 可选，123 秒传清单，见下
      uploader: "",                 // 可选，发布者 / 上传者，≤ 64 字
      uploader_avatar: "",          // 可选，发布者头像的 https 图片地址，见下
      owned: false,                 // 可选，当前账号已拥有（买过、解锁过）时为 true
      badges: [],                   // 可选，醒目短标签 [{ text, tone }]，见下
      details: [],                  // 可选，详情 [{ label, value }]，见下
      files: [],                    // 可选，资源包含的文件名
      poster: ""                    // 海报地址
    }
  ],
  partial: false   // 部分来源失败时设为 true，Muvyo 会提示「部分来源失败」
}
```

每条结果必须有可用的链接（含合规的 `rapid_links`）或 `resolve_token`，否则丢弃：`share_link` 要是对应网盘的分享地址，`magnets` 要是 `magnet:` 链接，`ed2k` 要是 `ed2k://|file|文件名|大小|32 位哈希|/` 格式的电驴链接（文件名不能带引号、尖括号、换行等字符，最多 200 条）。最多取 200 条；`size_bytes` 不超过 2^50。

- 只有电驴链接的结果，订阅会交给支持离线下载的网盘处理，并先核对文件名是否属于这部作品。
- 磁力只保留 `xt`（资源哈希）、`dn`（名称）和公网 `tr`（tracker，udp / http / https，最多 20 个）；`ws`、`xs`、`as`、`x.pe` 等会让下载器去连额外地址的参数会被去掉。
- `channel` 用于展示来源，也供管理员在「没命中订阅的资源也转存」里按频道选保存目录（按去掉 `@`、小写后比较）。
- `tmdb_id` / `media_type` 只用于订阅自动获取链接前核对「是不是这部作品」，不参与识别和整理。需要积分的资源建议给出，并且一定要给稳定的 `id`（见下）。
- `uploader`、`owned`、`badges`、`details`、`files` 只用于结果卡片展示，不参与筛选、排序与转存；一律按纯文本显示，网址会被去掉，格式不对的条目逐条略过：
  - `uploader` 显示在卡片抬头，不要再塞进 `tags`。
  - `uploader_avatar` 是发布者头像的 https 地址。浏览器不会直连它：Muvyo 按插件已获准的域名取回、缩小成小方图后显示，所以图床域名也要写进 `permissions.domains`；取不到时显示发布者名字的首字。
  - `owned` 为 `true` 时卡片显示「已解锁」，换链接不应再扣分，`cost` 请写 `0`。
  - `badges` 最多 4 个，每个 `text` ≤ 12 字；`tone` 与[账号信息](#account-账号信息)相同，取 `ok` / `warn` / `error`，其他按普通标签。适合「官方」「已验证」「已失效」这类需要一眼看到的状态。
  - `details` 最多 12 行，`label` ≤ 20 字、`value` ≤ 200 字；`files` 最多 50 个、每个 ≤ 200 字。两者在卡片「详情」里查看。
- `cost_unknown` 为 `true` 的结果，订阅、洗版和配置助手一律不自动换链接；只有用户在网页（点两次确认）或机器人里确认后才换。
- `season` + `episodes` 是单季的集号：订阅只用它排序、跳过一定不含缺集的资源，不当作文件身份证据（转存前照样按真实文件名核对）。没写 `season` 的不使用，跨季资源不要把集号写成某一季的全集。
- 返回的条目全部格式不对（字段类型错、缺标题）时算这次搜索失败；部分格式不对时标为部分失败，订阅这一轮不计入 MoviePilot 自动补找。链接不是 Muvyo 接入的网盘或磁力的条目只是略过，不算插件失败。
- 声明了多种 `link_types` 的插件，每条结果都要写 `link_type`（包括还要换链接的）：订阅按它判断目标网盘能不能收；没写类型的付费条目订阅不会自动换。

### rapid_links 123 秒传清单

没有分享链接时，可以给一段 123 秒传清单，Muvyo 只把它交给 123 网盘秒传：

```
123FSLinkV2$<摘要>#<字节数>#<路径>$<摘要>#<字节数>#<路径>
123FLCPV1$<公共路径>%<摘要>#<字节数>#<路径>
```

- 前缀只认 `123FSLinkV1`、`123FSLinkV2`、`123FLCPV1`、`123FLCPV2`；一行一条，空行忽略。`123FLCP` 开头的要有 `公共路径%`。
- 摘要必须是 MD5：32 位十六进制；V1 也可以是 16 字节的 base64 / base64url；V2 也可以是 Base62（≤ 22 位）。SHA1 等其它摘要不收。
- 路径是相对路径：开头的 `/` 去掉，不能含 `\`、`:`、控制字符、空段、`.`、`..`，最多 32 层、4096 字符；同一份清单里路径不能重复。
- 整段不超过 262144 个字符（超出时这条结果整条丢弃），最多 1000 个文件。**任何一行不合规，整段都不收**（不是逐行丢弃）。
- 同一条结果同时给了合规的 `share_link` 时以分享链接为准，`rapid_links` 忽略；给了合规的秒传清单时，同条的磁力和电驴链接不再使用。

### parseLink({ url, tmdb_id, media_type })

声明了 `link_hosts` 才会调用。用户把消息转发给 Muvyo 的机器人（或发 `/parse 链接`），消息里没有网盘分享、磁力或电驴链接、但有落在 `link_hosts` 里的链接时，Muvyo 把**这一条链接**交给插件：

```js
{
  url: "https://www.example.com/resource/abc123",  // 命中 link_hosts 的那条链接
  tmdb_id: 603,         // 消息里写了「TMDB: 603」时给出，否则 0
  media_type: "movie"   // 按消息文字猜的类型："movie" / "tv"，猜不出为空串
}
```

消息的其余内容不会交给插件。返回值与 `search` 相同（`{ items: [...] }`，同一套校验）：只有一条时，免费的直接转存或离线下载，要积分或 `cost_unknown` 的先问用户；有多条时机器人列出结果让用户选。不是自己能解析的链接返回 `{ items: [] }`。

### resolve({ token })

声明了 `resolve: true` 才会调用。参数是搜索结果里的 `resolve_token`，返回：

```js
{ share_link: "https://...", share_code: "abcd", magnets: [], ed2k: [], rapid_links: "" }
```

`rapid_links` 规则同上。

换不到链接时，**返回或抛出结构化的错误**（普通 Error 没有声明类型，付费资源只能当成「可能已扣分」）：

```js
return { error: { kind: 'rejected', message: '积分不足' } };
// 也支持：throw { error: { kind: 'source', message: '授权失效，未发起解锁' } };
```

| kind | 什么时候用 | Muvyo 怎么处理 |
|---|---|---|
| `rejected` | 站点明确拒绝、**确定没扣分**：资源失效、积分不足、无权限 | 订阅接着试下一条；付费资源撤掉「待核对」记录，下一轮还能再买；网页上可以再点 |
| `uncertain` | **可能已经扣分**：请求发出后超时、网关报错、返回内容解析不了 | 付费资源不再自动买，提示用户到网页核对；这一轮不算搜完 |
| `source` | 插件**整体**出了问题：授权失效、限流冷却、站点不可达 | 这一轮不再找这个插件换链接（不耗每日次数），不算搜完 |

没说明类型的失败（抛错、返回别的格式）：付费资源按 `uncertain`，免费资源按 `rejected`。

`source` 也表示本次没有扣分：仅在尚未发起购买、或站点明确保证没有执行购买时使用。购买请求发出后遇到 502 / 503 / 504、断网或解析失败，一律用 `uncertain`，即使此时整个站点也不可用。不要用 `source` 释放可能已经扣分的记录。

用户手动选中资源时调用；订阅自动转存时，只对积分不超过插件设置里「订阅自动获取链接的积分上限」的资源调用（默认 0，即只取免费资源）。

`cost` 是你自己报的，Muvyo 无法核实，所以另有几道限制：

- **次数**：订阅自动获取每个插件每天最多 30 次，不论 `cost` 多少、成功与否；用户确认过的获取（网页点「获取链接」、机器人回复确认、AI 助手确认草案）每个插件每小时最多 60 次。用完时 `resolve` 不会被调用。
- **核对**：结果给了 `tmdb_id` / `media_type` / `season` 且与订阅不符时，订阅不获取。`cost > 0` 却没有 `id` 的结果，订阅不自动获取（认不出这条买没买过）。
- **重复**：网页上同一条结果的获取令牌只能用一次，再点会直接返回上次的结果，不会再调用 `resolve`；插件更新或改设置后旧令牌失效，用户需要重新搜索。
- **确认**：机器人里选中 `cost > 0` 的结果会先问用户；AI 助手（MCP）即使开了全权限运行，来自插件的转存也要用户确认。
- 搜到结果之后到真正转存之间，插件被停用、吊销或授权失效的，它的结果不再转存。

新装的插件默认不参与订阅与洗版的自动搜索与转存，管理员在插件设置里打开「参与订阅与洗版」后才会参与。

---

## browse 分类浏览

资源推荐的「分类浏览」里出现插件提供的来源（例如一个个频道）。用户点开某个来源，Muvyo 向插件要帖子，用 TMDB 认出作品后出作品卡片；**帖子原文不显示**，认不出的帖子直接略过。

### 声明

```json
"capabilities": {
  "browse": {"label": "频道"}
}
```

| 字段 | 说明 |
|---|---|
| `label` | 可选，来源的叫法，≤ 10 字，默认「频道」 |

### browseSources()

参数为空对象，返回来源列表：

```js
{
  sources: [
    { id: "@example", name: "示例频道", kind: "public" },
    { id: "p0123456789abcdef", name: "示例私有频道", kind: "private" },
    { id: "bot:example_bot", name: "@example_bot", kind: "bot" }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `id` | 必填，1–80 个字符，只能用字母、数字与 `_@.:-`；不合规的条目丢弃 |
| `name` | 显示名，≤ 60 字，不填用 `id` |
| `kind` | `public` / `private` / `group` / `bot`，其它值按 `public` |

最多取 50 个。结果缓存 10 分钟。

### browsePage({ source, before })

`source` 为来源 `id`；`before` 为翻页位置，`0` 表示最新一页。

```js
{
  items: [
    { id: 1234, title: "示例作品 (2025) 4K", text: "简介或帖子正文" }
  ],
  next_before: 1180     // 下一页的 before；0 表示没有更多
}
```

| 字段 | 说明 |
|---|---|
| `items[].title` | 必填，用来认作品的那一行，≤ 200 字；没有的条目丢弃 |
| `items[].text` | 可选，帮助识别的正文，≤ 800 字（也可以叫 `description`） |
| `items[].id` | 可选，数字时按它从新到旧排序 |
| `next_before` | 必须是比当前 `before` 小的非负整数，否则按 0 处理 |

- 每页最多取 100 条。Muvyo 一次最多连读 3 页、凑够 12 张卡就停，同一部作品只出一张卡。
- 搭配 [`mv.telegram.page`](runtime.md#mvtelegrampagechannel-beforeid-limit) 或 `mv.telegram.botSearch({mode: 'browse'})` 实现最方便。

---

## vlib 虚拟库片单

插件给出一组影片（TMDB 编号，或片名 + 年份），在「封面 & 虚拟库」里作为「第三方插件片单」来源。片名、海报、评分等资料**一律由 Muvyo 从 TMDB 获取**，插件给的其它字段不采用。

### 声明

```json
"capabilities": {
  "vlib": {
    "lists": [
      {"key": "hot", "name": "热门电影", "media_type": "movie"},
      {"key": "by_year", "name": "按年份", "media_type": "mixed",
       "params": [{"key": "year", "label": "年份", "type": "number", "min": 1900, "max": 2100}]}
    ]
  }
}
```

| 字段 | 说明 |
|---|---|
| `lists` | 片单，1–30 个 |
| `key` | 片单标识，字母开头，字母、数字、下划线 |
| `name` | 显示名 |
| `media_type` | `movie`、`tv` 或 `mixed`（默认） |
| `params` | 用户在虚拟库里选这个片单时要填的参数，格式同 [配置项](manifest.md#config-配置项)，最多 10 个 |

### vlibItems({ list, params })

参数：`list` 为片单 key；`params` 为用户填的参数（值都是字符串，只包含声明过的 key）。

返回：

```js
{
  items: [
    { tmdb_id: 27205, media_type: "movie" },
    { title: "三体", year: 2023, media_type: "tv" }   // 没有 TMDB 编号时给片名 + 年份
  ]
}
```

- `media_type` 为 `movie` / `tv`；不填时按片单的 `media_type`（`mixed` 片单不填则由 Muvyo 判断）。
- 每条至少要有 `tmdb_id` 或 `title`；最多取 300 条。
- 结果会被 Muvyo 复用 10 分钟（空结果或失败 5 分钟），不必担心被频繁调用。

---

## content 内容源

内容源用来**接入用户自己部署的媒体服务**：插件声明 `permissions.service`，用户在插件设置里填自己那台服务的地址，插件从这台服务取作品列表、分集和播放地址；在「封面 & 虚拟库」里新建来源为这个插件的虚拟库，就能在 Vyo 里浏览和播放（网页和 Emby 兼容客户端都能用）。

内容源不是用来聚合第三方视频站的：不要把它写成去抓取、解析别人网站上的影视作品，这类插件违反 [开发者协议与内容政策](policy.md)。

视频和图片由 Muvyo 按插件的联网权限代为请求：播放地址、封面地址应当来自用户填的服务地址；确实要从别的域名取（比如服务把封面放在单独的图片域名上），要写进 `permissions.domains` 并在安装时由用户确认。

### 声明

```json
"capabilities": {
  "content": {"categories": true, "search": true}
}
```

| 字段 | 说明 |
|---|---|
| `categories` | 实现了 `contentCategories`（分类清单）时设为 `true` |
| `search` | 实现了 `contentSearch`（关键词搜索）时设为 `true` |

### contentList({ category, page })

按分类分页列出作品。`category` 为分类 ID（没有分类时为空串），`page` 从 1 开始。

```js
{
  items: [
    {
      id: "v1001",                     // 必填：字母、数字、下划线、短横线，≤ 128
      title: "示例作品",
      poster: "https://img.example.com/v1001.jpg",
      description: "简介",
      episode_count: 24,
      remark: "4K",                    // 角标文字，≤ 100
      tags: ["剧情", "科幻"],           // ≤ 20 个
      rating: 8.5                      // 0–10
    }
  ],
  total: 1200,       // 可选：总条数
  page_count: 60     // 可选：总页数
}
```

每页条数由插件决定，但要保持一致；不知道总数时可以不给 `total` / `page_count`，Muvyo 翻到空页或重复页为止。

### contentCategories({ library_category })

```js
{ categories: [ { id: "movie", title: "电影" }, { id: "series", title: "剧集" } ] }
```

最多 100 个；分类 ID 规则同作品 ID。管理员建内容库时可以选定一个分类。

`library_category` 只在浏览某个内容库时出现，是这个库选定的分类 ID；管理员建库挑分类时不带这个参数。插件同时接了几个内容来源时，可以在建库时列出全部来源的分类（如「来源 A · 热门」「来源 B · 最新」），浏览某个库时只返回与 `library_category` 同一来源的分类，库里的分类标签就不会混进别的来源。不需要分组的插件忽略这个参数即可。

### contentSearch({ keyword, category, page })

返回格式同 `contentList`。`category` 是这个内容库选定的分类 ID（没选时为空串），接了多个内容来源的插件可以据此只搜对应来源。

### contentDetail({ id })

```js
{
  title: "示例作品",
  poster: "https://...",
  description: "简介",
  episode_count: 24,
  tags: ["剧情"],
  rating: 8.5,
  status: "连载中",
  people: [ { name: "张三", role: "主演", avatar: "https://..." } ],   // ≤ 100
  episodes: [
    { index: 1, title: "第 1 集", duration: 120 },   // index 从 1 开始，duration 单位秒
    { index: 2, title: "第 2 集", duration: 118 }
  ]
}
```

### contentPlay({ id, episode })

```js
{
  url: mv.service.replace(/\/+$/, "") + "/media/v1001/1.mp4",   // 用户填的服务地址上的文件
  headers: { "Authorization": "Bearer " + mv.config.api_key },   // 可选：取视频要带的请求头，≤ 20 个
  media: {                                          // 可选：帮助播放器提前判断能不能直接播放
    container: "mp4",
    size: 12345678,
    duration: 120,
    video: { codec: "h264", width: 1920, height: 1080 },
    audio: { codec: "aac", channels: 2 }
  }
}
```

播放地址可能有时效，Muvyo 只复用 60 秒。

`url` 可以是视频文件，也可以是 HLS 播放列表（`.m3u8`）。给播放列表时把 `media.container` 写成 `"m3u8"`，客户端才会按 HLS 打开。Muvyo 会读出播放列表，把里面的子播放列表、分片和解密密钥地址都换成 Muvyo 自己的转接地址，播放器只和 Muvyo 通信，`headers` 也会带上。播放列表来自插件声明的域名时，每一段同样只能访问声明并经确认的域名；播放列表来自用户填的服务地址时，视为用户自己的服务担保，里面引用的分片可以在其它公网地址上（仍只连公网、只收媒体类型）。限制：

- 分片必须返回媒体类型（如 `video/mp2t`、`video/mp4`），解密密钥不超过 4 KB；
- 播放列表里只能是 `http(s)` 地址，出现 `skd://`、`data:` 等地址时整份不播放；
- 不支持 DASH（`.mpd`）。

---

## metadata 刮削来源

Vyo 媒体库的扫描设置里可以把「资料来源」改成插件（插件停用时这个库的资料补全会失败，不会自动改用其它资料来源）；重新识别时也可以切换到插件搜索。插件给的资料按 TMDB 的结构写进媒体库（本地 NFO、手动锁定的资料仍然优先）。

### 声明

```json
"capabilities": {
  "metadata": {"media_types": ["movie", "tv"]}
}
```

### metadataSearch({ keyword, year, media_type })

`year` 未知为 0；`media_type` 为 `movie` / `tv`，未知为空串。

```js
{
  items: [
    {
      id: "m-1234",                 // 必填：字母、数字、下划线、点、冒号、短横线，≤ 128
      title: "示例电影",             // 必填
      original_title: "Example",
      year: 2024,
      media_type: "movie",          // 必填：movie / tv
      overview: "简介",
      poster: "https://img.example.com/p.jpg",   // 只接受 https
      rating: 7.8,
      image_headers: { "Referer": "https://example.com/" }   // 可选：取图要带的请求头
    }
  ]
}
```

最多取 50 条。

### metadataDetail({ id, media_type })

```js
{
  title: "示例剧集",                 // 必填
  original_title: "Example Show",
  overview: "简介",
  tagline: "",
  year: 2024,
  premiere_date: "2024-01-01",      // YYYY-MM-DD
  runtime: 45,                      // 分钟
  genres: ["剧情", "悬疑"],
  rating: 8.1,
  vote_count: 1200,
  countries: ["中国"],
  studios: ["示例影业"],
  status: "Ended",
  poster: "https://...",            // 图片只接受 https
  backdrop: "https://...",
  images: {                         // 可选：「编辑图片」里的备选图，每类最多 30 张
    posters: ["https://..."],
    backdrops: ["https://..."],
    logos: ["https://..."]
  },
  image_headers: { "Referer": "https://example.com/" },
  people: [
    { name: "张三", role: "李四", type: "Actor" }   // type：Actor / Director / Writer / Producer / Crew
  ],
  external_ids: { imdb_id: "tt1234567", tmdb_id: "12345" },
  seasons: [                         // 剧集才需要
    {
      season_number: 1, title: "第一季", overview: "", poster: "https://...", air_date: "2024-01-01",
      episodes: [
        { episode_number: 1, title: "第 1 集", overview: "", still: "https://...", air_date: "2024-01-01", runtime: 45 }
      ]
    }
  ]
}
```

图片只记下地址，展示时由 Muvyo 按插件的联网权限取回并缓存，所以图片域名也要写进 `permissions.domains`。

`images` 里的备选图不会自动用作封面，只在管理员打开 Vyo「编辑图片 → 搜索在线海报 / 背景 / 徽标」时，与 `poster`、`backdrop`、季海报和单集剧照一起列出供挑选；没给也能用，只是可选的图少。重复地址、非 https 地址会被丢掉。取图请求头不能带 `Cookie`、`Authorization` 等凭据类头。

---

## webhook 事件

Muvyo 自己的上传、STRM 生成、同步与扫描、整理、订阅、下载、备份完成或失败时，以及收到媒体服务器 Webhook 时，把事件交给插件。例如整理完成后通知自己的服务、把下载失败记到别的网站。事件名与 Muvyo「Webhook 推送」相同，但两者互不依赖：不用开「Webhook 推送」，也不用开「Webhook 接收」。

管理员要在插件设置里打开 **接收 Muvyo 事件**（安装后默认关）才会收到。发新版时如果 `events` 里新增了事件，更新确认窗口会列出来，更新后这个开关会被自动关掉，等管理员重新打开；只减少或不改事件不受影响。

### 声明

```json
"capabilities": {
  "webhook": {"events": ["organize.completed", "download.failed"]}
}
```

| 事件 | 含义 |
|---|---|
| `media.uploaded` / `media.upload_failed` / `media.upload_skipped` | 上传成功 / 失败 / 跳过 |
| `strm.generated` / `strm.failed` | STRM 生成 / 失败（全量生成会逐个文件报，量很大） |
| `library.sync_completed` / `library.sync_failed` | 文件同步、媒体库扫描完成 / 失败 |
| `organize.completed` / `organize.failed` | 整理完成 / 失败 |
| `subscription.completed` / `subscription.failed` | 订阅完成 / 失败 |
| `download.completed` / `download.failed` | 下载、云盘离线、BT 下载完成 / 失败 |
| `backup.completed` / `backup.failed` | 备份完成 / 失败 |
| `webhook.received` | 收到媒体服务器（Emby / Jellyfin / Plex）的 Webhook |

只能声明表里的事件，不能重复。v3.9.14–v3.9.15 开放过的媒体服务器事件（`library.new`、`library.deleted`、`playback.*`、`item.*`、`system.notificationtest`）已下线：旧包里的这些声明安装时忽略，不报错也不再投递。

### webhookEvent(e)

```js
{
  event: "organize.completed",
  time: "2026-10-06T21:30:00+08:00",  // Muvyo 转交事件的时间
  data: {                             // 只含这次事件实际带的字段
    source: "organize",               // 来源模块：upload / strm / file_sync / media_library / organize /
                                      // subscription / media_download / bt_downloader / cloud_offline / backup / webhook 等
    status: "processed",              // 结果状态
    title: "绝命毒师",
    media_type: "tv",                 // movie / tv
    tmdb_id: 1396,
    season: 1,
    file_name: "Breaking.Bad.S01E01.mkv",  // 只有文件名，不含目录
    storage_type: "115"               // 网盘类型，不是具体账号
  }
}
```

`data` 可能出现的字段：

| 字段 | 含义 |
|---|---|
| `source`、`status`、`reason` | 来源模块、结果状态、失败原因代码（如 `search_failed`） |
| `title`、`media_type`、`tmdb_id`、`season`、`episode`、`year` | 作品信息 |
| `file_name`、`storage_type` | 文件名、网盘类型 |
| `library_name`、`backup_type` | 媒体库名称、备份类型（`local` / `cloud`） |
| `size`、`files`、`directories`、`created`、`skipped`、`failed`、`success`、`completed`、`total`、`elapsed` | 体积（字节）、数量、耗时（秒） |
| `event_type`、`item_name`、`item_type`、`server` | 仅 `webhook.received`：媒体服务器的事件名、条目名、条目类型、来源（emby / jellyfin / plex） |

返回值被忽略，返回 `null` 即可；抛出错误会显示在插件卡片上。

- **不提供**文件路径、目录、网盘账号、任务与记录编号。
- 投递在后台进行，Muvyo 不等待插件。单次最多 30 秒（不超过管理员设置的执行时限）；每个插件同时最多处理 2 个事件，再多的直接丢弃、不补发，这样事件不会挤占插件的搜索、播放等调用。需要可靠同步时在 `mv.storage` 里记下进度，配合定时任务（`capabilities.tasks`）补齐。
- 字段缺失是常态（例如订阅搜索失败可能没有片名），用之前先判断。

示例见 [examples/webhook-demo](../examples/webhook-demo/)。

---

## 没命中订阅的资源

插件用 [`mv.subscription.push`](runtime.md#mvsubscriptionpushitems) 推送的资源，没命中任何订阅时默认丢弃。管理员可以在插件设置「插件推送的资源」里打开「没命中订阅的资源也转存」，插件不需要额外写代码：

- 保存目录每行一个「网盘 + 目录」，可指定只收某个频道（对应条目的 `channel`），最多 20 行。按资源类型取第一个能接收它的目录：先找指定了本频道的行，再找没指定频道的行。
- 条目的 `channel` 只是你填的名字，Muvyo 会核对来源：链接出现在 `mv.telegram.read / search / page` 读给插件的这个频道的消息里，或出现在这些消息链接的网页里（插件随后用 `mv.fetch` 打开的正是消息里的那个网址，只认一层），或出现在频道公开网页版 `https://t.me/s/<频道>` 里，才算出自这个频道；`mv.telegram.botSearch` 返回的资源算出自 `@机器人用户名`。核对不上的资源只进没指定频道的行。所以 `channel` 请写频道的用户名（`@example`）、显示名或 `@机器人用户名`，二跳时打开消息里原样的网址。
- 认出作品的磁力存进 115 时，和订阅一样先下到磁链隔离目录，按真实文件核对是这部作品后才挪进保存目录（需要管理员打开「磁链自动订阅」）。
- 作品用 TMDB 认：帖子写明 TMDB ID 且片名对得上就用它，否则按片名与年份搜索，片名一致才算；认不出不转。
- 媒体库已有的电影跳过，剧集只转缺的集；同一作品 3 小时内不重复转存。打开「库里已有时比较质量」后，明显优于库内每个版本的才转存，交给整理时的洗版替换。
- 某一行打开「不识别，直接离线」后，TMDB 确认认不出的磁力、电驴、分享链接原样转存或离线到这一行：按链接去重并记下 180 天，重启后也不重复提交；每批合计有条数上限（默认 20）；结果不确定不自动重放。TMDB 请求失败或帖子写的 TMDB ID 对不上时不直接离线。
- 受 Muvyo「搜到资源后自动转存」开关约束；每条转存前复核插件仍可用、仍获准推送、这项设置仍打开。

---

## tasks 定时任务

插件可以声明定时任务，Muvyo 按管理员设置的时间调用 `scheduledTask`。安装后默认不开，管理员在插件设置里打开。

### 声明

```json
"capabilities": {
  "tasks": [
    {"id": "live", "title": "监听频道", "description": "读取新消息并推送给订阅", "interval_minutes": 10}
  ]
}
```

| 字段 | 说明 |
|---|---|
| `id` | 字母开头，字母、数字、下划线，≤ 40 字符，不能重复 |
| `title` / `description` | 显示名（≤ 40 字）/ 说明（≤ 500 字） |
| `interval_minutes` | 默认间隔，5–10080 分钟（`watch` 最短 2 分钟）；管理员还可以改成每天固定时刻或时段内随机 |
| `kind` | `general`（默认）、`checkin` 或 `watch`：签到类默认每天固定时刻执行，结果推送到「签到」通知；监听类用来读 Telegram 频道新消息推送给订阅，要在 `permissions.muvyo` 里声明 `telegram.channel` |
| `retries` | 失败后隔 1 小时重试几次，0–3，默认 0；只有重复执行没有副作用时才声明 |

最多 8 个任务。只声明任务、不声明其它能力也可以。

### scheduledTask({ task })

`task` 为任务 `id`；监听类任务另带 `subscription_window_open`（订阅设置的允许执行时段此刻是否开放）。管理员在任务设置里打开「遵守订阅允许时段」后，时段外 Muvyo 直接不运行监听类任务，插件不读频道、读取起点不前进，回到时段内接着读。可以返回 `{ ok, message }`：`ok` 为 `false` 记为失败，`message` 作为结果说明（签到类任务也是通知正文）。抛出异常同样记为失败。

- 同一插件同一时间只执行一个任务，不补跑错过的时间。
- 每次调用的时限、联网上限照常（见 [运行环境](runtime.md#限制)），要处理的量大时分几次做，把进度存进 `mv.storage`。

示例见 [examples/channel-push-demo](../examples/channel-push-demo/)。

---

## account 账号信息

在插件设置页顶部只读显示几行账号情况，例如会员状态、到期时间、积分、授权状态、最近一次签到。只能和其它能力一起声明。

### 声明

```json
"capabilities": {
  "account": {"title": "会员"}
}
```

`title` 可省略，默认「账号信息」，≤ 10 字。

### accountInfo()

不带参数，返回：

```js
function accountInfo() {
  return {
    items: [
      { label: '会员', value: 'VIP', tone: 'ok' },
      { label: '到期', value: '2026-12-31' },
      { label: '积分', value: 42 },
    ],
    note: '积分在签到后更新',
  };
}
```

| 字段 | 说明 |
|---|---|
| `items` | 必填数组，最多 12 行；没有 `label` 的行丢弃 |
| `label` | ≤ 20 字，纯文本 |
| `value` | ≤ 200 字；字符串、数字或布尔值（显示成「是 / 否」），其它类型显示为空 |
| `tone` | `ok` / `warn` / `error` 决定颜色，其它值忽略 |
| `note` | 可选，≤ 300 字，显示在最下面 |

- 文字去掉 HTML 标签与网址；配置里 `secret` 字段的值、看着像令牌的长串（24 位以上的字母数字）显示成 `***`。
- 结果缓存 5 分钟；管理员点「刷新」、保存设置或清除插件数据后重新调用。抛出异常时设置页显示失败原因，不缓存。
- 调用和其它函数一样受授权、启停、时限与联网范围限制。需要联网查询时注意对方接口的频率限制；也可以只读 `mv.storage` 里自己记下的状态（例如最近一次签到结果），不联网。

---

## mascot 慕慕形象

替换 Muvyo 慕慕 AI 助手的**名字**和 / 或**立绘**。慕慕的能力、权限和对话方式都不变。不需要写任何函数，也不需要联网权限：名字和图片都在清单与插件包里，和代码一起签名。需要 Muvyo 3.11.1 或更新版本。

管理员安装并启用插件后，要到「设置中心 → 插件 → 慕慕 AI 助手」的「慕慕」区块，把「慕慕形象」选成你的插件才生效。所有管理员看到的是同一个形象。插件被停用、删除、授权失效或被官方停用时，界面和 AI 的自称都自动回到官方慕慕。

### 声明

```json
"capabilities": {
  "mascot": {
    "name": "小橘",
    "frames": {
      "idle": "mascot-idle.png",
      "idle_blink": "mascot-blink.png",
      "idle_talk": "mascot-talk.png",
      "waveA": "mascot-wave.png"
    }
  }
}
```

`name` 和 `frames` 至少给一个：

- **只给 `name`**：界面沿用官方立绘，只改名字。
- **只给 `frames`**：仍叫慕慕。

### name 名字

- 1–12 个字，只能用汉字、字母、数字、空格、间隔号 `·` 与短横线 `-`。下划线和标点不行。
- 名字会显示在对话框标题、开场白和各处提示文字里。AI 回复时也用这个名字自称：系统提示词里的「你是慕慕」会换成「你是小橘」，所以名字限制得很严。

### frames 立绘

按动作给出包内图片的文件名。可用的动作，以及缺失时依次改用的动作：

| 动作 | 用途 | 缺失时改用 |
|---|---|---|
| `idle` | 待机（**必填**），也用作对话框头像 | — |
| `idle_blink` | 眨眼 | `idle` |
| `idle_talk` | 说话 | `idle` |
| `look_left` | 看左边 | `idle` |
| `look_upleft` | 看左上 | `look_left` → `idle` |
| `look_right` | 看右边 | `idle` |
| `waveA` / `waveB` | 挥手的两帧 | 另一帧 → `idle` |
| `point_left` | 指向左边（带路时） | `look_left` → `idle` |
| `popcorn` | 吃爆米花（闲置时） | `sitsmile` → `idle` |
| `thumbs` | 点赞（完成时） | `waveA` → `waveB` → `idle` |
| `jump` | 跳起 | `idle` |
| `crouch` | 蹲下 | `sitsmile` → `idle` |
| `sitsmile` | 坐着笑 | `idle` |

- 每张都是插件目录内的静态 PNG 或 WebP。文件名仅限英文字母、数字、短横线、下划线，首字符为字母或数字，扩展名小写。不接受外部地址、子目录、SVG、GIF 或动画；扩展名必须与实际格式一致。
- 单张不超过 512 KiB、宽高各不超过 2048 像素。每个动作用不同的文件，不能与入口文件、图标、`README.md` 同名。整个插件包不超过 8 MiB。
- Muvyo 验签后把每张放进 320×480 的透明画布（等比缩放、底边居中），重新编码为 WebP，并去掉附加数据与元信息。所以建议直接按 320×480、透明背景制作，人物脚底贴着画面下沿，各动作用同一比例，切换时才不会跳动。
- 图片与清单、代码一起纳入作者签名，签名后不能直接替换图片。带立绘签名需要 `pip3 install cryptography Pillow`，并使用新版签名脚本：从新版 Muvyo 的「第三方插件 → 开发者」下载，或使用本仓库根目录的 `mv_addon.py`。
- 插件包必须有一个入口文件。只做形象的插件可以放一个空的 `main.js`。

示例见 [examples/mascot-demo](../examples/mascot-demo/)。
