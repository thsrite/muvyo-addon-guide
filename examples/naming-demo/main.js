// 教学示例，不识别影片、不访问网络、不移动或重命名文件。
// Muvyo 每次传入一个文件的只读命名上下文。
function naming(context) {
  const audio = String(context.vars.audioCodec || '');
  if (!audio) return null; // 明确不修改，沿用内置命名结果。

  const separator = mv.config.separator || '.';
  const vars = {audioCodec: audio.replace(/\s+/g, separator)};

  // 使用原模板；vars 只覆盖这次渲染的展示变量，不修改上下文。
  // mv.render 由 Muvyo 有界渲染，不是在 QuickJS 中运行 Jinja2。
  const rendered = mv.render(undefined, vars);
  // 演示渲染后替换：会替换路径中所有相同的音频字段文本。
  const normalizedAudio = vars.audioCodec.replace(/\bAtmos\b/gi, 'ATMOS');
  return {rendered: rendered.split(vars.audioCodec).join(normalizedAudio)};
}
