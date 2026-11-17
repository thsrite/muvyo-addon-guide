# 第三方刮削来源扩展协议

本协议面向通用资料服务。插件负责查询、识别和字段转换；宿主负责媒体库权限、资料合并、图片读取与展示。接口不要求使用某个站点、部署方式、编号体系或语言。

**发布状态：待发布。** 本文对应宿主开发代码；正式最低版本待发布时确认。启用扩展前须使用包含这些能力的宿主，并据实际发布版本填写 `min_mv_version`。基础搜索与详情示例仍保持旧版兼容。

## 能力声明与兼容

```json
{
  "capabilities": {
    "metadata": {
      "media_types": ["movie", "tv"],
      "identify": true,
      "people": true,
      "image_request": true
    }
  }
}
```

`api` 仍为 1。三个可选开关缺省均为 `false`，仅声明实际实现的能力。旧插件继续使用 `metadataSearch`、`metadataDetail`，自动识别仍要求片名或原名与年份唯一匹配。更新确认会列出能力字段变化。使用新能力的包应按实际发布版本填写 `min_mv_version`。

这些入口由现行原生媒体库接入，插件仍使用本文的 JavaScript 接口，无需了解宿主实现语言。接口面向通用资料服务；启用其中一项能力不要求实现其余可选能力。新能力的正式最低版本以发布记录为准。

接入范围为内置媒体库的扫描补全、资料刷新、重新识别及人物浏览。不改变订阅与整理链路的识别来源，也不提供任意数据库修改、文件写入或外部媒体服务器管理接口。

## 作品识别

声明 `identify: true` 后，没有已选来源编号的作品调用：

```js
function metadataIdentify(args) {
  // args: {title, year, media_type, filenames}
  // filenames 最多 20 个文件名，无目录；year 为 0 表示未知。
  return {status: "matched", id: "catalog:42", media_type: args.media_type};
}
```

插件可以利用标题、年份、文件名中的编号或自身资料索引识别作品。确定唯一身份时返回 `matched`；找不到返回 `{status: "unmatched"}`，多候选无法确定时返回 `{status: "ambiguous"}`。宿主不会把最高分候选自动当成确定匹配，不会在失败后改用其他来源。

`id` 使用原有条目编号规则：1–128 个英文字母、数字、下划线、点、冒号或短横线。编号只在当前插件内有意义。匹配后调用 `metadataDetail({id, media_type})`；已有来源编号直接取详情，手动重新识别选择的编号优先。自动补全继续遵守资料锁定、本地资料优先及既有作品身份保护。

扫描子进程通过宿主通道调用 `metadata_identify`，插件仍只在主进程管理的独立沙箱内执行。

## 人物资料

`metadataDetail` 原有 `people` 条目可增加以下字段，无需为了附带人物简介而声明独立人物能力：

```json
{
  "people": [{
    "id": "person:7",
    "name": "人物甲",
    "type": "Actor",
    "role": "角色甲",
    "image": "https://images.example.org/person/7.jpg",
    "biography": "人物简介"
  }]
}
```

人物类型沿用 `Actor`、`Director`、`Writer`、`Producer`、`Crew`。人物编号按插件来源隔离；未提供编号仍沿用名称身份。头像由宿主按插件网络权限读取、重新编码并缓存，浏览器和兼容客户端不接收上游图片地址。插件编号不作为 TMDB 编号使用。

声明 `people: true` 后可实现：

```js
function metadataPeopleSearch({keyword}) {
  return {items: [{id: "person:7", name: "人物甲", image: "https://images.example.org/person/7.jpg"}]};
}
function metadataPersonDetail({id}) {
  return {
    id, name: "人物甲", biography: "完整简介", aliases: ["别名"],
    birthday: "1980-01-01", deathday: "", birthplace: "出生地",
    image: "https://images.example.org/person/7.jpg"
  };
}
```

人物详情必须返回请求中的同一个 `id`，不能用同名人物或其他编号替代；没有独立人物能力时，宿主仍可展示作品资料附带的简介。

搜索最多接收 50 个人物，必须带有效编号。管理员接口为 `GET /api/v1/media-library/metadata/people/search?provider=addon:插件ID&keyword=关键词` 与同目录的 `detail?provider=addon:插件ID&ref=人物编号`。

普通观看用户从可见作品打开人物详情，宿主先核验作品可见性及人物确实属于该作品，再调用插件；不能借该接口查询不可见作品的人物。网页与兼容客户端的人物作品列表按来源隔离后的实体编号查询，只列用户可见库的作品。

插件人物头像同样需要有效媒体会话，并绑定可见作品。兼容客户端使用其正常图片请求中的媒体令牌；网页使用宿主生成的图片地址，不自行拼接上游地址或插件认证头。

## 预告片

作品详情可返回最多 20 个预告片：

```json
{"trailers": [{"name": "预告片", "url": "https://video.example.org/watch/42"}]}
```

地址必须是无需宿主凭据的 HTTPS 链接，不含用户名、密码或控制字符。它可以是播放页或公开视频地址；网页使用既有预告片按钮打开，兼容客户端通过 `RemoteTrailers` 接收。资料里不要放临时令牌或认证头。此字段不承诺对任意视频站做解析或视频代理。

## 图片请求

海报、背景、剧照、备选图与人物头像允许 HTTP/HTTPS 地址。地址能否读取仍由已有插件网络策略决定：只有获准域名和管理员配置的服务地址可访问，内网服务沿用固定地址及路径边界，不能访问回环、链路本地或其他未经授权的地址。

普通公开图片只需返回地址。原有 `image_headers` 仍仅用于非凭据请求头，例如防盗链的 `Referer`，不接受 `Authorization`、`Cookie`。

需要认证、临时签名地址或服务端图片处理时，声明 `image_request: true`：

```js
function metadataImageRequest({url}) {
  return {url, headers: {Authorization: "Bearer " + mv.config.token}};
}
```

宿主在实际回源时调用该入口，`url` 为资料里保存的稳定图片地址；返回值可替换地址并附加本次请求的头。临时地址及头仅用于这次取图，不进入资料、缓存键或前端。返回地址与每次跳转仍受原网络权限约束，跨源跳转清除凭据。缓存命中时不再调用插件。插件更新、停用、卸载或吊销的现有运行约束继续生效。

此入口只用于资料图片，不处理资源搜索结果的发布者头像或内容源封面及其预览。返回 `headers` 是本次完整请求头集合；需要保留 `Referer` 等静态头时也应在这里返回。

裁剪、人物居中、图片标记、文字翻译可以由插件调用获准服务完成后返回结果，本协议不绑定处理引擎。返回文本按纯文本处理；图片始终经过体积和格式检查与重编码。
