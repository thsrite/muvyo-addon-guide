# 能力与接口

在 manifest 的 `capabilities` 里声明能力，在入口文件里实现对应的全局函数。每个函数收到一个参数对象，返回一个对象。

返回结果都会经过 Muvyo 校验：字段类型不对、超长、链接不合规的**单条结果会被丢弃**，不影响其它条目；整体格式不对（比如缺 `items` 数组）则这次调用失败。表里没列的多余字段会被忽略。

- [search 资源搜索](#search-资源搜索)
- [vlib 虚拟库片单](#vlib-虚拟库片单)
- [content 内容源](#content-内容源)
- [metadata 刮削来源](#metadata-刮削来源)
- [webhook 事件](#webhook-事件) — 接收 Muvyo 自己的事件，返回值被忽略
- [naming 整理命名（待发布）](naming.md) — 独立协议；返回对象或 `null`，未知字段拒绝，不适用上面的单条丢弃规则

除声明能力外，插件还可通过 `permissions.muvyo` 申请[使用 Muvyo 的服务](runtime.md#使用-muvyo-的服务)：查询媒体库、搜索 Telegram 频道、检查网盘分享，管理员确认后生效（命名调用不可用）。

---

## search 资源搜索

> 只能对接你或用户有权使用、分发内容的来源（例如用户自己部署的服务、公开授权的资源）。聚合未经授权的分享资源属于 [开发者协议与内容政策](policy.md) 禁止的插件。

插件作为一个搜索来源，出现在资源搜索、订阅自动搜索、机器人搜索里。用户可以在插件设置里决定它是否参与订阅搜索。

### 声明

```json
"capabilities": {
  "search": {
    "link_types": ["115", "magnet"],
    "supports_tmdb": false,
    "resolve": false,
    "resolve_cost": "none"
  }
}
```

| 字段 | 说明 |
|---|---|
| `link_types` | 会返回的资源类型：`115`、`123pan`、`baidupan`、`guangyapan`、`aliyundrive`、`magnet` |
| `supports_tmdb` | 能按 TMDB 编号精确搜索时设为 `true`，Muvyo 会把它的结果当作精确匹配 |
| `resolve` | 搜索结果先不给链接、用户选中后再换取链接时设为 `true`，并实现 `resolve` |
| `resolve_cost` | 来源站点自身是否按积分计费：`none` 或 `points` |

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
  limit: 50              // 建议返回的最大条数
}
```

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
      resolve_token: null,          // 需要换取链接时给一个令牌，此时可以不给 share_link
      cost: 0,                      // 来源站点自身对换取链接的计费（积分）
      size_bytes: 0,
      season: null,                 // 资源对应的季
      episodes: [],                 // 资源包含的集号
      tags: ["4K", "HDR"],          // 只取前 10 个
      published_at: "2026-09-01",   // ≤ 40 字
      poster: ""                    // 海报地址
    }
  ],
  partial: false   // 部分来源失败时设为 true，Muvyo 会提示「部分来源失败」
}
```

每条结果必须有可用的链接或 `resolve_token`，否则丢弃：`share_link` 要是对应网盘的分享地址，`magnets` 要是 `magnet:` 链接。最多取 200 条。

### resolve({ token })

声明了 `resolve: true` 才会调用。参数是搜索结果里的 `resolve_token`，返回：

```js
{ share_link: "https://...", share_code: "abcd", magnets: [] }
```

用户手动选中资源时调用；订阅自动转存时，只对积分不超过插件设置里「订阅自动获取链接的积分上限」的资源调用（默认 0，即只取免费资源）。

新装的插件默认不参与订阅的自动搜索与转存，管理员在插件设置里打开「参与订阅搜索」后才会参与。

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

插件提供作品列表、分集和播放地址，在「封面 & 虚拟库」里新建来源为「第三方插件内容」的虚拟库，就能在 Vyo 里浏览和播放（网页和 Emby 兼容客户端都能用）。视频和图片由 Muvyo 按插件的联网权限代为请求，所以**播放地址、封面地址的域名也要写进 `permissions.domains`**（或来自用户填的服务地址）。

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
  url: "https://video.example.com/v1001/1.mp4",
  headers: { "Referer": "https://example.com/" },   // 可选：取视频要带的请求头，≤ 20 个
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

`url` 可以是视频文件，也可以是 HLS 播放列表（`.m3u8`）。给播放列表时把 `media.container` 写成 `"m3u8"`，客户端才会按 HLS 打开。Muvyo 会读出播放列表，把里面的子播放列表、分片和解密密钥地址都换成 Muvyo 自己的转接地址，播放器只和 Muvyo 通信；取每一段时同样只能访问插件声明并经管理员确认的域名（或服务地址），`headers` 也会带上。限制：

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

图片只记下地址，展示时由 Muvyo 按插件的联网权限取回并缓存，所以图片域名也要写进 `permissions.domains`。取图请求头不能带 `Cookie`、`Authorization` 等凭据类头。

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
