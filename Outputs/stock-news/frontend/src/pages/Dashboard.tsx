import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNews } from '../utils/api'
import StockPanel from '../components/StockPanel'
import KeywordCloud from '../components/KeywordCloud'
import { useTheme } from '../App'
import type { NewsItem } from '../types'

function useIsMobile() {
  const [v, setV] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  useEffect(() => {
    const fn = () => setV(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return v
}

function toMobileUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('finance.naver.com')) {
      const aid = u.searchParams.get('article_id'), oid = u.searchParams.get('office_id')
      if (aid && oid) return `https://n.news.naver.com/mnews/article/${oid}/${aid}`
    }
    if (u.hostname.includes('news.naver.com')) {
      const m = u.pathname.match(/\/article\/(\d+)\/(\d+)/)
      if (m) return `https://n.news.naver.com/mnews/article/${m[1]}/${m[2]}`
      const oid = u.searchParams.get('office_id') || u.searchParams.get('oid')
      const aid = u.searchParams.get('article_id') || u.searchParams.get('aid')
      if (oid && aid) return `https://n.news.naver.com/mnews/article/${oid}/${aid}`
    }
  } catch {}
  return url
}

// ── 티커 ─────────────────────────────────────────────────
interface TickerData { label: string; value: string; change: string; up: boolean | null }
const TICKER_FALLBACK: TickerData[] = ['KOSPI','KOSDAQ','USD/KRW','S&P500','NASDAQ','WTI','BTC/USD'].map(label => ({ label, value: '--', change: '', up: null }))

async function fetchTickerData(): Promise<TickerData[]> {
  try {
    const res = await fetch('/api/ticker', { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error('fail')
    return await res.json()
  } catch { return TICKER_FALLBACK }
}

function TickerBar() {
  const [items, setItems] = useState<TickerData[]>(TICKER_FALLBACK)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    fetchTickerData().then(d => { setItems(d); setLoaded(true) })
    const id = setInterval(() => fetchTickerData().then(setItems), 60_000)
    return () => clearInterval(id)
  }, [])
  const sextet = [...items, ...items, ...items, ...items, ...items, ...items]
  return (
    <div className="ticker-wrap">
      <div className={`ticker-track${loaded ? ' ticker-animate' : ''}`}>
        {sextet.map((item, i) => (
          <span className="ticker-item" key={i}>
            <span className="t-label">{item.label}</span>
            <span className="t-value">{item.value}</span>
            {item.change && <span className={item.up ? 't-up' : item.up === false ? 't-down' : 't-neutral'}>{item.change}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── 테마 토글 ─────────────────────────────────────────────
function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button onClick={toggle}
      style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', letterSpacing: '0.08em', transition: 'border-color 0.15s, color 0.15s' }}
      onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--border-strong)'; b.style.color = 'var(--text-secondary)' }}
      onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--border)'; b.style.color = 'var(--text-tertiary)' }}
    >
      {theme === 'dark' ? '◑ LIGHT' : '◐ DARK'}
    </button>
  )
}

// ── 시스템 상태 ───────────────────────────────────────────
const statusLines = [
  'FEED: NAVER FINANCE ............. OK',
  'AI ANALYSIS ENGINE .............. RDY',
  'DEDUP FILTER (TF-IDF) ........... ON',
  'SENTIMENT CLASSIFIER ............ ON',
]
function SystemStatus() {
  const [visible, setVisible] = useState(0)
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t1 = setInterval(() => setVisible(v => Math.min(v + 1, statusLines.length)), 400)
    const t2 = setInterval(() => setTime(new Date()), 1000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [])
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.8, letterSpacing: '0.04em' }}>
      <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>// SYSTEM STATUS</div>
      {statusLines.slice(0, visible).map((l, i) => <div key={i}>{l}</div>)}
      <div style={{ marginTop: 8, color: 'var(--text-tertiary)' }}>SYS_TIME: {time.toLocaleTimeString('ko-KR', { hour12: false })}</div>
    </div>
  )
}

function LiveDot() {
  return <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--positive)', marginRight: 6, animation: 'pulse-dot 1.5s ease-in-out infinite', verticalAlign: 'middle' }} />
}

// ── Market Pulse ──────────────────────────────────────────
function MarketPulse({ newsData }: { newsData?: { items: NewsItem[]; total: number } }) {
  const cnt = { positive: 0, neutral: 0, negative: 0 }
  newsData?.items.forEach(n => {
    if (n.sentiment === 'positive') cnt.positive++
    else if (n.sentiment === 'negative') cnt.negative++
    else cnt.neutral++
  })
  const total = newsData?.items.length ?? 0
  const posRatio = total > 0 ? Math.round((cnt.positive / total) * 100) : 0
  const negRatio = total > 0 ? Math.round((cnt.negative / total) * 100) : 0
  const neuRatio = total > 0 ? 100 - posRatio - negRatio : 0
  const hot = newsData?.items
    .filter(n => (n.importance_score ?? 0) >= 80)
    .sort((a, b) => (b.importance_score ?? 0) - (a.importance_score ?? 0))
    .slice(0, 3) ?? []

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', fontFamily: 'var(--font-mono)', background: 'var(--bg-card)' }}>
      <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>// MARKET PULSE</div>
      <div style={{ padding: 14 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.08em' }}>SENTIMENT DIST.</div>
          <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--bg-input)', gap: 1 }}>
            {total > 0 ? (
              <>
                <div style={{ flex: cnt.positive, background: 'var(--positive)', transition: 'flex 0.8s ease', minWidth: cnt.positive > 0 ? 2 : 0 }} />
                <div style={{ flex: cnt.neutral, background: 'var(--border-strong)', transition: 'flex 0.8s ease', minWidth: cnt.neutral > 0 ? 2 : 0 }} />
                <div style={{ flex: cnt.negative, background: 'var(--negative)', transition: 'flex 0.8s ease', minWidth: cnt.negative > 0 ? 2 : 0 }} />
              </>
            ) : <div style={{ flex: 1, background: 'var(--border)', animation: 'breathe 2s ease infinite' }} />}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9 }}>
            <span style={{ color: 'var(--positive)', fontWeight: 600 }}>▲ {cnt.positive}{total > 0 ? ` (${posRatio}%)` : ''}</span>
            {/* neutral은 퍼센트만, 라벨 없이 */}
            <span style={{ color: 'var(--text-tertiary)' }}>{total > 0 ? `${neuRatio}%` : '--'}</span>
            <span style={{ color: 'var(--negative)', fontWeight: 600 }}>▼ {cnt.negative}{total > 0 ? ` (${negRatio}%)` : ''}</span>
          </div>
        </div>

        {hot.length > 0 ? (
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: '0.08em', borderTop: '1px solid var(--border)', paddingTop: 10 }}>↑ HOT NEWS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {hot.map((n, idx) => (
                <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '8px 10px', borderRadius: 5, background: 'var(--bg-input)', border: '1px solid var(--border)', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'}
                  >
                    <div style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 1 }}>0{idx + 1}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-primary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                        {(n.importance_score ?? 0) >= 90 && <span style={{ marginRight: 4 }}>🔥</span>}
                        {n.title}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 18 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{n.source}</span>
                      {n.sentiment !== 'neutral' && (
                        <span style={{ fontSize: 8, color: n.sentiment === 'positive' ? 'var(--positive)' : 'var(--negative)', letterSpacing: '0.06em' }}>
                          {n.sentiment === 'positive' ? '▲ POS' : '▼ NEG'}
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : total === 0 ? (
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', padding: '10px 0', borderTop: '1px solid var(--border)', marginTop: 4 }}>
            <div>데이터 로딩 중...</div>
            <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>FETCHING MARKET DATA</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── 뉴스 라벨 ─────────────────────────────────────────────
function getNewsLabels(news: NewsItem) {
  const labels: { text: string; color: string; bg: string }[] = []
  const t = news.title

  // sentiment - neutral 제거
  if (news.sentiment === 'positive') labels.push({ text: '▲ 긍정', color: 'var(--positive)', bg: 'rgba(0,210,100,0.08)' })
  else if (news.sentiment === 'negative') labels.push({ text: '▼ 부정', color: 'var(--negative)', bg: 'rgba(255,75,75,0.08)' })

  // 중요도
  if ((news.importance_score ?? 0) >= 90) labels.push({ text: '🔥 HOT', color: 'rgba(255,140,0,1)', bg: 'rgba(255,140,0,0.08)' })
  else if ((news.importance_score ?? 0) >= 80) labels.push({ text: '↑ 주목', color: 'var(--accent)', bg: 'var(--accent-soft)' })

  // 키워드 기반 카테고리 라벨 (색상 통일)
  if (/실적|영업이익|매출|어닝/.test(t)) labels.push({ text: '실적', color: 'rgba(160,100,255,1)', bg: 'rgba(160,100,255,0.08)' })
  if (/AI|반도체|배터리|HBM/.test(t)) labels.push({ text: '테마', color: 'rgba(0,190,230,1)', bg: 'rgba(0,190,230,0.08)' })
  if (/미국|연준|Fed|금리|환율|CPI|FOMC/.test(t)) labels.push({ text: '매크로', color: 'rgba(255,120,0,1)', bg: 'rgba(255,120,0,0.08)' })
  if (/공시|상장|IPO|유상증자/.test(t)) labels.push({ text: 'IPO·공시', color: 'rgba(255,70,70,1)', bg: 'rgba(255,70,70,0.08)' })
  if (/M&A|인수|합병/.test(t)) labels.push({ text: 'M&A', color: 'rgba(255,190,0,1)', bg: 'rgba(255,190,0,0.08)' })

  return labels.slice(0, 3)
}

// ── 뉴스 카드 ─────────────────────────────────────────────
function NewsCardItem({ news, onClick, selected, isMobile }: { news: NewsItem; onClick: () => void; selected: boolean; isMobile: boolean }) {
  const labels = getNewsLabels(news)
  const timeAgo = (() => {
    const diff = Date.now() - new Date(news.published_at).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return h > 0 ? `${h}시간 전` : m > 0 ? `${m}분 전` : '방금'
  })()

  const handleClick = () => {
    if (isMobile) window.open(toMobileUrl(news.url), '_blank', 'noopener,noreferrer')
    else onClick()
  }

  return (
    <div onClick={handleClick}
      style={{ padding: '12px 14px', border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, background: selected ? 'var(--accent-soft)' : 'var(--bg-card)', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s', fontFamily: 'var(--font-mono)' }}
      onMouseEnter={e => { if (!selected) { const d = e.currentTarget as HTMLDivElement; d.style.background = 'var(--bg-card-hover)'; d.style.borderColor = 'var(--border-strong)' } }}
      onMouseLeave={e => { if (!selected) { const d = e.currentTarget as HTMLDivElement; d.style.background = 'var(--bg-card)'; d.style.borderColor = 'var(--border)' } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
        {(news.importance_score ?? 0) >= 80 && (
          <span style={{ fontSize: 9, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap', marginTop: 2, flexShrink: 0 }}>HOT</span>
        )}
        <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55, margin: 0, fontWeight: 500, flex: 1 }}>{news.title}</p>
      </div>
      {news.summary && (
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 7px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const }}>{news.summary}</p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        {/* 섹터 태그 */}
        {news.sector && (
          <span style={{ fontSize: 9, padding: '1px 6px', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-secondary)' }}>{news.sector}</span>
        )}
        {/* 라벨들 - neutral 제거됨 */}
        {labels.map(lb => (
          <span key={lb.text} style={{ fontSize: 9, padding: '1px 6px', border: `1px solid ${lb.color}`, borderRadius: 3, color: lb.color, background: lb.bg }}>{lb.text}</span>
        ))}
        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{news.source} · {timeAgo}</span>
      </div>
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────
export default function Dashboard() {
  const [selectedSector, setSelectedSector] = useState<string>()
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const isMobile = useIsMobile()

  const { data: newsData, isLoading, isError } = useQuery({
    queryKey: ['news', selectedSector],
    queryFn: () => fetchNews({ sector: selectedSector, page_size: 30 }),
    refetchInterval: 1000 * 60 * 2,
    retry: 3,
  })

  const handleSectorClick = useCallback((sector: string) => {
    setSelectedSector(prev => prev === sector ? undefined : sector)
  }, [])

  const Sidebar = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <MarketPulse newsData={newsData} />
      <StockPanel />
      {!isMobile && selectedNews && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)', fontFamily: 'var(--font-mono)' }}>
          {selectedNews.thumbnail && <img src={selectedNews.thumbnail} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />}
          <div style={{ padding: 13 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 8 }}>// SELECTED</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {selectedNews.sector && <span style={{ fontSize: 9, padding: '2px 7px', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--accent)' }}>{selectedNews.sector}</span>}
              {getNewsLabels(selectedNews).map(lb => (
                <span key={lb.text} style={{ fontSize: 9, padding: '2px 7px', border: `1px solid ${lb.color}`, borderRadius: 3, color: lb.color, background: lb.bg }}>{lb.text}</span>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 8, fontWeight: 500 }}>{selectedNews.title}</p>
            {selectedNews.summary && <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>{selectedNews.summary}</p>}
            <a href={selectedNews.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em', textDecoration: 'none' }}>OPEN SOURCE →</a>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: 48 }}>

      {/* 모바일 Bottom Sheet */}
      {isMobile && (
        <>
          <div onClick={() => setSelectedNews(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, opacity: selectedNews ? 1 : 0, pointerEvents: selectedNews ? 'auto' : 'none', transition: 'opacity 0.25s' }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-primary)', borderRadius: '16px 16px 0 0', border: '1px solid var(--border)', zIndex: 201, maxHeight: '80vh', overflowY: 'auto', transform: selectedNews ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} />
            </div>
            {selectedNews && (
              <>
                {selectedNews.thumbnail && <img src={selectedNews.thumbnail} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />}
                <div style={{ padding: '14px 16px 32px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>// SELECTED</span>
                    <button onClick={() => setSelectedNews(null)} style={{ fontSize: 18, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    {selectedNews.sector && <span style={{ fontSize: 9, padding: '2px 7px', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--accent)' }}>{selectedNews.sector}</span>}
                    {getNewsLabels(selectedNews).map(lb => (
                      <span key={lb.text} style={{ fontSize: 9, padding: '2px 7px', border: `1px solid ${lb.color}`, borderRadius: 3, color: lb.color, background: lb.bg }}>{lb.text}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 10, fontWeight: 500 }}>{selectedNews.title}</p>
                  {selectedNews.summary && <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>{selectedNews.summary}</p>}
                  <a href={toMobileUrl(selectedNews.url)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.08em', textDecoration: 'none', padding: '8px 14px', border: '1px solid var(--accent)', borderRadius: 4 }}>
                    원문 보기 →
                  </a>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <TickerBar />

      <header style={{ borderBottom: '1px solid var(--border)', padding: isMobile ? '13px 16px' : '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--header-bg)', backdropFilter: 'blur(12px)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? 13 : 17, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0 }}>STOCK_NEWS</h1>
          <span style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>v1.0.0</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeToggle />
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
            <LiveDot />LIVE · 2MIN
          </div>
        </div>
      </header>

      <div style={{ maxWidth: isMobile ? 'unset' : 1400, margin: '0 auto', padding: isMobile ? '14px 12px 0' : '22px 24px 0' }}>

        {isMobile ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              // CATEGORY
              {selectedSector && <button onClick={() => setSelectedSector(undefined)} style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'none', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>ALL ×</button>}
            </div>
            <div style={{ overflowX: 'auto', paddingBottom: 4 }} className="scrollbar-hide">
              <KeywordCloud onKeywordClick={handleSectorClick} selectedKeyword={selectedSector} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, marginBottom: 22 }}>
            <SystemStatus />
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                // CATEGORY
                {selectedSector && <button onClick={() => setSelectedSector(undefined)} style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'none', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>ALL ×</button>}
              </div>
              <KeywordCloud onKeywordClick={handleSectorClick} selectedKeyword={selectedSector} />
            </div>
          </div>
        )}

        <div style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: '1fr 290px', gap: 20 }}>
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>// NEWS FEED</span>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                {selectedSector ? `[${selectedSector}] ${newsData?.total ?? 0}건` : `TOTAL: ${newsData?.total ?? 0}`}
              </span>
              {isError && <span style={{ fontSize: 9, color: 'var(--negative)', marginLeft: 'auto' }}>⚠ API 연결 오류</span>}
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[1,2,3,4,5].map(i => <div key={i} style={{ height: 80, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, animation: 'breathe 1.5s ease infinite', animationDelay: `${i*0.1}s` }} />)}
              </div>
            ) : isError ? (
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)' }}>
                <div style={{ marginBottom: 6, color: 'var(--negative)' }}>FEED DISCONNECTED</div>
                <div style={{ fontSize: 10 }}>백엔드 서버에 연결할 수 없습니다</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {newsData?.items.map(news => (
                  <NewsCardItem key={news.id} news={news} onClick={() => setSelectedNews(prev => prev?.id === news.id ? null : news)} selected={selectedNews?.id === news.id} isMobile={isMobile} />
                ))}
                {(!newsData?.items || newsData.items.length === 0) && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)' }}>NO MATCHING NEWS</div>
                )}
              </div>
            )}

            {isMobile && <div style={{ marginTop: 20 }}><Sidebar /></div>}
          </section>

          {!isMobile && (
            <aside style={{ position: 'sticky', top: 66, alignSelf: 'flex-start' }}>
              <Sidebar />
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
