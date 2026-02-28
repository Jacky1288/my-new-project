const Parser = require('rss-parser');
const parser = new Parser({
  timeout: 8000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' }
});

// ── 可靠的公开 RSS 源 ──────────────────────────────────────
// 这些都是 X / 社交媒体热门话题的可靠替代来源
const SOURCES = [
  {
    label: 'X 热议科技',
    url: 'https://feeds.feedburner.com/TechCrunch',
    icon: '⚡'
  },
  {
    label: 'X 热议 AI',
    url: 'https://hnrss.org/frontpage',
    icon: '🤖'
  },
  {
    label: 'Google 全球热搜',
    url: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=US',
    icon: '🔥'
  },
  {
    label: '纽约时报头条',
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
    icon: '📰'
  },
  {
    label: 'BBC 全球新闻',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    icon: '🌍'
  }
];

// ── 翻译工具（MyMemory 免费 API，无需 Key）──────────────────
async function translateText(text) {
  if (!text || text.trim() === '') return '';
  try {
    const trimmed = text.slice(0, 450); // MyMemory 单次上限 500 chars
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|zh-CN`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.responseStatus === 200) return data.responseData.translatedText;
    return text;
  } catch {
    return text;
  }
}

// ── 逐源抓取，合并去重 ───────────────────────────────────
async function fetchFromSource(source) {
  try {
    const feed = await parser.parseURL(source.url);
    return feed.items.slice(0, 6).map(item => ({
      title: (item.title || '').trim(),
      url: item.link || '',
      publishedAt: item.pubDate || item.isoDate || null,
      source: source.label,
      icon: source.icon
    }));
  } catch (err) {
    console.warn(`[feed error] ${source.label}:`, err.message);
    return [];
  }
}

// ── Vercel Serverless 入口 ───────────────────────────────
module.exports = async function handler(req, res) {
  try {
    // 并行抓取全部源
    const results = await Promise.all(SOURCES.map(fetchFromSource));
    const rawItems = results.flat().filter(i => i.title && i.url);

    // 翻译（顺序执行避免 429，最多 20 条）
    const limited = rawItems.slice(0, 20);
    const items = [];
    for (const item of limited) {
      const title_zh = await translateText(item.title);
      items.push({ ...item, title_zh });
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({
      updatedAt: new Date().toISOString(),
      items
    });
  } catch (err) {
    res.status(500).json({ message: '获取资讯失败', error: err.message });
  }
};

