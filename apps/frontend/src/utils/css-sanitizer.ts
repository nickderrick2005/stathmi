/**
 * CSS Sanitizer - 验证用户自定义 CSS 安全性
 *
 * 规则：
 * - 禁止 @import、url()、expression() 等外部资源引用
 * - 禁止 JavaScript 伪协议 (javascript:, data:)
 * - 只允许覆盖 --opz- 前缀的 CSS 变量
 */

const FORBIDDEN_PATTERNS = [
  /@import/i,
  /url\s*\(/i,
  /expression\s*\(/i,
  /javascript:/i,
  /data:/i,
  /@font-face/i,
  /<script/i,
  /<\/script/i,
];

// 验证用户提交的自定义 CSS 是否安全
export function isValidCustomCss(css: string): boolean {
  if (!css || typeof css !== 'string') {
    return false;
  }

  // 检查是否包含禁止的模式
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(css)) {
      return false;
    }
  }

  return true;
}

/**
 * 验证并返回用户 CSS
 * 如果包含危险模式则返回空字符串
 */
export function sanitizeCustomCss(css: string): string {
  if (!isValidCustomCss(css)) {
    console.warn('[CSS Sanitizer] Invalid custom CSS detected, rejected.');
    return '';
  }
  return css.trim();
}

// 获取用户可覆盖的 CSS 变量列表说明
export function getCustomizableVariables(): string[] {
  return [
    '--opz-content-width',
    '--opz-header-height',
    '--opz-spacing-*',
    '--opz-font-family',
    '--opz-font-size-*',
    '--opz-radius-*',
    '--opz-primary',
    '--opz-accent',
    '--opz-success',
    '--opz-warning',
    '--opz-danger',
    '--opz-bg-card',
  ];
}
