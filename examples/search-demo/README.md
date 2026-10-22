# 示例搜索与账号信息

演示查询上下文（`purpose`、`year`、`link_types`、订阅 `filters`）、TMDB 搜索、`modes: ["completed"]` 完结剧集、两页搜索、剩余执行时间提前收尾、按请求代理与超时、限流等待，以及账号信息。

权限：`permissions.service` 允许管理员填写自己的服务地址；`domains: []`，不需要 `permissions.muvyo`。`proxy: true` 请求使用管理员配置的系统代理，没有代理时直连，不扩大网络授权。`timeout: 4` 限制单次请求总时长为 4 秒。

最低支持版本：Muvyo 3.13.0，manifest 已写 `min_mv_version: "3.13.0"`；更早的版本会拒绝安装。

## 教学服务协议

安装后填写自建服务地址（占位 `https://example.com`），可选填写服务密钥。所有接口均为教学约定，不是现成公共服务。

`POST /search` 与 `POST /completed` 接收查询上下文、`size` 和 `page`。订阅的筛选交给服务预筛，平台收到后仍复核；结果按请求目标类型筛选，每条写明 `link_type`。完结入口即使关键词为空也请求 `/completed`。

响应示例（摘要、文件与磁力均为占位数据，不可用于真实转存）：

```json
{
  "list": [
    {"id":"example-magnet","name":"示例剧 S01E01","type":"magnet","link":"magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=example","channel":"example"},
    {"id":"example-rapid","name":"示例剧 S01E01","type":"123pan","rapid_links":"123FSLinkV2$0123456789abcdef0123456789abcdef#1024#示例剧/S01E01.mkv","channel":"example","season":1,"episodes":[1]},
    {"id":"example-pending","name":"示例剧 待获取","type":"magnet","token":"example-token","cost":2,"channel":"example"}
  ],
  "more": false
}
```

`channel` 标记来源；`rapid_links` 只用于 123 秒传。待获取条目使用稳定 `id`，不要把查询条件的身份冒充资源身份。搜索最多两页；剩余时间不足或来源失败时保留已有条目并返回 `partial: true`。只读搜索遇到 429 用 `mv.sleep(1000)` 等一秒，仅重试一次，禁止忙等。

`POST /resolve` 接收 `{token}`，成功返回 `magnets` 或 `rapid_links`。示例服务须明确保证 401、429、404、402 均没有执行扣分，才能如此分类：

| 情形 | 返回的结构化错误 |
|---|---|
| 404 资源失效、402 积分不足，确定没扣分 | `{error:{kind:'rejected',message:'…'}}` |
| 请求后超时、网关失败、解析失败、响应缺链接，可能已扣分 | `{error:{kind:'uncertain',message:'…'}}` |
| 401 授权失效、429 限流，确定本次没扣分 | `{error:{kind:'source',message:'…'}}` |

购买请求不自动重试；若真实服务不能保证没扣分，必须归为 `uncertain`，不能仅凭状态码判断。**不写 `kind` 的失败，付费资源按 `uncertain`、免费资源按 `rejected` 处理。**

`accountInfo()` 不联网，返回三行占位账号信息，演示 `ok`、`warn`、`error` 三种 `tone` 与底部 `note`。真实插件可查询自己的账号服务，不能展示凭据。

保留设置页布局声明：`settings.columns: 2`，密钥与每次条数在电脑上并排、手机上纵排。订阅自动搜索默认关闭，需要管理员启用。
