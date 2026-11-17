# 示例刮削

刮削来源示例：按片名搜索影视并给出完整资料。

安装启用后，在 Vyo 媒体库的扫描设置里把「资料来源」改成这个插件；重新识别时也可以切换到它搜索。

权限：`permissions.domains: ["api.example.com", "img.example.com"]`；不需要 Muvyo 服务权限。演示搜索、详情、图片、演职员与分季分集字段；域名均为占位。

最低支持版本：Muvyo 3.13.0，manifest 已写 `min_mv_version: "3.13.0"`；更早的版本会拒绝安装。

## 可选扩展（待发布）

`extensions.js` 演示作品识别、人物搜索与详情、临时图片认证；不参与当前基础包的入口。使用时将其函数合入 `main.js`，在 `capabilities.metadata` 按实际实现添加 `identify: true`、`people: true`、`image_request: true`，并将 `min_mv_version` 改成正式支持这些扩展的版本（待发布时确认）。不要把基础包的 3.13.0 当作扩展的最低版本。

图片认证示例还需在 `config` 声明 `{ "key": "token", "label": "访问令牌", "type": "secret" }`。认证头只发往示例中固定的图片域名；替换服务时一并调整该判断与联网权限。仅公开图片无需开启图片请求扩展。

作品详情的人物条目可添加 `id`、`image`、`biography`，并通过 `trailers: [{name, url}]` 提供公开 HTTPS 预告片链接。完整契约见[通用资料协议](../../docs/metadata.md)。示例不绑定资料来源或编号体系，服务接口需按自己的实际协议实现。
