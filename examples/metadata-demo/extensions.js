// 将需要的入口合入 main.js 并声明相应能力；复用基础示例的 get()。
// 接口为占位协议，实际服务必须明确返回识别状态，不能按搜索排名猜测身份。
function metadataIdentify(args) {
  const result = get('/identify?title=' + encodeURIComponent(args.title) +
    '&year=' + args.year + '&type=' + encodeURIComponent(args.media_type) +
    '&filenames=' + encodeURIComponent(JSON.stringify(args.filenames || [])));
  if (result.status === 'unmatched' || result.status === 'ambiguous') {
    return { status: result.status };
  }
  if (result.status !== 'matched' || !result.id || result.media_type !== args.media_type) {
    throw new Error('资料服务未返回有效的确定识别结果');
  }
  return { status: 'matched', id: String(result.id), media_type: result.media_type };
}

function personFields(p) {
  return {
    id: String(p.id), name: p.name, image: p.image || '',
    biography: p.biography || '',
  };
}

function metadataPeopleSearch(args) {
  const data = get('/people?q=' + encodeURIComponent(args.keyword));
  return { items: (data.items || []).map(personFields) };
}

function metadataPersonDetail(args) {
  const p = get('/people/' + encodeURIComponent(args.id));
  return Object.assign(personFields(p), {
    aliases: p.aliases || [], birthday: p.birthday || '',
    deathday: p.deathday || '', birthplace: p.birthplace || '',
  });
}

function metadataImageRequest(args) {
  // 只有该固定 HTTPS 来源使用令牌，其他图片不携带凭据。
  // QuickJS 不要求提供浏览器 URL 类；固定前缀包含结尾斜线，避免误认相似域名。
  const headers = {};
  if (args.url.startsWith('https://img.example.com/') && mv.config.token) {
    headers.Authorization = 'Bearer ' + mv.config.token;
  }
  return { url: args.url, headers };
}
