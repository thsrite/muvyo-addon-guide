# 签名、加密与发布

## 作者证书

- 在 Muvyo「第三方插件 → 开发者」用 GitHub 账号领取，需要有效的 Muvyo 授权。
- 领取时 Muvyo 在本机生成签名私钥，把公钥交给授权服务签发证书；下载的 `muvyo-signing.json` 里是证书和私钥，**私钥只在这一份文件里**。
- 命名空间 = GitHub 用户名（小写）。插件 ID 必须以 `命名空间.` 开头，别人无法用你的命名空间发布插件。
- 丢了凭据或证书过期就重新领取；已经签过名、已经安装的插件不受影响。
- 证书只证明「是谁发布的」，不代表官方审核过插件内容。

## 签名脚本

```sh
pip install cryptography

python3 mv_addon.py sign <源码目录> [-o 插件库目录] [-c 凭据文件] [--no-encrypt]
python3 mv_addon.py verify <插件库目录>/plugins/<插件ID>
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `-o` | `./dist` | 插件仓库目录（在仓库根目录签名时用 `-o .`），签名结果写到 `<目录>/plugins/<插件ID>/`，并更新 `<目录>/index.json` |
| `-c` | `./muvyo-signing.json` | 签名凭据 |
| `--no-encrypt` | 加密 | 不加密代码，仓库里是明文 `main.js` |

- 源码目录里只读取 `manifest.json`、入口文件和 `README.md`，其它文件忽略。
- 重新签名会先清空该插件的输出目录，再写入新文件。
- 签名覆盖插件 ID、版本和每个文件的 SHA-256：发布后改动任何一个文件（包括 README）都会导致安装失败，必须重新签名。

## 代码加密

默认用证书里的加密公钥加密入口代码，仓库里只有 `encrypted.json`；manifest 和 README 保持明文，方便用户安装前查看权限。每个作者的加密密钥不同，Muvyo 安装时向授权服务领取对应的解密密钥。

加密提高了直接读取源码的门槛，但运行时代码终究要在用户的 Muvyo 里解开，**不要在代码里写你自己的密钥或秘密**。

## 插件仓库格式

插件仓库就是一个公开 GitHub 仓库（或任意 https 静态站点）。Muvyo 只读取签名产物。加密插件不要提交源码（提交了就等于公开）；开源插件、以及移植了 GPL 等 copyleft 代码的插件，用 `--no-encrypt` 发布，并可以连同源码一起提交。推荐结构（见 [template/](../template/)）：

```
.gitignore                  src/、muvyo-signing.json、mv_addon.py
.githooks/pre-commit        提交检查（git config core.hooksPath .githooks 启用）
.claude/skills/             发布用的 AI skill
src/                        源码，不提交
  alice.search/
index.json                  ↓ 以下是签名产物，提交
index.json.sig              可选：仓库签名，见下
plugins/
  alice.search/
    manifest.json
    encrypted.json 或 main.js
    README.md
    signature.json
  alice.picks/
    ...
```

在仓库根目录用 `python3 mv_addon.py sign ./src/<插件ID> -o .` 签名，产物直接落在根目录。源码想单独管理（比如放在私有仓库），`-o` 指向插件仓库的目录即可。

`index.json`（签名脚本自动维护）：

```json
{
  "name": "alice 的插件",
  "sequence": 3,
  "plugins": [
    {
      "id": "alice.search",
      "name": "示例搜索",
      "version": "1.0.0",
      "description": "搜索示例站点的网盘分享。",
      "author": "alice",
      "path": "plugins/alice.search",
      "api": 1
    }
  ]
}
```

- `name`：仓库显示名，可以手动改。
- `sequence`：每次签名自动加一。
- `path`：插件目录，相对仓库根目录。
- 最多 500 个插件，插件 ID 不能重复。

用户在 Muvyo 里填 GitHub 仓库地址（`https://github.com/alice/muvyo-addons`）会自动读取默认分支根目录的 `index.json`；也可以直接填 `index.json` 的完整 https 地址。

安装时 Muvyo 先读 `signature.json`，再按签名里列出的文件逐个下载并核对，任何一个文件对不上都拒绝安装。

### 仓库签名（可选）

在 `index.json` 里写 `"public_key": "<Ed25519 公钥 Base64>"`，并在旁边放 `index.json.sig`（用对应私钥对 `index.json` 原始字节签名，Base64）。Muvyo 第一次添加仓库时记住这把公钥，之后公钥变了、签名缺失或对不上都会拒绝读取仓库，`sequence` 变小也会拒绝（防止旧索引被重放）。

启用后每次签名脚本更新了 `index.json`，都要重新生成 `index.json.sig`。不需要的话不写 `public_key` 即可，插件本身始终有作者签名保护。

## 更新插件

1. 修改源码，把 manifest 的 `version` 调大（如 `1.0.0` → `1.0.1`）。
2. 重新签名：`python3 mv_addon.py sign ./src/<插件ID> -o .`
3. 提交并推送 `index.json` 和 `plugins/` 的变化。

用户的 Muvyo 在插件仓库里会看到「可更新」，确认后更新。插件 ID 不能变，变了就是另一个插件。

## 停用与删除

Muvyo 官方可以停用某个插件、某个版本、某个插件仓库、某个作者或某张证书。停用信息随 Muvyo 授权续期下发（最迟约 6 小时生效），被明确停用的插件立即停止运行，7 天后从所有 Muvyo 上连同配置一起删除。对停用有异议的，在 [第三方插件投诉页](https://l.muvyo.com/api/addon-complaint) 选「作者申诉」。
