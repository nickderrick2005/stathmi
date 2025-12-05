import MarkdownIt from 'markdown-it';

// 本服务器 Guild ID
export const OPZ_GUILD_ID = '1291925535324110879';
// 类脑服务器 Guild ID
const LEIBAO_GUILD_ID = '1134557553011998840';

/**
 * 增强渲染的元数据
 */
export interface ContentMetadata {
  // userId -> displayName 映射
  users: Map<string, string>;
  // threadId -> title 映射
  posts: Map<string, string>;
}

/**
 * 配置 markdown-it 实例
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
});

// 自定义链接渲染
const defaultLinkRender =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  if (token) {
    const href = token.attrGet('href') || '';
    // Discord 相关链接正常打开
    if (href.includes('discord.com') || href.includes('discordapp.com') || href.includes('cdn.discordapp.com')) {
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'noopener noreferrer');
    }
    // 其他外部链接需要安全确认
  }
  return defaultLinkRender(tokens, idx, options, env, self);
};

/**
 * 语言名称映射
 */
const languageLabels: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  cs: 'C#',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  rb: 'Ruby',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  md: 'Markdown',
  markdown: 'Markdown',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Zsh',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  vue: 'Vue',
  jsx: 'JSX',
  tsx: 'TSX',
  dart: 'Dart',
  lua: 'Lua',
  r: 'R',
  scala: 'Scala',
  perl: 'Perl',
  dockerfile: 'Dockerfile',
  docker: 'Docker',
  graphql: 'GraphQL',
  diff: 'Diff',
  plaintext: '纯文本',
  text: '纯文本',
  txt: '纯文本',
};

// 自定义代码块渲染
md.renderer.rules.fence = function (tokens, idx) {
  const token = tokens[idx];
  const code = token?.content || '';
  const lang = token?.info?.trim() || '';
  const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // 有语言标识时显示标题栏
  if (lang) {
    const langLabel = languageLabels[lang.toLowerCase()] || lang.toUpperCase();
    return `<div class="code-block-wrapper has-lang">
      <div class="code-block-header">
        <span class="code-lang-label">${langLabel}</span>
      </div>
      <pre class="code-block"><code class="language-${lang}">${escapedCode}</code></pre>
    </div>`;
  }

  // 无语言标识时不显示标题栏
  return `<div class="code-block-wrapper">
    <pre class="code-block"><code>${escapedCode}</code></pre>
  </div>`;
};

/**
 * 提取域名
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return '外部';
  }
}

/**
 * 判断是否为 Discord 相关链接
 */
function isDiscordRelatedUrl(url: string): boolean {
  return (
    url.includes('discord.com') ||
    url.includes('discordapp.com') ||
    url.includes('cdn.discordapp.com') ||
    url.includes('media.discordapp.net')
  );
}

/**
 * 文件扩展名显示名称映射（提取为常量避免重复创建）
 */
const FILE_TYPE_LABELS: Record<string, string> = {
  png: 'PNG图片',
  jpg: 'JPG图片',
  jpeg: 'JPG图片',
  gif: 'GIF图片',
  webp: 'WEBP图片',
  mp4: 'MP4视频',
  webm: 'WEBM视频',
  mov: 'MOV视频',
  mp3: 'MP3音频',
  wav: 'WAV音频',
  ogg: 'OGG音频',
  pdf: 'PDF文件',
  zip: 'ZIP压缩包',
  rar: 'RAR压缩包',
  txt: 'TXT文件',
};

/**
 * 获取文件扩展名的显示名称
 */
function getFileTypeLabel(ext: string): string {
  return FILE_TYPE_LABELS[ext.toLowerCase()] || `${ext.toUpperCase()}文件`;
}

/**
 * 转义 HTML 属性值中的特殊字符
 */
function escapeHtmlAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 解析 Discord 频道链接
 */
function parseDiscordChannelLink(url: string): { guildId: string; channelId: string; messageId?: string } | null {
  const match = url.match(/discord(?:app)?\.com\/channels\/(\d+)\/(\d+)(?:\/(\d+))?/);
  if (!match) return null;
  return {
    guildId: match[1]!,
    channelId: match[2]!,
    messageId: match[3],
  };
}

/**
 * 提取 content 中需要解析的 ID（使用 Set 去重，O(n) 复杂度）
 */
export function extractContentIds(content: string): { userIds: string[]; threadIds: string[] } {
  const userIdSet = new Set<string>();
  const threadIdSet = new Set<string>();

  // 提取用户 ID: <@userid> 或 <@!userid>
  for (const match of content.matchAll(/<@!?(\d+)>/g)) {
    userIdSet.add(match[1]!);
  }

  // 提取本服务器旅程链接中的 channelId (thread_id)
  for (const match of content.matchAll(/https?:\/\/discord(?:app)?\.com\/channels\/(\d+)\/(\d+)(?:\/\d+)?/g)) {
    if (match[1] === OPZ_GUILD_ID) {
      threadIdSet.add(match[2]!);
    }
  }

  return { userIds: [...userIdSet], threadIds: [...threadIdSet] };
}

/**
 * 预处理：在 Markdown 渲染前处理 Discord 特殊格式
 */
function preProcess(content: string): string {
  let result = content;

  // 1. Discord 自定义表情: <:name:id> 或 <a:name:id>
  result = result.replace(/<(a)?:(\w+):(\d+)>/g, (_, animated, name, id) => {
    const ext = animated ? 'gif' : 'png';
    return `%%EMOJI:${name}:${id}:${ext}%%`;
  });

  // 2. Discord 用户提及: <@userid> 或 <@!userid>
  result = result.replace(/<@!?(\d+)>/g, (_, userId) => {
    return `%%MENTION:${userId}%%`;
  });

  // 3. Discord 遮罩/剧透: ||内容||，使用私有区字符作为占位符
  result = result.replace(/\|\|([^|]+)\|\|/g, '\uE000SP\uE001$1\uE000/SP\uE001');

  // 4. 修复粗体语法：**内容** 紧邻中文字符时无法解析，使用 Unicode 私有区字符作为占位符
  result = result.replace(/\*\*([^*]+)\*\*/g, '\uE000B\uE001$1\uE000/B\uE001');

  // 5. *内容* 或 _内容_ 紧邻中文字符时无法解析，先处理粗体再处理斜体，避免冲突
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '\uE000I\uE001$1\uE000/I\uE001');

  // 6. Discord 小字/副标题语法: -# 内容
  // 需要在行首，渲染为灰色小字
  result = result.replace(/^-#\s+(.+)$/gm, '\uE000ST\uE001$1\uE000/ST\uE001');

  return result;
}

/**
 * 后处理：在 Markdown 渲染后处理占位符和链接
 */
function postProcess(html: string, metadata?: ContentMetadata): string {
  let result = html;

  // 还原用户提及 - 如有元数据则显示真实用户名并支持点击跳转
  result = result.replace(/%%MENTION:(\d+)%%/g, (_, userId) => {
    const displayName = metadata?.users.get(userId);
    if (displayName) {
      return `<a href="/user/${userId}" class="discord-mention discord-mention-resolved" data-user-id="${userId}">@${displayName}</a>`;
    }
    return `<span class="discord-mention" data-user-id="${userId}">@用户</span>`;
  });

  // 还原 Discord 表情
  result = result.replace(/%%EMOJI:(\w+):(\d+):(\w+)%%/g, (_, name, id, ext) => {
    const url = `https://cdn.discordapp.com/emojis/${id}.${ext}`;
    return `<img class="discord-emoji" src="${url}" alt=":${name}:" title=":${name}:">`;
  });

  // 还原 Discord 遮罩/剧透（使用非贪婪匹配，支持内部包含其他格式如粗体）
  result = result.replace(
    /\uE000SP\uE001([\s\S]*?)\uE000\/SP\uE001/g,
    '<span class="discord-spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>'
  );

  // 还原粗体
  result = result.replace(/\uE000B\uE001([^\uE000]*)\uE000\/B\uE001/g, '<strong>$1</strong>');

  // 还原斜体
  result = result.replace(/\uE000I\uE001([^\uE000]*)\uE000\/I\uE001/g, '<em>$1</em>');

  // 还原小字/副标题
  result = result.replace(/\uE000ST\uE001([^\uE000]*)\uE000\/ST\uE001/g, '<span class="discord-subtext">$1</span>');

  // 处理 Discord CDN 文件链接 (图片、视频等) - 直接打开
  result = result.replace(
    /<a\s+([^>]*href="(https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/[^"]+\.(\w+)(?:\?[^"]*)?)"[^>]*)>([^<]*)<\/a>/gi,
    (_, _attrs, url, ext, _text) => {
      const label = getFileTypeLabel(ext);
      const safeUrl = escapeHtmlAttr(url);
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="discord-file-link">${label}</a>`;
    }
  );

  // 处理 Discord 频道链接 - 用 data-discord-url 存储原始链接，由 PostContentRenderer 根据用户设置决定打开方式
  // 辅助函数：根据解析结果生成链接 HTML
  const renderDiscordChannelLink = (url: string, parsed: { guildId: string; channelId: string }) => {
    const safeUrl = escapeHtmlAttr(url);
    if (parsed.guildId === OPZ_GUILD_ID) {
      const title = metadata?.posts.get(parsed.channelId);
      if (title) {
        const safeTitle = escapeHtmlAttr(title);
        const shortTitle = title.length > 15 ? title.slice(0, 15) + '…' : title;
        const safeShortTitle = escapeHtmlAttr(shortTitle);
        return `<a href="#" class="discord-link discord-journey-link" data-discord-url="${safeUrl}" title="${safeTitle}" onclick="return false;">旅程 › ${safeShortTitle}</a>`;
      }
      return `<a href="#" class="discord-link" data-discord-url="${safeUrl}" onclick="return false;">旅程链接</a>`;
    } else if (parsed.guildId === LEIBAO_GUILD_ID) {
      return `<a href="#" class="discord-link" data-discord-url="${safeUrl}" onclick="return false;">类脑链接</a>`;
    } else {
      return `<a href="#" class="discord-link discord-other-server-link" data-discord-url="${safeUrl}" onclick="return false;">其他服务器链接</a>`;
    }
  };

  // 1. 处理已被 linkify 转成 <a> 标签的 Discord 频道链接
  result = result.replace(
    /<a\s+([^>]*href="(https:\/\/(?:discord\.com|discordapp\.com)\/channels\/[^"]+)"[^>]*)>([^<]*)<\/a>/gi,
    (match, _attrs, url) => {
      const parsed = parseDiscordChannelLink(url);
      if (!parsed) return match;
      return renderDiscordChannelLink(url, parsed);
    }
  );

  // 2. 处理裸 Discord 频道链接（被粗体/斜体包裹时 linkify 无法识别）
  // 负向后瞻排除已在 href、标签内、或 data-discord-url 中的 URL
  result = result.replace(
    /(?<!href="|">|url=")https:\/\/(?:discord\.com|discordapp\.com)\/channels\/\d+\/\d+(?:\/\d+)?/gi,
    (url) => {
      const parsed = parseDiscordChannelLink(url);
      if (!parsed) return url;
      return renderDiscordChannelLink(url, parsed);
    }
  );

  // 处理非 Discord 外部链接
  result = result.replace(/<a\s+([^>]*href="(https?:\/\/[^"]+)"[^>]*)>([^<]*)<\/a>/gi, (match, attrs, url, _text) => {
    // 跳过已处理的 Discord 链接
    if (isDiscordRelatedUrl(url)) return match;
    if (attrs.includes('discord-')) return match;

    const domain = extractDomain(url);
    const safeUrl = escapeHtmlAttr(url);
    return `<a ${attrs} class="external-link" data-url="${safeUrl}" onclick="return false;">${domain}链接</a>`;
  });

  return result;
}

/**
 * 渲染 Markdown 内容
 * @param metadata 可选的增强渲染元数据（用户名、旅程标题）
 */
export function renderMarkdown(content: string, metadata?: ContentMetadata): string {
  if (!content) return '';

  const preprocessed = preProcess(content);
  const html = md.render(preprocessed);
  return postProcess(html, metadata);
}
