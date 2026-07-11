/**
 * Web research for the agent.
 *
 * Two atoms:
 *   web_search(query, limit) → curated result list
 *   fetch_url(url)           → readable text of a page
 *
 * Backend: Tavily. Chosen because it's built for LLM agents (returns
 * pre-summarized snippets + a synthesized answer). Swap by changing this file.
 *
 * Quality strategy for niche hardware:
 *   - search_depth: 'advanced' (Tavily crawls deeper)
 *   - include_answer: true (bonus synthesized answer)
 *   - exclude_domains: known low-value hosts for hardware queries
 *   - Post-hoc re-rank: results from TRUSTED_DOMAINS float to the top
 *   - We do NOT filter down to only trusted domains — niche parts live in
 *     obscure places (AliExpress vendor pages, forum posts, random blogs).
 *     We just make sure a datasheet or Adafruit page wins ties.
 */

const TAVILY_URL = 'https://api.tavily.com/search';

// Domains that consistently return high-signal info for electronics work.
// Score is used to break ties in the returned list, not to gate results.
const TRUSTED_DOMAINS = new Map([
  // Chip vendors
  ['espressif.com', 10], ['docs.espressif.com', 10],
  ['ti.com', 10], ['analog.com', 10], ['st.com', 10],
  ['microchip.com', 10], ['nxp.com', 10], ['renesas.com', 10],
  ['infineon.com', 10],
  // Module/board makers
  ['arduino.cc', 9], ['docs.arduino.cc', 9], ['forum.arduino.cc', 8],
  ['adafruit.com', 9], ['learn.adafruit.com', 9],
  ['sparkfun.com', 9], ['learn.sparkfun.com', 9],
  ['seeedstudio.com', 8], ['wiki.seeedstudio.com', 8],
  ['pololu.com', 8], ['dfrobot.com', 7],
  // Community
  ['randomnerdtutorials.com', 8], ['hackaday.com', 7], ['hackaday.io', 6],
  ['hackster.io', 6], ['electronoobs.com', 6],
  // Reference
  ['en.wikipedia.org', 5],
  // GitHub — library issues are gold
  ['github.com', 7]
]);

// Zero-signal for hardware queries: video pages, image boards, low-answer QA
const EXCLUDE_DOMAINS = [
  'pinterest.com', 'quora.com', 'youtube.com', 'reddit.com/r/videos',
  'facebook.com', 'x.com', 'twitter.com', 'instagram.com', 'tiktok.com'
];

// 15-min LRU-ish cache (Map keeps insertion order; we cap at 50)
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 50;
const _cache = new Map();

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return entry.value;
}
function cacheSet(key, value) {
  if (_cache.size >= CACHE_MAX) {
    const firstKey = _cache.keys().next().value;
    _cache.delete(firstKey);
  }
  _cache.set(key, { at: Date.now(), value });
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
function trustedScore(host) {
  if (!host) return 0;
  if (TRUSTED_DOMAINS.has(host)) return TRUSTED_DOMAINS.get(host);
  // Match subdomain of a trusted apex (e.g. wiki.something.arduino.cc)
  for (const [d, score] of TRUSTED_DOMAINS) {
    if (host.endsWith('.' + d)) return Math.max(1, score - 2);
  }
  return 0;
}

async function webSearch({ query, limit = 5, apiKey }) {
  if (!apiKey) return { success: false, error: 'Tavily API key not set. Save one under Settings → API Keys as "tavily" (free at https://tavily.com).' };
  if (!query || typeof query !== 'string') return { success: false, error: 'query required' };

  const cacheKey = `search:${query}:${limit}`;
  const hit = cacheGet(cacheKey);
  if (hit) return { ...hit, cached: true };

  let resp;
  try {
    resp = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_answer: true,
        max_results: Math.min(Math.max(1, limit), 10),
        exclude_domains: EXCLUDE_DOMAINS
      })
    });
  } catch (e) { return { success: false, error: `Network error: ${e.message}` }; }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return { success: false, error: `Tavily ${resp.status}: ${text.slice(0, 200)}` };
  }

  let body;
  try { body = await resp.json(); }
  catch (e) { return { success: false, error: `Bad JSON from Tavily: ${e.message}` }; }

  const raw = Array.isArray(body.results) ? body.results : [];
  // Re-rank: original Tavily score is 0..1; add trusted-domain bonus.
  const ranked = raw.map(r => {
    const host = hostOf(r.url);
    const boost = trustedScore(host) / 10; // 0..1
    return {
      title: String(r.title || '').slice(0, 200),
      url: r.url,
      snippet: String(r.content || '').slice(0, 500),
      source: host,
      _score: (typeof r.score === 'number' ? r.score : 0.5) + boost
    };
  }).sort((a, b) => b._score - a._score).map(({ _score, ...rest }) => rest);

  const value = {
    success: true,
    query,
    answer: body.answer || null, // Tavily's synthesized answer, if any
    results: ranked
  };
  cacheSet(cacheKey, value);
  return value;
}

// ponytail: cheap HTML → readable text. Strips scripts/styles/nav/footer, unwraps
// tags. Not readability-grade but works fine for datasheets and article pages.
// Upgrade to @mozilla/readability only if we hit noisy extractions.
function htmlToText(html) {
  let s = String(html);
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  s = s.replace(/<(nav|header|footer|aside|form)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
  // Prefer <main> or <article> if present
  const main = s.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i);
  if (main) s = main[2];
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|h[1-6]|li|tr|div)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

async function fetchUrl({ url }) {
  if (!url || typeof url !== 'string') return { success: false, error: 'url required' };
  if (!/^https?:\/\//i.test(url)) return { success: false, error: 'Only http(s) URLs are allowed' };

  const cacheKey = `fetch:${url}`;
  const hit = cacheGet(cacheKey);
  if (hit) return { ...hit, cached: true };

  let resp;
  try {
    resp = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'ImpulseIDE/1.0 (+https://impulse.local)' }
    });
  } catch (e) { return { success: false, error: `Network error: ${e.message}` }; }

  if (!resp.ok) return { success: false, error: `HTTP ${resp.status} ${resp.statusText}` };

  const ct = resp.headers.get('content-type') || '';
  if (/pdf/i.test(ct)) {
    // ponytail: PDF datasheets are common. Skipped pdf-parse (~2 MB). Return
    // the URL so the user can open it manually. Add extraction if we hit this often.
    return { success: false, error: 'PDF content not yet supported. Ask the user to open the URL manually.', url };
  }

  let html;
  try { html = await resp.text(); }
  catch (e) { return { success: false, error: `Read error: ${e.message}` }; }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? htmlToText(titleMatch[1]).slice(0, 200) : '';
  let text = htmlToText(html);
  // Cap at 20k chars to protect the agent's context budget.
  const CAP = 20_000;
  const truncated = text.length > CAP;
  if (truncated) text = text.slice(0, CAP);

  const value = { success: true, url, title, text, truncated };
  cacheSet(cacheKey, value);
  return value;
}

function _resetCacheForTests() { _cache.clear(); }

module.exports = { webSearch, fetchUrl, htmlToText, trustedScore, _resetCacheForTests };
