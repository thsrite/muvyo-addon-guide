# Muvyo 第三方插件开发指南

这里是给 Muvyo 写第三方插件的参考：怎么写、怎么签名、怎么发布成插件仓库，以及各类能力的接口与示例。

> 第三方插件不是 Muvyo 官方出品。插件在 Muvyo 的独立沙箱进程里运行，只能访问安装时管理员确认过的域名，读不到 Muvyo 的配置、凭据和本机文件（见 [安全机制](docs/security.md)）。
>
> 发布插件前请阅读 [开发者协议与内容政策](docs/policy.md)：不得发布侵权、违法或恶意的插件。侵权与安全投诉请提交到 [第三方插件投诉页](https://l.muvyo.com/api/addon-complaint)。

## 插件能做什么

| 能力 | 在 Muvyo 里的效果 | 需要实现的函数 |
|---|---|---|
| `search` 资源搜索 | 出现在资源搜索、订阅、机器人搜索的来源里，结果可直接转存 | `search`，可选 `resolve` |
| `vlib` 虚拟库片单 | 作为虚拟库的动态来源，给出一组影片，资料由 Muvyo 从 TMDB 补全 | `vlibItems` |
| `content` 内容源 | 在 Vyo 里按虚拟库浏览、播放插件提供的作品 | `contentList`、`contentDetail`、`contentPlay`，可选 `contentCategories`、`contentSearch` |
| `metadata` 刮削来源 | Vyo 媒体库补全资料、重新识别时可改用插件 | `metadataSearch`、`metadataDetail` |
| `naming` 整理命名（待发布） | 为整理命名方案提供字段格式化和相对路径建议，不操作文件 | `naming` |

一个插件可以同时声明多种能力。详细的参数和返回格式见 [docs/capabilities.md](docs/capabilities.md)。

## 五分钟上手

**1. 领取作者证书**

在 Muvyo 打开「插件 → 第三方插件 → 开发者」，点「用 GitHub 账号领取证书」，按提示在 GitHub 输入验证码（第三方插件与领证都需要 Muvyo 永久授权）。
完成后浏览器会下载 `muvyo-signing.json`（作者证书 + 你的签名私钥），同一页可以下载签名脚本 `mv_addon.py`（本仓库根目录也有一份）。

- 你的**命名空间**就是 GitHub 用户名（小写），插件 ID 必须以它开头，例如用户名 `alice` → 插件 ID `alice.search`。
- `muvyo-signing.json` 里有私钥，Muvyo 不保存。妥善保管，**不要提交到任何仓库**；丢了重新领取即可，旧证书签过的插件照样有效。

**2. 建插件仓库，写源码**

一个 GitHub 仓库就是一个插件仓库。推荐结构：源码放 `src/` 不提交，签名产物放仓库根目录提交。直接复制 [template/](template/) 开始（连同隐藏的 `.gitignore`、`.githooks/`、`.claude/`），然后执行 `git config core.hooksPath .githooks` 启用提交检查：

```
my-addons/                     ← 你的 GitHub 仓库
  .gitignore                   忽略 src/、签名凭据、签名脚本
  .githooks/pre-commit         提交检查：拦住源码、凭据、私钥和不合规的插件文件
  .claude/skills/              发布用的 AI skill（muvyo-addon-publish）
  src/                         源码（不提交）
    alice.search/
      manifest.json            插件信息、权限和能力声明
      main.js                  入口代码（文件名由 manifest 的 entry 决定）
      README.md                可选，插件说明
  index.json                   签名产物（提交）
  plugins/alice.search/        签名产物（提交）
```

每个插件的源码是 `src/` 下的一个文件夹，只有上面三种文件。可以直接复制 [examples/](examples/) 里的示例改。manifest 字段见 [docs/manifest.md](docs/manifest.md)，代码里能用的 `mv` 对象见 [docs/runtime.md](docs/runtime.md)。

**3. 签名**

在仓库根目录运行（`muvyo-signing.json` 放在这里，已被 .gitignore 忽略）：

```sh
pip install cryptography
python3 mv_addon.py sign ./src/alice.search -o .
```

签名结果直接写到仓库根目录：

```
index.json                     插件清单，每次签名自动更新
plugins/alice.search/
  encrypted.json               加密后的代码（加 --no-encrypt 时是明文 main.js）
  manifest.json
  README.md
  signature.json               作者签名
```

默认会加密代码；开源插件加 `--no-encrypt`，也可以把 `src/` 从 .gitignore 里去掉一起公开。检查签名：`python3 mv_addon.py verify ./plugins/alice.search`。

**4. 发布**

```sh
git add index.json plugins
git commit -m "发布 alice.search 1.0.0"
git push
```

仓库要是公开的，`index.json` 在仓库根目录。

提交检查会拦下 `src/` 源码、`muvyo-signing.json`、任何含私钥的文件、插件目录里的多余文件，以及加密插件夹带的明文 JS。开源插件要连源码一起提交，先执行 `git config muvyo.publishSource true`。

用 Claude Code 等 AI 编程工具开发时，模板里的 skill 会按「签名 → 验签 → 只暂存签名产物 → 提交 → 确认后推送」的流程完成发布，直接说「发布插件」即可。

**5. 安装**

在 Muvyo「第三方插件 → 插件仓库」添加仓库地址（直接填 `https://github.com/alice/muvyo-addons` 即可），列表里点安装，确认联网范围后装上，再到插件设置里填配置、启用。

更新插件：改 manifest 的 `version`，重新签名、推送；Muvyo 的插件仓库里会显示可更新。详见 [docs/publishing.md](docs/publishing.md)。

## 目录

- [docs/manifest.md](docs/manifest.md) — manifest.json 全部字段、配置项与设置页
- [docs/runtime.md](docs/runtime.md) — 运行环境：`mv.fetch`、`mv.config`、`mv.storage`、日志与限制
- [docs/capabilities.md](docs/capabilities.md) — 已有四类能力的函数、参数与返回格式
- [docs/naming.md](docs/naming.md) — 整理命名协议（待发布）：返回格式、`mv.render` 与隔离限制
- [docs/publishing.md](docs/publishing.md) — 签名、加密、插件仓库格式、更新与停用
- [docs/security.md](docs/security.md) — 安全机制：独立沙箱进程、联网代办、签名与更新校验、加密
- [docs/policy.md](docs/policy.md) — 开发者协议与内容政策：禁止的插件、代码许可、停用与申诉
- [examples/](examples/) — 五个教学示例；命名示例需要支持新协议的 Muvyo
- [template/](template/) — 插件仓库模板：`.gitignore`（源码不提交、签名产物提交）、提交检查钩子、发布用的 AI skill

## 常见问题

**安装时提示「插件 ID 必须以作者命名空间开头」**：manifest 的 `id` 要以 `你的GitHub用户名.` 开头。

**提示「插件未获准访问 https://xxx」**：插件要访问的每个域名都要写进 `permissions.domains`，而且要管理员安装时确认。`*.example.com` 只匹配子域名，不包括 `example.com` 本身，两个都要就都写上。

**提示「这张证书不支持加密」**：证书是旧版领取的，在开发者页重新领取一次。

**插件被停用或删除了**：作者证书、插件、插件仓库都可能被官方停用；被明确停用的插件立即停止运行，7 天后从所有 Muvyo 上自动删除。有异议请在投诉页选「作者申诉」。

**签名私钥泄露了**：在 Muvyo「第三方插件 → 开发者」点「作废这张证书」，用 GitHub 账号确认后立即作废，再重新领取证书并重新签名发布。

**代码加密后别人还能看到吗**：加密让仓库里的代码不再是明文，但拥有授权的 Muvyo 运行时终究要解开它，不要在插件里放你自己的密钥或秘密。需要用户各自的密钥，就声明成 `secret` 类型的配置项让用户自己填。

## 许可

示例与模板（`examples/`、`template/`）采用 MIT-0，复制后开发、加密发布自己的插件都不需要保留声明；签名脚本 `mv_addon.py` 采用 MIT；文档（本文件与 `docs/`）采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。详见 [LICENSE](LICENSE)。
