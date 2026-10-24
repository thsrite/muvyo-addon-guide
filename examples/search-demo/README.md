# 示例搜索与账号信息

演示查询上下文（`purpose`、`year`、`link_types`、订阅 `filters`）、TMDB 搜索、`modes: ["completed"]` 完结剧集、两页搜索、剩余执行时间提前收尾、按请求代理与超时、限流等待，以及账号信息。

权限：`permissions.service` 允许管理员填写自己的服务地址；`domains: []`，不需要 `permissions.muvyo`。`proxy: true` 请求使用管理员配置的系统代理，没有代理时直连，不扩大网络授权。`timeout: 4` 限制单次请求总时长为 4 秒。

基础能力最低支持版本：Muvyo 3.13.0。种子文件是新增能力，须配合包含种子接入改动的 Muvyo 使用；尚未发布版本号，不将 3.13.0 视为支持种子的承诺。旧版使用此示例时，从 `link_types` 移除 `torrent`，并让服务只返回其余类型。

## 教学服务协议

安装后填写自建服务地址（占位 `https://example.com`），可选填写服务密钥。所有接口均为教学约定，不是现成公共服务。

`POST /search` 与 `POST /completed` 接收查询上下文、`size` 和 `page`。订阅的筛选交给服务预筛，平台收到后仍复核；结果按请求目标类型筛选，每条写明 `link_type`。完结入口即使关键词为空也请求 `/completed`。

响应示例（摘要、文件与磁力均为占位数据，不可用于真实转存）：

```json
{
  "list": [
    {"id":"example-magnet","name":"示例剧 S01E01","type":"magnet","link":"magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=example","channel":"example"},
    {"id":"example-torrent","name":"示例剧 S01E02","type":"torrent","torrent":{"url":"https://example.com/download/2.torrent","headers":{"Authorization":"Bearer example-token"}},"channel":"example","season":1,"episodes":[2]},
    {"id":"example-rapid","name":"示例剧 S01E01","type":"123pan","rapid_links":"123FSLinkV2$0123456789abcdef0123456789abcdef#1024#示例剧/S01E01.mkv","channel":"example","season":1,"episodes":[1]},
    {"id":"example-pending","name":"示例剧 待获取","type":"magnet","token":"example-token","cost":2,"channel":"example"}
  ],
  "more": false
}
```

`channel` 标记来源；`rapid_links` 只用于 123 秒传。待获取条目使用稳定 `id`，不要把查询条件的身份冒充资源身份。搜索最多两页；剩余时间不足或来源失败时保留已有条目并返回 `partial: true`。只读搜索遇到 429 用 `mv.sleep(1000)` 等一秒，仅重试一次，禁止忙等。

`POST /resolve` 接收 `{token}`，成功返回 `magnets`、`rapid_links` 或 `torrent`。示例服务须明确保证 401、429、404、402 均没有执行扣分，才能如此分类：

| 情形 | 返回的结构化错误 |
|---|---|
| 404 资源失效、402 积分不足，确定没扣分 | `{error:{kind:'rejected',message:'…'}}` |
| 请求后超时、网关失败、解析失败、响应缺链接，可能已扣分 | `{error:{kind:'uncertain',message:'…'}}` |
| 401 授权失效、429 限流，确定本次没扣分 | `{error:{kind:'source',message:'…'}}` |

购买请求不自动重试；若真实服务不能保证没扣分，必须归为 `uncertain`，不能仅凭状态码判断。**不写 `kind` 的失败，付费资源按 `uncertain`、免费资源按 `rejected` 处理。**

`accountInfo()` 不联网，返回三行占位账号信息，演示 `ok`、`warn`、`error` 三种 `tone` 与底部 `note`。真实插件可查询自己的账号服务，不能展示凭据。

保留设置页布局声明：`settings.columns: 2`，密钥与每次条数在电脑上并排、手机上纵排。订阅自动搜索默认关闭，需要管理员启用。

## 种子文件交给下载器

`torrent` 的结构为 `{url, headers}`，也可在 `resolve` 时才返回。`url` 必须是完整 HTTP(S) 地址，GET 后返回原始 `.torrent` 二进制，不能是详情页或登录页；`headers` 可省略，需要认证时只放插件自身的 Cookie、Authorization 等请求头。下载域名要在安装时确认的联网范围内，或属于管理员填写的服务地址；跨域跳转不会转发 Cookie / Authorization。

Muvyo 不在搜索时下载种子。用户在搜索卡片点「下载种子交给 BT 下载器」，或订阅确定选中后，Muvyo 才取回种子、校验并上传给 qBittorrent（aria2 同样支持），沿用任务进度与下载后上传流程。需要启用 BT 下载器及对应的资源搜索 / 订阅开关，并为目标网盘设置保存目录。种子始终走本地 BT 下载器，包括目标为 115 / 123 时；已有磁力链接的选路不变。

支持 BT v1 与混合种子，最大 4 MiB，保留原始种子、私有标志及 tracker 信息；暂不支持纯 BT v2。浏览器只得到绑定当前用户的一小时有效凭据，地址和请求头不发到前端、不写入任务台账。重启、插件更新或设置变更后重新搜索。付费获取后的凭据失效不会触发自动重复购买，应人工核对后处理。

不要把种子转换为只有哈希的磁力再交给 Muvyo，也不要用文本响应 `mv.fetch(...).body` 转交二进制种子。

## 种子示例兼容性说明

仅接入本次新增的种子文件下载时，建议从 [torrent-demo](../torrent-demo/) 开始。它只依赖基础宿主接口；本综合示例还使用账号信息、请求预算等接口，需要主程序同时支持这些能力。种子能力尚未发布正式支持版本，不能仅凭本示例的最低版本声明判断可用。
