# 示例刮削

刮削来源示例：按片名搜索影视并给出完整资料。

安装启用后，在 Vyo 媒体库的扫描设置里把「资料来源」改成这个插件；重新识别时也可以切换到它搜索。

权限：`permissions.domains: ["api.example.com", "img.example.com"]`；不需要 Muvyo 服务权限。演示搜索、详情、图片、演职员与分季分集字段；域名均为占位。

最低支持版本：Muvyo 3.13.0，manifest 已写 `min_mv_version: "3.13.0"`；更早的版本会拒绝安装。
