# 示例

| 目录 | 插件 ID | 能力 | 说明 |
|---|---|---|---|
| [search-demo](search-demo/) | `alice.search` | search | 对接自建搜索服务，含 TMDB 精确搜索 |
| [vlib-demo](vlib-demo/) | `alice.picks` | vlib | 虚拟库片单，不联网，可以直接签名安装试用 |
| [content-demo](content-demo/) | `alice.content` | content | 连接自建内容服务，在 Vyo 里浏览播放 |
| [metadata-demo](metadata-demo/) | `alice.meta` | metadata | 刮削来源 |
| [naming-demo](naming-demo/) | `alice.naming` | naming（待发布） | 字段格式化、原模板渲染与 JS 正则替换；不操作文件 |
| [webhook-demo](webhook-demo/) | `alice.eventlog` | webhook | 记录整理、订阅、下载事件到日志，不联网 |

命名示例需要支持 `naming` 与 `mv.render` 的新版 Muvyo；主程序能力尚未发布，旧版不能安装使用。这里只提供未签名教学源码，不发布可安装插件。

使用时把示例文件夹复制到你插件仓库的 `src/` 下，改成 `src/<你的用户名>.picks` 这样的目录名，manifest 里的 `alice` 换成你的 GitHub 用户名（小写）、接口地址换成实际站点，然后在插件仓库根目录：

```sh
python3 mv_addon.py sign ./src/<你的用户名>.picks -o .
```

**推荐 `src/` 不要上传到 GitHub。** 本指南公开的是教学示例；你开发的插件源码放在本地 `src/`，使用 [模板的 .gitignore](../template/.gitignore) 忽略即可。本地可以同时有 `src/` 和 `plugins/`，无需额外维护分支或拆分仓库。

按 [发布说明](../docs/publishing.md#仓库签名) 完成仓库索引签名后，只提交 `index.json`、`index.json.sig` 和 `plugins/` 下的加密签名产物，不提交源码、签名凭据或私钥。被忽略的源码没有这个仓库的 Git 历史，也不会备份到 GitHub，请自行备份。

注意：`.gitignore` 对已被 Git 跟踪的源码无效；从当前版本删除源码也不会清除历史提交。已经公开过的源码，不能靠补忽略规则变回私密。
