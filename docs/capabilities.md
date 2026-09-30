# 能力与接口

在 manifest 的 `capabilities` 里声明能力，在入口文件里实现对应的全局函数。每个函数收到一个参数对象，返回一个对象。

返回结果都会经过 Muvyo 校验：字段类型不对、超长、链接不合规的**单条结果会被丢弃**，不影响其它条目；整体格式不对（比如缺 `items` 数组）则这次调用失败。表里没列的多余字段会被忽略。

- [search 资源搜索](#search-资源搜索)
- [vlib 虚拟库片单](#vlib-虚拟库片单)
- [content 内容源](#content-内容源)
- [metadata 刮削来源](#metadata-刮削来源)

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

### contentCategories({})

```js
{ categories: [ { id: "movie", title: "电影" }, { id: "series", title: "剧集" } ] }
```

最多 100 个；分类 ID 规则同作品 ID。管理员建内容库时可以选定一个分类。

### contentSearch({ keyword, page })

返回格式同 `contentList`。

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
