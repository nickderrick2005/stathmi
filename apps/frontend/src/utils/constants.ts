export const ORIENTATION_OPTIONS = [
  { value: 'male', label: '男性向', desc: '后宫,少女等男性题材' },
  { value: 'female', label: '女性向', desc: 'BG,BL等女性题材' },
  { value: 'gay', label: '同志', desc: '男同性恋内容' },
  { value: 'les', label: '百合', desc: '女同性恋内容' },
  { value: 'non-binary', label: '其他', desc: '其他多元内容' },
];

export const DEFAULT_PAGE_SIZE = 20;

export const CHANNEL_FOLDING_THRESHOLD = 30;

/**
 * 频道默认封面图映射
 * key: 频道ID, value: 默认图片路径
 */
export const CHANNEL_DEFAULT_IMAGES: Record<string, string> = {
  '1337465200609202318': '/default-img/cards.png',
  '1337472547234517052': '/default-img/cards.png',
  '1337465571628810252': '/default-img/cards.png',
  '1337464937068494849': '/default-img/cards.png',
  '1337465614997917736': '/default-img/cards.png',
  '1337465711479754762': '/default-img/cards.png',
  '1337465998894301254': '/default-img/utils.png',
  '1374344730569216061': '/default-img/utils.png',
  '1374299109883908147': '/default-img/preset-prompts.png',
  '1374295248322170963': '/default-img/preset-prompts.png',
  '1374299634943529000': '/default-img/preset-prompts.png',
  '1374593434278563882': '/default-img/rec-chat.png',
  '1374357044802621530': '/default-img/rec-chat.png',
  '1374349684901937204': '/default-img/rec-chat.png',
  '1374299217174069359': '/default-img/ai-art.png',
  '1374319920678178868': '/default-img/ai-art.png',
  '1337465519799926794': '/default-img/tools.png',
  '1374299250241835109': '/default-img/tools.png',
};

/**
 * 根据频道ID获取默认封面图
 */
export function getChannelDefaultImage(channelId: string): string | undefined {
  return CHANNEL_DEFAULT_IMAGES[channelId];
}
