# 频道监听与推送示例

演示 `telegram.channel` 读取频道、搜索消息、`subscription.push` 推送、`browseSources` / `browsePage` 浏览来源，以及监听类 `scheduledTask`。

权限：`permissions.muvyo: ["telegram.channel", "subscription.push"]`；`domains: []`，不直接联网。公开频道使用占位 `@example_channel`，私有频道必须由管理员明确授权。消息里的 `https://example.com/resource/example` 是教学资源页，不是真实来源。

最低支持版本：Muvyo 3.13.0，manifest 已写 `min_mv_version: "3.13.0"`；更早的版本会拒绝安装。

## 使用与调度

1. 在 Muvyo 登录自己的 Telegram 账号，配置有权读取的频道。
2. 安装并授予上述服务权限，按需启用参与订阅搜索和监听任务。
3. 清单用 `kind: "watch"`、`interval_minutes: 2` 声明监听类任务，2 分钟是最短间隔。
4. 在平台的任务设置打开「遵守订阅允许时段」。这是管理员设置，**不是 manifest 字段**；时段外平台不会调用任务，也不会推进起点。示例还检查 `args.subscription_window_open === false` 后提前返回。
5. 示例额外演示本地时间判断：`mv.time.local().getUTCHours()` 读取服务器本地小时，每天 00:00–06:00 不读频道。按自己业务调整这段示例策略，不要用沙箱 `Date` 推断服务器时区。

首次读取只记录起点，不推送历史。之后以「频道引用 + 消息 ID」生成稳定条目 ID；直接磁力正常推送，只有资源页的消息返回 `resolve_token` 而不带链接，命中订阅后由平台调用 `resolve`。未命中的待获取条目不会自动换链接。示例 `resolve` 只返回占位磁力，不联网、不会解锁真实资源。

每轮最多读取 18 次、推送两批各 50 条；达到推送容量即停读，推送抛错时不保存游标，下轮由稳定 ID 去重。剩余执行时间不足也停止拉取。频道较多的实际插件还应轮换频道，避免固定顺序造成后面的频道长期读不到。

搜索和推送结果带 `channel`。浏览来源分别使用 `mv.telegram.channels()`、`mv.telegram.page()`，只读取已获准的频道。不得把消息原文、凭据写入日志或外发。
