/** 内置新闻源配置（URL 与字段解析不可编辑） */
const NEWS_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const NEWS_SOURCES = {
  weibo: {
    id: 'weibo',
    name: '微博',
    url: 'https://api.xunjinlu.fun/api/rebang/weibo.php',
    parse(json) {
      return parseRebangList(json, '微博热搜', {
        rankByIndex: true,
        label: item => String(item.label || '').trim(),
      });
    },
  },
  baidu: {
    id: 'baidu',
    name: '百度',
    url: 'https://api.xunjinlu.fun/api/rebang/baidu.php',
    parse(json) {
      return parseRebangList(json, '百度热搜', {
        label: item => [item.hot_label, item.tag].filter(Boolean).join(' '),
        url: item => normalizeBaiduSearchUrl(item.url_raw || item.url || ''),
      });
    },
  },
  douyin: {
    id: 'douyin',
    name: '抖音',
    url: 'https://api.xunjinlu.fun/api/rebang/douyin.php',
    parse(json) {
      return parseRebangList(json, '抖音热搜', {
        label: item => String(item.label || '').trim(),
        hotText: item => String(item.hot_label || '').trim(),
      });
    },
  },
};

const NEWS_SOURCE_ORDER = ['baidu', 'weibo', 'douyin'];

function normalizeBaiduSearchUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.hostname = 'www.baidu.com';
    return parsed.toString();
  } catch {
    return raw.replace(/^https?:\/\/m\.baidu\.com/i, 'https://www.baidu.com');
  }
}

function parseRebangList(json, title, options = {}) {
  if (json?.code != 200 || !Array.isArray(json.data?.list)) {
    const msg = json?.msg || json?.message;
    throw new Error(msg ? String(msg) : (options.errorFallback || `${title}数据格式异常`));
  }

  return {
    title,
    updateTime: json.data.update_time || '',
    items: json.data.list.map((item, index) => {
      const hotTextFn = options.hotText;
      const urlFn = options.url;
      const labelFn = options.label;

      return {
        rank: options.rankByIndex ? index + 1 : (Number(item.rank) || index + 1),
        title: String(item.title || '').trim(),
        hot: item.hot_value,
        hotText: hotTextFn ? hotTextFn(item) : '',
        url: urlFn ? urlFn(item) : (item.url || ''),
        label: labelFn ? labelFn(item) : String(item.label || '').trim(),
      };
    }).filter(item => item.title),
  };
}

async function fetchNewsJson(url) {
  const resp = await fetch(url, { cache: 'no-store' });
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('接口响应解析失败');
  }
}

async function fetchNewsSource(sourceId) {
  const source = NEWS_SOURCES[sourceId];
  if (!source) throw new Error('未知新闻源');

  const json = await fetchNewsJson(source.url);
  return source.parse(json);
}

function formatNewsHot(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 100000000) return `${(n / 100000000).toFixed(1).replace(/\.0$/, '')}亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  return String(Math.round(n));
}

function escapeNewsHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getNewsHotText(item) {
  if (item?.hotText) return item.hotText;
  return formatNewsHot(item?.hot);
}

function getNewsAttribution() {
  return {
    name: '寻鲸录 API',
    url: 'https://api.xunjinlu.fun/',
  };
}
