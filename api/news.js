const HN_API = 'https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=30';

function normalizeItem(hit) {
  const title = (hit.title || hit.story_title || '').trim();
  const url = hit.url || hit.story_url || `https://news.ycombinator.com/item?id=${hit.objectID}`;

  if (!title || !url) return null;

  return {
    title,
    url,
    source: 'Hacker News',
    publishedAt: hit.created_at || null
  };
}

module.exports = async function handler(req, res) {
  try {
    const response = await fetch(HN_API, {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream error: ${response.status}`);
    }

    const data = await response.json();
    const items = (data.hits || [])
      .map(normalizeItem)
      .filter(Boolean)
      .slice(0, 20);

    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
    res.status(200).json({
      updatedAt: new Date().toISOString(),
      items
    });
  } catch (error) {
    res.status(500).json({
      message: '获取资讯失败',
      detail: error.message,
      updatedAt: new Date().toISOString(),
      items: []
    });
  }
};
