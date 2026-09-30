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
| `entry` | 否 | 入口文件名，默认 `main.js`，只能是 `xxx.js` |
| `permissions` | 否 | 联网权限，见下 |
| `config` | 否 | 配置项，最多 30 个，见下 |
| `settings` | 否 | 设置页的说明、链接与分组，见下 |
| `capabilities` | 是 | 至少声明一种能力，见 [capabilities.md](capabilities.md) |

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
- `service`：插件需要用户提供一个服务地址时声明（例如用户自己部署的服务）。用户在插件设置里填写后，这个地址也在可访问范围内，代码里用 `mv.service` 读取。公网地址必须是 https；内网地址需要管理员勾选「允许访问这个内网服务」。

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

在代码里读到的值类型：

| type | `mv.config` 里的值 |
|---|---|
| `bool` | `true` / `false` |
| `number` | 数字 |
| `multiselect` | 字符串数组 |
| 其它 | 字符串（`textarea` 可含换行，其余单行） |

`secret` 类型保存后不会再回显给任何人，适合放用户的令牌、密码。

## settings 设置页

只做展示，纯文本渲染，不执行代码。

| 字段 | 说明 |
|---|---|
| `description` | 顶部说明，≤ 1500 字，可换行 |
| `links` | 相关链接，最多 5 个，只能是 https：`{"title": "官网", "url": "https://..."}` |
| `sections` | 分组，最多 10 个：`{"title", "description", "fields": [配置项 key...]}`；每个配置项只能放进一个分组，没放进分组的显示在最后 |

## capabilities

见 [capabilities.md](capabilities.md)。
