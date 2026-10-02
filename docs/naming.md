# naming 整理命名

> 待发布能力：需要支持 `naming` 与 `mv.render` 的 Muvyo，新协议不适用于旧版。本文对应当前开发实现，不承诺旧版本兼容。源码示例见 [naming-demo](../examples/naming-demo/)。

## 声明与入口

```json
"capabilities": {"naming": {"media_types": ["movie", "tv"]}}
```

入口为全局 `function naming(context)`。每次处理一个文件，每个命名方案选择一个插件。可与其他能力共存，但命名调用始终禁止联网与持久存储。

## 只读输入

`context` 包含：

- `media_type`、`tmdb_id`、`title`、`original_title`、`year`、`season`、`episodes`（全部集号数组）、`part`（无分卷为 0）。
- `source_name`：不带目录的原文件名。
- `template`：本次原模板；`rendered`：内置命名相对路径；`category`：二级分类。
- `vars`：原模板变量，包含 `title/original_title/name/en_name/year/tmdbid/season/episode/season_episode/resolution/videoFormat/resourceType/videoCodec/audioCodec/releaseGroup/part/effect/edition/customization/webSource/episode_title/fileExt`。不含 `original_name` 或源目录。

输入递归冻结，不可修改。没有完整源路径、目标根目录或 Muvyo 配置。

## 返回值

| 返回 | 含义 |
|---|---|
| `null` | 明确不修改，沿用内置结果 |
| `{vars: {audioCodec: "TrueHD.7.1"}}` | 合并展示变量，用原模板重新渲染 |
| `{template: "{{name}}{{fileExt}}"}` | 用原变量渲染新模板（此示例只适合无分卷电影） |
| `{template: "...", vars: {...}}` | 同时修改模板和展示变量 |
| `{rendered: "电影/示例电影.mkv"}` | 直接返回最终相对路径 |

`rendered` 不能与 `template/vars` 混用，多余字段拒绝。失败停止当前文件，不静默回退；只有明确返回 `null` 才沿用内置结果。

返回的 `vars` 至多 32 项，每项最多 1024 字符，只允许展示文字，可增加简单变量名。不能覆盖作品身份、类型、年份、季集、多集范围、分卷、扩展名或原文件名；不得包含路径、地址、凭据字段、控制字符、数组或对象。

## 配置与运行权限

`mv.config` 只提供插件自己声明并校验过的非敏感设置，例如分隔符、字段选择、模板文本。`secret`、URL、服务地址、凭据命名字段和未知字段均不提供。

`mv.service` 为空，`mv.fetch` 与 `mv.storage.get/set/remove` 全部拒绝，包括同时声明搜索等能力的插件在命名调用期间。其他能力调用仍按自身权限运行。

每次命名总时限 3 秒；输入、返回、安全配置各最多 16 KiB。不支持 `renameFiles`、插件链、`upstream`、`post_replace` 或 `mv.words`，不开放 Python 正则或通用 Jinja2 执行。

## mv.render(template, vars)

由 Muvyo 主进程用有界模板渲染器计算并校验相对路径。参数可省略；`template` 传 `undefined` 沿用原模板，`vars` 合并展示变量。每次命名最多调用 4 次，计入同一个 3 秒时限。插件可以对返回字符串做 JavaScript 正则替换，再返回 `{rendered}`，最终仍会再次校验。

模板不是完整 Jinja2：最多 4096 字符、512 个 AST 节点、嵌套深度 16。

- 支持文本、`{{变量}}`、`if/elif/else`、`and/or/not` 和标量比较。
- 过滤器：`lower`、`upper`、`title`、`trim`（无参数）；`default('兜底', true)`；`replace('原文', '替换', 次数)`。
- 过滤器参数只能是字面常量；`default` 参数可省略；`replace` 次数可省略且最大 4096。
- 禁止循环、函数调用、属性/下标访问、容器、算术、赋值、宏、导入、包含和继承；不支持 `format/attr` 等其他过滤器。
- 原模板也受同一限制，不支持的语法会拒绝，不回退通用 Jinja2。

## 最终路径

必须是相对路径：至多 12 层目录，每段最多 240 UTF-8 字节，完整路径最多 1024 字节。禁止绝对路径、`.` / `..`、控制字符、系统保留名称与首尾空格。

扩展名原样保留；剧集保留季集标识（如 `S01E01`，多集 `S01E01-E03` 或 `S01E01E03`），分卷保留 `part1` 等标识，不能增加、删除或变更身份。插件只提出命名结果，不负责移动、覆盖或删除文件。
