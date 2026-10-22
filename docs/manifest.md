# manifest.json

插件信息、联网权限、配置项和能力声明。字段写错或出现未知字段都会拒绝安装。所有文字字段不能含控制字符，除 `description` 外不能换行。

## 完整示例

```json
{
  "api": 1,
  "id": "alice.search",
  "name": "示例搜索",
  "version": "1.0.0",
  "author": "alice",
  "description": "搜索示例站点的网盘分享。",
  "entry": "main.js",
  "permissions": {
    "domains": ["api.example.com", "*.example.com"]
  },
  "config": [
    {"key": "token", "label": "访问令牌", "type": "secret", "required": true, "help": "在示例站点个人中心获取"},
    {"key": "size", "label": "每次条数", "type": "number", "min": 1, "max": 50, "step": 1, "unit": "条", "default": "20"}
  ],
  "settings": {
    "description": "示例站点的说明文字，会显示在插件设置页顶部。",
    "links": [{"title": "获取令牌", "url": "https://example.com/token"}],
    "sections": [
      {"title": "账号", "fields": ["token"]},
      {"title": "结果", "description": "条数越多越慢。", "fields": ["size"]}
    ]
  },
  "capabilities": {
    "search": {"link_types": ["115", "magnet"], "supports_tmdb": false, "resolve": false}
  }
}
```

## 顶层字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `api` | 是 | 插件接口版本，目前只能是 `1` |
| `id` | 是 | 插件 ID：小写字母、数字、点、短横线，4–64 个字符；**必须以 `命名空间.` 开头** |
| `name` | 是 | 显示名称，1–40 字 |
| `version` | 是 | 版本号，格式 `1.2.3`；更新时要变大 |
| `author` | 否 | 作者显示名，≤ 60 字（真正的作者身份以证书为准） |
| `description` | 否 | 简介，≤ 500 字，可换行 |
| `release_notes` | 否 | 这一版的更新说明，≤ 5000 字 |
| `min_mv_version` | 否 | 需要的最低 Muvyo 版本，例如 `3.14.0`；版本不够时拒绝安装并提示先升级 Muvyo |
| `entry` | 否 | 入口文件名，默认 `main.js`，只能是 `xxx.js` |
| `icon` | 否 | 包内静态 PNG / JPEG / WebP 文件名，例如 `icon.png`；需要支持图标的新版本 Muvyo，v3.9.9 不支持 |
| `permissions` | 否 | 联网权限与使用 Muvyo 的服务，见下 |
| `config` | 否 | 配置项，最多 30 个，见下 |
| `settings` | 否 | 设置页的说明、链接与分组，见下 |
| `capabilities` | 是 | 至少声明一种能力，见 [capabilities.md](capabilities.md)；`mascot` 的立绘也是包内图片，规则见 [mascot 慕慕形象](capabilities.md#mascot-慕慕形象) |

## icon 插件图标

在插件目录放入图片，并在 `manifest.json` 添加 `"icon": "icon.png"`。使用支持图标的新版本签名脚本重新签名、发布；图标与清单一起纳入作者签名，不能在签名后直接替换图片。

带图标签名需要 `cryptography` 和 `Pillow`：`pip3 install cryptography Pillow`。从新版 Muvyo 的「第三方插件 → 开发者」重新下载签名脚本，旧脚本不会把图标纳入发布文件。

- 文件名仅限英文字母、数字、短横线、下划线，首字符为字母或数字，扩展名为小写 `.png`、`.jpg`、`.jpeg` 或 `.webp`。
- 单张不超过 256 KiB，宽高各不超过 1024 像素；只支持静态图片。
- 不接受外部 URL、子目录、SVG、GIF 或动画。扩展名必须与实际图片格式相符。
- Muvyo 验签后重新编码为最长边 128 像素的 PNG，移除附加数据与元信息。仓库列表、安装确认和已安装插件使用该图标，浏览器不直连作者图片地址。
- 未声明图标时继续显示文字头像；仓库图标预览获取失败时也回退文字头像，不阻止检查安装。安装包声明的图标缺失、损坏或不合规时，仍拒绝安装。
- 更新时增加插件版本并重新签名。新版本移除 `icon` 声明后，已安装卡片恢复文字头像。

## permissions 联网权限

```json
"permissions": {
  "domains": ["api.example.com", "*.cdn.example.com", "http://legacy.example.com", "api.example.com:8443"],
  "service": {"label": "内容服务地址", "help": "你自己部署的服务，例如 http://192.168.1.10:8788"}
}
```

- `domains`：插件能访问的域名，最多 30 条。
  - 默认只允许 https 与默认端口；要用 http 写成 `http://域名`，非默认端口写 `域名:端口`。
  - `*.example.com` 只匹配子域名，不含 `example.com` 本身。
  - 不能直接访问 IP 地址；域名解析到内网、本机的地址会被拒绝。
  - 安装时管理员会看到这份清单并确认，插件只能访问确认过的域名。
  - **不能申请网盘和 Muvyo 的域名**：115、123 云盘、阿里云盘、百度网盘、夸克、天翼云盘、移动云盘、迅雷、光鸭，以及 `muvyo.com`；写了就装不上（`*.baidu.com` 这类覆盖到它们的通配同样不行）。查分享有效性请用 Muvyo 服务 `share.inspect`。用户的媒体服务器外网域名、Vyo 对外地址等 Muvyo 已接入的地址，即使写进清单运行时也访问不到。
- `service`：插件需要用户提供一个服务地址时声明（例如用户自己部署的服务）。用户在插件设置里填写后，这个地址也在可访问范围内，代码里用 `mv.service` 读取。公网地址必须是 https；内网地址直接可填，保存时固定解析出的地址。
  - 地址带路径时只能访问这段路径之下。
  - 不能填 Muvyo 自己的端口，也不能填 Muvyo 已接入的媒体服务器、下载器、HTTP 代理、FlareSolverr 等服务的地址；FlareSolverr 这类能替插件访问任意网址的服务，即使单独部署也不能作为服务地址。
- `flaresolverr`：插件要经 FlareSolverr 打开有 Cloudflare 验证的网页时声明，写 `{}` 或 `{"help": "说明文字（≤300 字）"}`。用户在插件设置里填 FlareSolverr 地址，插件用 [`mv.flaresolverr`](runtime.md#mvflaresolverr) 请 Muvyo 代为打开，插件本身连不到 FlareSolverr。
- `tls_pins`：要连接使用自签证书的服务器时声明（例如自建的中转），最多 5 条，每条 `{"host": "relay.example.com", "sha256": "证书 SHA-256"}`。主机必须写在 `domains` 里（https，不能是通配）；`sha256` 是服务器证书 DER 编码的 SHA-256（64 位十六进制，可带冒号，`openssl x509 -noout -fingerprint -sha256` 的输出）。这些主机不按 CA 校验，只认这张证书，对不上在发出请求前断开；服务器换了证书就要发新版本。确认安装窗口会列出固定的证书。

## permissions.muvyo 使用 Muvyo 的服务

插件可以请 Muvyo 用用户已经配好的实例办事，不需要用户再给插件填写这些账号。

```json
"permissions": {
  "domains": [],
  "muvyo": ["library.lookup", "telegram.channel", "subscription.push", "telegram.botsearch"],
  "telegram_bots": ["example_bot"]
}
```

| 可选值 | 用途 |
|---|---|
| `library.lookup` | 按 TMDB 编号查询媒体库 |
| `telegram.channel` | 用用户登录的 Telegram 账号读取频道和群组：列出管理员勾选的私有会话、读新消息、按关键词找、往前翻页 |
| `subscription.push` | 把找到的资源交给订阅；管理员可另外打开「没命中订阅的资源也转存」 |
| `telegram.botsearch` | 用用户的 Telegram 账号向搜索机器人查资源（只读历史回复、发查询、inline 查询） |
| `share.inspect` | 读取网盘分享是否有效与第一页文件信息，不转存 |
| `telegram.bot` | 用用户的 Telegram 账号给 `telegram_bots` 里的机器人发消息并读回复（签到、查余额） |
| `tmdb.search` | 用用户配置的 TMDB 按关键词识别作品，只返回编号、类型、片名、年份 |

- `muvyo` 可省略，默认空数组；只声明实际需要的服务。未知名称或重复项都会拒绝安装。
- **`telegram.search` 已下线**：旧包里的这项声明安装时忽略，不报错，也不会获得授权；需要读频道请改用 `telegram.channel`。注意 `mv.telegram.search` 这个名字现在属于 `telegram.channel`，参数完全不同，见 [运行环境](runtime.md#mvtelegramsearchchannel-keyword-limit)。
- `telegram_bots`：最多 5 个机器人用户名，以 `bot` 结尾，不带 `@`。
  - 用 `telegram.bot` 必须列出能发消息的机器人。
  - 用 `telegram.botsearch` 时可以列出搜索机器人，也可以不列，由管理员在插件设置「可用的搜索机器人」里添加（最多 10 个）。插件能用的机器人 = `telegram_bots` ∪ 管理员添加的。
  - 列了机器人，却既没声明 `telegram.bot` 也没声明 `telegram.botsearch`，会拒绝安装。确认安装窗口会列出这些机器人，更新新增的标为「新增」。
- `subscription.push` 要求插件同时声明 [`search` 能力](capabilities.md#search-资源搜索)：推送的条目按搜索结果同一套格式校验。
- `telegram.channel` 读私有频道和群组前，管理员要在插件设置「可读取的频道和群组」里勾选（最多 50 个）；公开频道和公开超级群按用户名读，不用勾选。
- 声明不等于授权。管理员在安装确认窗口的「使用 Muvyo 的服务」确认后才生效，运行时用 `mv.can(name)` 判断。
- 更新新增的服务会标为「新增」，必须确认更新后才能使用；确认前仍只有原来的授权。新版本不再声明的服务随更新收回。
- 服务授权与 `domains` / `service` 的联网权限分别声明；获得服务授权不代表能直接访问 Muvyo 的账号接口。
- **兼容性：旧版 Muvyo 会拒绝安装声明了 `permissions.muvyo` 的插件**，也认不出新加的服务名。`telegram.channel`、`subscription.push`、`telegram.botsearch` 从 Muvyo 3.13.0 开始提供，用到时写上 `"min_mv_version": "3.13.0"`。在代码里检测 `mv.can` 不能绕过安装校验。

参数、结果与用量见 [运行环境：使用 Muvyo 的服务](runtime.md#使用-muvyo-的服务)，完整示例见 [已入库标记搜索](../examples/library-badge-demo/) 与 [频道推送](../examples/channel-push-demo/)。

## config 配置项

用户在插件设置页填写，代码里通过 `mv.config.<key>` 读取。

| 字段 | 说明 |
|---|---|
| `key` | 字母开头，字母、数字、下划线，≤ 40 字符，不能重复 |
| `label` | 显示名，1–40 字 |
| `type` | `text`（默认）、`secret`、`select`、`multiselect`、`bool`、`number`、`textarea`、`url` |
| `required` | 是否必填 |
| `default` | 默认值（字符串，≤ 500 字） |
| `help` | 说明文字，≤ 300 字 |
| `placeholder` | 输入框占位文字，≤ 100 字 |
| `options` | `select` / `multiselect` 必填：`[{"value": "cn", "label": "中国"}]`，最多 50 项 |
| `min` / `max` / `step` / `unit` | `number` 的范围、步长、单位（单位 ≤ 10 字） |
| `multiline` | 仅 `secret`：设为 `true` 后可以换行（整段 Cookie、多行令牌），界面仍不回显已保存的值 |
| `width` | 设置页两列排布时占一列（`"half"`）还是整行（`"full"`），不写按类型决定，见 [设置页排版](#设置页排版左右布局) |

在代码里读到的值类型：

| type | `mv.config` 里的值 |
|---|---|
| `bool` | `true` / `false` |
| `number` | 数字 |
| `multiselect` | 字符串数组 |
| 其它 | 字符串（`textarea` 与 `multiline` 的 `secret` 可含换行，其余单行） |

长度上限：`secret` 16 KB，`textarea` 5000 字，其余 2000 字。

`secret` 类型保存后不会再回显给任何人，适合放用户的令牌、密码、Cookie。要放长 Cookie 请用 `secret`（必要时加 `multiline`），不要用 `textarea`——`textarea` 的值会在设置页明文显示。

- 新版本把一个原来是 `secret` 的字段改成别的类型时，更新后这个字段已保存的值会被清掉，用户需要重新填写（确认更新窗口会提示）。
- 用户不能把 Muvyo 已经保存的凭据（网盘 Cookie、媒体服务器 API Key 等）填进插件配置，保存时会被拒绝。需要网盘或媒体库信息请用 [Muvyo 服务](#permissionsmuvyo-使用-muvyo-的服务)。

## settings 设置页

只做展示，纯文本渲染，不执行代码。

| 字段 | 说明 |
|---|---|
| `description` | 顶部说明，≤ 1500 字，可换行 |
| `links` | 相关链接，最多 5 个，只能是 https：`{"title": "官网", "url": "https://..."}` |
| `columns` | 各分组默认排几列：`1` 或 `2`（不写为 2），也管没放进分组的「其它设置」 |
| `sections` | 分组，最多 10 个：`{"title", "description", "fields": [配置项 key...], "columns"}`；每个配置项只能放进一个分组，没放进分组的显示在最后。`columns` 可选，只管这一组 |

### 设置页排版（左右布局）

第三方插件的设置窗口和 Muvyo 内置插件一样宽，排版也用同一套栅格：

- **电脑上左右两列**：每个分组是一块卡片，卡片够宽时里面的配置项两个一行。
- **手机上一行一个**：窗口变窄（卡片不到约 36 字宽）时自动变成单列，不用另外声明。
- Muvyo 自带的区块（连接设置、运行设置、定时任务、已授权网站、可读取的频道等）按同样规则排好，插件管不了也不用管。

不写任何布局声明时按类型排：

| 类型 | 默认占位 |
|---|---|
| `text`、`secret`、`select`、`number`、`url`、`bool` | 一列（两个一行） |
| `textarea`、`multiselect`、带 `multiline` 的 `secret` | 整行 |

需要调整时，在 manifest 里加这几项（只影响显示，Muvyo 不执行插件代码；取值不对会被拒绝安装）：

| 写在哪 | 字段 | 取值 | 作用 |
|---|---|---|---|
| `config[]` | `width` | `"half"` / `"full"` | 这一项占一列还是整行，覆盖按类型的默认 |
| `settings` | `columns` | `1` / `2` | 所有分组默认排几列 |
| `settings.sections[]` | `columns` | `1` / `2` | 只管这一组，优先于 `settings.columns` |

- `columns: 1` 时这一组一行一个，`width` 不起作用；`columns: 2`（默认）时 `width` 才有意义。
- 只认整数 `1`、`2` 和字符串 `"half"`、`"full"`：写成 `3`、`"2"`、`true`、`"wide"` 都会被拒绝。
- 一行剩一个空位很正常（例如一组只有三个短项），不必为了填满硬凑字段；放不下的长文本用 `"full"`。
- 旧版 Muvyo 认不出这几个字段，会拒绝安装。用到时写上 `min_mv_version`，填支持设置页排版的 Muvyo 版本（以 Muvyo 发版说明为准）。

示例：

```json
{
  "config": [
    {"key": "user", "label": "用户名", "type": "text"},
    {"key": "password", "label": "密码", "type": "secret"},
    {"key": "cookie", "label": "Cookie", "type": "secret", "multiline": true},
    {"key": "vip_only", "label": "只取会员资源", "type": "bool"},
    {"key": "signature", "label": "签名", "type": "text", "width": "full"},
    {"key": "channels", "label": "推送频道", "type": "multiselect", "width": "half",
     "options": [{"value": "a", "label": "甲"}, {"value": "b", "label": "乙"}]},
    {"key": "template", "label": "推送模板", "type": "textarea"}
  ],
  "settings": {
    "columns": 2,
    "sections": [
      {"title": "账号", "fields": ["user", "password", "cookie", "vip_only", "signature"]},
      {"title": "推送", "fields": ["channels", "template"], "columns": 1}
    ]
  }
}
```

电脑上看到的样子：

```
┌ 账号 ─────────────────────────────────────────────┐
│ 用户名 [            ]      密码 [            ]      │
│ Cookie [                                        ]  │  ← multiline 密钥默认整行
│ 只取会员资源 (○)                                    │  ← 下一项是整行，这一行右边留空
│ 签名 [                                          ]  │  ← width: "full"
└───────────────────────────────────────────────────┘
┌ 推送 ─────────────────────────────────────────────┐
│ 推送频道 [甲] [乙]                                  │  ← columns: 1，一行一个
│ 推送模板 [                                      ]  │
└───────────────────────────────────────────────────┘
```

手机上两组都是一行一个。想让开关和短输入并排，就把它们在 `fields` 里挨着放。

## capabilities

见 [capabilities.md](capabilities.md)。
