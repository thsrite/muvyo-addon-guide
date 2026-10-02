#!/usr/bin/env python3
"""Muvyo 第三方插件签名脚本（独立运行，只需要 Python 3 和 cryptography：pip install cryptography）。

在 Muvyo「第三方插件 → 开发者」用 GitHub 账号领取证书时会下载签名凭据 muvyo-signing.json
（里面是作者证书和签名私钥），放在运行本脚本的目录即可。插件源码是一个文件夹：

  my-plugin/
    manifest.json      插件 ID 必须以你的命名空间开头，如 alice.search
    main.js            入口文件（manifest 的 entry）
    README.md          可选

  python3 mv_addon.py sign ./my-plugin                 # 加密代码并签名，写入插件库目录 ./dist（可用 -o 指定）
  python3 mv_addon.py verify ./dist/plugins/alice.search

签名结果是一个插件库：index.json + plugins/<插件ID>/（manifest.json、加密后的 encrypted.json、
README.md、signature.json）。只上传这些加密签名产物，不上传 src、明文代码或签名凭据。
源码留在本地或独立私有开发仓库；发布流程不使用 --no-encrypt。Muvyo 里添加插件仓库地址就能安装。
凭据里有签名私钥：妥善保管，不要提交到仓库或发给别人；丢了就在 Muvyo 里重新领取，旧证书签过的插件照样有效。
"""
import argparse
import base64
import hashlib
import json
import os
import sys
import time

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

# 与 app/services/addons/author_authority.py 一致（tests/test_addon_author_signing.py 校验）
ROOT_PUBLIC_KEY_B64 = "8M+V4JhFIeXuXlUck07OXcXutKzTfdN3WL+NgsUYFh4="
SIGNATURE_FILE = "signature.json"
CERT_PREFIX = b"Muvyo addon author v1\x00"
PACKAGE_PREFIX = b"Muvyo addon package v1\x00"
ENCRYPTED_FILE = "encrypted.json"
SEAL_INFO = b"Muvyo addon code v1"


CREDENTIAL_FILE = "muvyo-signing.json"
MAX_FILE = 1024 * 1024
ALLOWED = {"manifest.json", "README.md", SIGNATURE_FILE, ENCRYPTED_FILE}


def read_file(path, limit=MAX_FILE):
    if os.path.islink(path) or not os.path.isfile(path):
        raise SystemExit(f"{path} 不是普通文件")
    with open(path, "rb") as fh:
        data = fh.read(limit + 1)
    if len(data) > limit:
        raise SystemExit(f"{os.path.basename(path)} 过大")
    return data


def read_source(folder):
    """从插件源码目录读 manifest.json、入口文件和 README.md，其它文件忽略。"""
    if not os.path.isdir(folder):
        raise SystemExit(f"找不到插件源码目录 {folder}")
    try:
        manifest = json.loads(read_file(os.path.join(folder, "manifest.json")).decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise SystemExit("manifest.json 不是有效的 JSON") from None
    entry = manifest.get("entry", "main.js")
    if not isinstance(entry, str) or "/" in entry or "\\" in entry or entry in ALLOWED:
        raise SystemExit("manifest.json 的 entry 必须是插件目录下的一个 JS 文件名")
    files = {"manifest.json": read_file(os.path.join(folder, "manifest.json")),
             entry: read_file(os.path.join(folder, entry))}
    if os.path.exists(os.path.join(folder, "README.md")):
        files["README.md"] = read_file(os.path.join(folder, "README.md"))
    return manifest, files


def seal(code, manifest, cert):
    """与 Muvyo 客户端 app/services/addons/sealing.py 同一格式：X25519 + HKDF-SHA256 + AES-256-GCM。"""
    recipient = X25519PublicKey.from_public_bytes(base64.b64decode(cert["content_key"]))
    ephemeral = X25519PrivateKey.generate()
    raw = lambda key: key.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)  # noqa: E731
    epk = raw(ephemeral.public_key())
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=epk + raw(recipient), info=SEAL_INFO).derive(
        ephemeral.exchange(recipient))
    nonce = os.urandom(12)
    aad = json.dumps({"plugin_id": manifest["id"], "version": manifest["version"], "entry": manifest.get("entry", "main.js"),
                      "author_id": cert["author_id"], "key_version": cert["content_key_version"]},
                     sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return json.dumps({"version": 1, "alg": "x25519-hkdf-sha256-aes256gcm", "key_version": cert["content_key_version"],
                       "epk": base64.b64encode(epk).decode(), "nonce": base64.b64encode(nonce).decode(),
                       "ciphertext": base64.b64encode(AESGCM(key).encrypt(nonce, code, aad)).decode()}, indent=1).encode()


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def public_b64(key):
    return base64.b64encode(key.public_key().public_bytes(serialization.Encoding.Raw,
                                                          serialization.PublicFormat.Raw)).decode()


def check_certificate(envelope):
    cert = envelope["certificate"]
    if not ROOT_PUBLIC_KEY_B64:
        raise SystemExit("这个版本的工具没有内置 Muvyo 根公钥，无法校验作者证书")
    try:
        Ed25519PublicKey.from_public_bytes(base64.b64decode(ROOT_PUBLIC_KEY_B64)).verify(
            base64.b64decode(envelope["signature"]), CERT_PREFIX + canonical_json(cert))
    except (InvalidSignature, ValueError):
        raise SystemExit("作者证书不是 Muvyo 签发的") from None
    if time.time() >= cert["expires_at"]:
        raise SystemExit("作者证书已过期，请重新领取")
    return cert


def load_credential(path):
    try:
        with open(path, encoding="utf-8") as fh:
            credential = json.load(fh)
        envelope = credential["certificate"]
        key = serialization.load_pem_private_key(credential["private_key"].encode(), password=None)
    except FileNotFoundError:
        raise SystemExit(f"找不到签名凭据 {path}：把领取证书时下载的 {CREDENTIAL_FILE} 放到当前目录，"
                         "或用 -c 指定位置") from None
    except (OSError, ValueError, KeyError, TypeError):
        raise SystemExit(f"签名凭据读取失败：请使用在 Muvyo 里领取证书时下载的 {CREDENTIAL_FILE}") from None
    if not isinstance(key, Ed25519PrivateKey):
        raise SystemExit("签名凭据里的私钥无效")
    return envelope, key


def update_index(repo, manifest, rel_path):
    path = os.path.join(repo, "index.json")
    index = {"name": "", "sequence": 0, "plugins": []}
    if os.path.exists(path):
        try:
            index = json.loads(read_file(path, 1024 * 1024).decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise SystemExit(f"{path} 不是有效的 JSON，请修好或删掉后重试") from None
    entry = {"id": manifest["id"], "name": manifest.get("name") or manifest["id"], "version": manifest["version"],
             "description": manifest.get("description", ""), "author": manifest.get("author", ""),
             "path": rel_path, "api": manifest.get("api", 1)}
    plugins = [p for p in index.get("plugins", []) if isinstance(p, dict) and p.get("id") != manifest["id"]]
    index["plugins"] = sorted(plugins + [entry], key=lambda p: str(p.get("id")))
    index["sequence"] = int(index.get("sequence") or 0) + 1
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    if index.get("public_key"):
        print("注意：index.json 带仓库签名公钥，请重新生成 index.json.sig，否则已添加这个仓库的 Muvyo 会拒绝读取")


def sign(args):
    envelope, key = load_credential(args.credential)
    cert = check_certificate(envelope)
    if public_b64(key) != cert["public_key"]:
        raise SystemExit("私钥与证书不匹配")
    manifest, files = read_source(args.source)
    plugin_id, version = manifest.get("id"), manifest.get("version")
    if not isinstance(plugin_id, str) or not isinstance(version, str):
        raise SystemExit("manifest.json 缺少 id 或 version")
    if not plugin_id.startswith(cert["namespace"] + ".") or "/" in plugin_id or ".." in plugin_id:
        raise SystemExit(f"插件 ID 必须以你的命名空间「{cert['namespace']}.」开头，如 {cert['namespace']}.search")
    entry = manifest.get("entry", "main.js")
    if not args.no_encrypt:
        if not cert.get("content_key"):
            raise SystemExit("这张证书不支持加密，请在 Muvyo 里重新领取证书后再签名发布")
        files[ENCRYPTED_FILE] = seal(files.pop(entry), manifest, cert)
    payload = {"plugin_id": plugin_id, "version": version,
               "files": {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())}}
    document = {"version": 1, "certificate": envelope, "payload": payload,
                "signature": base64.b64encode(key.sign(PACKAGE_PREFIX + canonical_json(payload))).decode()}
    rel_path = "plugins/" + plugin_id
    target = os.path.join(args.output, "plugins", plugin_id)
    os.makedirs(target, exist_ok=True)
    # 清掉上一次签名留下的文件（比如从不加密切到加密后残留的明文入口）
    for name in os.listdir(target):
        full = os.path.join(target, name)
        if os.path.isfile(full) and not os.path.islink(full):
            os.remove(full)
    for name, data in files.items():
        with open(os.path.join(target, name), "wb") as fh:
            fh.write(data)
    with open(os.path.join(target, SIGNATURE_FILE), "w", encoding="utf-8") as fh:
        json.dump(document, fh, ensure_ascii=False, indent=1)
    update_index(args.output, manifest, rel_path)
    print(f"已签名：{plugin_id} {version}" + ("（代码已加密）" if ENCRYPTED_FILE in files else "（代码未加密）"))
    print(f"插件库目录：{os.path.abspath(args.output)}，推到 GitHub 仓库后在 Muvyo 里添加这个仓库即可安装")


def verify(args):
    folder = args.folder
    try:
        document = json.loads(read_file(os.path.join(folder, SIGNATURE_FILE), 64 * 1024).decode("utf-8"))
        listed = document["payload"]["files"]
    except (UnicodeDecodeError, ValueError, KeyError, TypeError):
        raise SystemExit("signature.json 格式不正确") from None
    cert = check_certificate(document["certificate"])
    files = {}
    for name in listed:
        if "/" in name or "\\" in name or name.startswith("."):
            raise SystemExit("签名里的文件名不合规")
        files[name] = read_file(os.path.join(folder, name), 2 * MAX_FILE)
    manifest = json.loads(files["manifest.json"])
    if not manifest["id"].startswith(cert["namespace"] + "."):
        raise SystemExit(f"插件 ID 不在作者命名空间「{cert['namespace']}.」内，Muvyo 会拒绝安装")
    expected = {"plugin_id": manifest["id"], "version": manifest["version"],
                "files": {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())}}
    if document["payload"] != expected:
        raise SystemExit("插件文件与签名不符")
    try:
        Ed25519PublicKey.from_public_bytes(base64.b64decode(cert["public_key"])).verify(
            base64.b64decode(document["signature"]), PACKAGE_PREFIX + canonical_json(expected))
    except InvalidSignature:
        raise SystemExit("签名无效") from None
    print(f"签名有效：{manifest['id']} {manifest['version']}，作者 {cert['author']}（证书 #{cert['serial']}）"
          + ("，代码已加密" if ENCRYPTED_FILE in files else "，代码未加密"))


def main(argv=None):
    parser = argparse.ArgumentParser(description="Muvyo 第三方插件作者工具")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("sign", help="加密代码并签名，写入插件库目录")
    p.add_argument("source", help="插件源码目录（manifest.json + 入口 JS，可带 README.md）")
    p.add_argument("-o", "--output", default="dist", help="插件库目录，默认 ./dist")
    p.add_argument("-c", "--credential", default=CREDENTIAL_FILE, help=f"签名凭据，默认 ./{CREDENTIAL_FILE}")
    p.add_argument("--no-encrypt", action="store_true", help="不加密代码（默认用证书里的加密公钥加密）")
    p.set_defaults(func=sign)
    p = sub.add_parser("verify", help="检查插件库里某个插件目录的签名")
    p.add_argument("folder", help="如 ./dist/plugins/alice.search")
    p.set_defaults(func=verify)
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    sys.exit(main())
