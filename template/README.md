# 我的 Muvyo 插件

这是一个 Muvyo 第三方插件仓库。在 Muvyo「第三方插件 → 插件仓库」添加本仓库地址即可安装。

## 开发者

- 源码放 `src/<插件ID>/`（manifest.json、main.js、README.md），不提交
- 签名凭据 `muvyo-signing.json`、签名脚本 `mv_addon.py` 放在仓库根目录，不提交
- 第一次克隆后启用提交检查：`git config core.hooksPath .githooks`
- 签名：`python3 mv_addon.py sign ./src/<插件ID> -o .`
- 提交：`git add -A index.json plugins/<插件ID>`，再 commit、push

用 Claude Code 等 AI 编程工具时，直接说「发布插件」即可，按 `.claude/skills/muvyo-addon-publish` 的流程签名、检查并提交。

开发说明见 https://github.com/thsrite/muvyo-addon-guide
