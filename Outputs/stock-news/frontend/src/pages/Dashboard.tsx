import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNews } from '../utils/api'
import NewsCard from '../components/NewsCard'
import StockPanel from '../components/StockPanel'
import KeywordCloud from '../components/KeywordCloud'
import type { NewsItem } from '../types'

// ── 모바일 감지 ───────────────────────────────────────────
function useIsMobile() {
  const [v, setV] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  useEffect(() => {
    const fn = () => setV(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return v
}

// ── 티커 데이터 ───────────────────────────────────────────
interface TickerData { label: string; value: string; change: string; up: boolean | null }

const TICKER_FALLBACK: TickerData[] = [
  'KOSPI', 'KOSDAQ', 'USD/KRW', 'S&P500', 'NASDAQ', 'WTI', 'BTC/USD',
].map(label => ({ label, value: '--', change: '', up: null }))

async function fetchTickerData(): Promise<TickerData[]> {
  try {
    const baseURL = import.meta.env.VITE_API_URL || ''
    const res = await fetch(`${baseURL}/api/ticker`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error('fetch fail')
    return await res.json()
  } catch {
    return TICKER_FALLBACK
  }
}

function TickerBar() {
  const [items, setItems] = useState<TickerData[]>(TICKER_FALLBACK)

  useEffect(() => {
    fetchTickerData().then(setItems)
    const id = setInterval(() => fetchTickerData().then(setItems), 60_000)
    return () => clearInterval(id)
  }, [])

  // 4벌 복사 → -25% 이동 = 1벌 분량만큼 이동 후 seamless reset
  const quad = [...items, ...items, ...items, ...items]

  return (
    <div className="ticker-wrap" style={{overflow:"hidden",borderBottom:"1px solid var(--border)",height:28,display:"flex",alignItems:"center",background:"rgba(0,0,0,0.02)",userSelect:"none"}}>
      <div className="ticker-track" style={{display:"flex",alignItems:"center",whiteSpace:"nowrap",willChange:"transform"}}>
        {quad.map((item, i) => (
          <span className="ticker-item" key={i} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"0 24px",fontSize:10,fontFamily:"var(--font-mono)",letterSpacing:"0.06em",boxShadow:"1px 0 0 rgba(0,0,0,0.1)",height:28,whiteSpace:"nowrap"}}>
            <span className="t-label" style={{color:"var(--text-ghost)"}}>{item.label}</span>
            <span className="t-value" style={{color:"var(--text-secondary)",fontWeight:500}}>{item.value}</span>
            {item.change && (
              <span className={item.up ? 't-up' : item.up === false ? 't-down' : ''}>
                {item.change}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
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
  useEffect(() => {
    const t = setInterval(() => setVisible(v => Math.min(v + 1, statusLines.length)), 400)
    return () => clearInterval(t)
  }, [])
  const now = new Date()
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.8, letterSpacing: '0.04em' }}>
      <div style={{ color: 'var(--text-ghost)', marginBottom: 4 }}>// SYSTEM STATUS</div>
      {statusLines.slice(0, visible).map((l, i) => <div key={i}>{l}</div>)}
      <div style={{ marginTop: 8, color: 'var(--text-ghost)' }}>SYS_TIME: {now.toLocaleTimeString('ko-KR', { hour12: false })}</div>
    </div>
  )
}

function LiveDot() {
  return <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--positive)', marginRight: 6, animation: 'pulse-dot 1.5s ease-in-out infinite', verticalAlign: 'middle' }} />
}

// ── Market Pulse (뉴스 데이터로 감성 분포 계산) ───────────
function MarketPulse({ newsData }: { newsData?: { items: NewsItem[]; total: number } }) {
  const cnt = { positive: 0, neutral: 0, negative: 0 }
  newsData?.items.forEach(n => {
    if (n.sentiment === 'positive') cnt.positive++
    else if (n.sentiment === 'negative') cnt.negative++
    else cnt.neutral++
  })
  const total = newsData?.items.length ?? 0
  const hot = newsData?.items.filter(n => (n.importance_score ?? 0) >= 80).slice(0, 3) ?? []

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontFamily: 'var(--font-mono)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-ghost)', letterSpacing: '0.1em', marginBottom: 12 }}>// MARKET PULSE</div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: 'var(--text-ghost)', marginBottom: 6, letterSpacing: '0.08em' }}>SENTIMENT DIST.</div>
        <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'var(--bg-input)' }}>
          {total > 0 && (
            <>
              <div style={{ flex: cnt.positive, background: 'var(--positive)', transition: 'flex 0.6s ease' }} />
              <div style={{ flex: cnt.neutral,  background: 'var(--border-strong)', transition: 'flex 0.6s ease' }} />
              <div style={{ flex: cnt.negative, background: 'var(--negative)', transition: 'flex 0.6s ease' }} />
            </>
          )}
          {total === 0 && <div style={{ flex: 1, background: 'var(--border)' }} />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9 }}>
          <span style={{ color: 'var(--positive)', fontWeight: 600 }}>▲ {cnt.positive}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>— {cnt.neutral}</span>
          <span style={{ color: 'var(--negative)', fontWeight: 600 }}>▼ {cnt.negative}</span>
        </div>
      </div>

      {hot.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-ghost)', marginBottom: 8, letterSpacing: '0.08em' }}>↑ HOT NEWS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hot.map(n => (
              <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ fontSize: 10, color: 'var(--text-primary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                  {(n.importance_score ?? 0) >= 90 && <span style={{ marginRight: 4 }}>🔥</span>}
                  {n.title}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-ghost)', marginTop: 2 }}>{n.source}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      {total === 0 && (
        <div style={{ fontSize: 10, color: 'var(--text-ghost)', textAlign: 'center', padding: '8px 0' }}>데이터 로딩 중...</div>
      )}
    </div>
  )
}

// ── URL 변환 ──────────────────────────────────────────────
function toMobileUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('finance.naver.com')) {
      const articleId = u.searchParams.get('article_id')
      const officeId = u.searchParams.get('office_id')
      if (articleId && officeId) return `https://n.news.naver.com/mnews/article/${officeId}/${articleId}`
    }
    if (u.hostname.includes('news.naver.com')) {
      const m = u.pathname.match(/\/article\/(\d+)\/(\d+)/)
      if (m) return `https://n.news.naver.com/mnews/article/${m[1]}/${m[2]}`
      const oid = u.searchParams.get('office_id') || u.searchParams.get('oid')
      const aid = u.searchParams.get('article_id') || u.searchParams.get('aid')
      if (oid && aid) return `https://n.news.naver.com/mnews/article/${oid}/${aid}`
    }
    if (u.hostname === 'n.news.naver.com') return url
  } catch {}
  return url
}

// ── 라벨 ──────────────────────────────────────────────────
function getNewsLabels(news: NewsItem): { text: string; color: string; bg: string }[] {
  const labels: { text: string; color: string; bg: string }[] = []
  const title = news.title
  if (news.sentiment === 'positive') labels.push({ text: '▲ 긍정', color: 'rgba(0,160,80,0.9)', bg: 'rgba(0,160,80,0.08)' })
  else if (news.sentiment === 'negative') labels.push({ text: '▼ 부정', color: 'rgba(220,40,40,0.9)', bg: 'rgba(220,40,40,0.08)' })
  if (news.importance_score) {
    if (news.importance_score >= 90) labels.push({ text: '🔥 HOT', color: 'rgba(220,80,0,0.9)', bg: 'rgba(220,80,0,0.08)' })
    else if (news.importance_score >= 80) labels.push({ text: '↑ 주목', color: 'rgba(0,71,255,0.85)', bg: 'rgba(0,71,255,0.08)' })
  }
  if (/급등|폭등|상한가|신고가/.test(title)) labels.push({ text: '급등', color: 'rgba(0,160,80,0.9)', bg: 'rgba(0,160,80,0.08)' })
  if (/급락|폭락|하한가|신저가/.test(title)) labels.push({ text: '급락', color: 'rgba(220,40,40,0.9)', bg: 'rgba(220,40,40,0.08)' })
  if (/실적|영업이익|매출|흑자|적자/.test(title)) labels.push({ text: '실적', color: 'rgba(100,60,180,0.9)', bg: 'rgba(100,60,180,0.08)' })
  if (/공시|공모|상장|IPO/.test(title)) labels.push({ text: '공시', color: 'rgba(180,60,60,0.9)', bg: 'rgba(180,60,60,0.08)' })
  if (/AI|반도체|배터리|2차전지/.test(title)) labels.push({ text: '테마', color: 'rgba(0,150,160,0.9)', bg: 'rgba(0,150,160,0.08)' })
  if (/미국|연준|Fed|금리|환율/.test(title)) labels.push({ text: '매크로', color: 'rgba(180,120,0,0.9)', bg: 'rgba(180,120,0,0.08)' })
  if (/인수|합병|M&A|매각/.test(title)) labels.push({ text: 'M&A', color: 'rgba(160,80,0,0.9)', bg: 'rgba(160,80,0,0.08)' })
  return labels.slice(0, 4)
}

// ── 메인 Dashboard ────────────────────────────────────────
export default function Dashboard() {
  const [selectedSector, setSelectedSector] = useState<string>()
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const isMobile = useIsMobile()

  const { data: newsData, isLoading } = useQuery({
    queryKey: ['news', selectedSector],
    queryFn: () => fetchNews({ sector: selectedSector, page_size: 30 }),
    refetchInterval: 1000 * 60 * 2,
  })

  const handleSectorClick = useCallback((sector: string) => {
    setSelectedSector(prev => prev === sector ? undefined : sector)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: 48 }}>

      {/* 모바일 Bottom Sheet */}
      {isMobile && (
        <>
          <div
            onClick={() => setSelectedNews(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, opacity: selectedNews ? 1 : 0, pointerEvents: selectedNews ? 'auto' : 'none', transition: 'opacity 0.25s' }}
          />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-primary)', borderRadius: '16px 16px 0 0', border: '1px solid var(--border)', zIndex: 201, maxHeight: '75vh', overflowY: 'auto', transform: selectedNews ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} />
            </div>
            {selectedNews && (
              <>
                {selectedNews.thumbnail && (
                  <img src={selectedNews.thumbnail} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                )}
                <div style={{ padding: '14px 16px 32px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-ghost)', letterSpacing: '0.1em' }}>// SELECTED</span>
                    <button onClick={() => setSelectedNews(null)} style={{ fontSize: 16, color: 'var(--text-ghost)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    {selectedNews.sector && (
                      <span style={{ fontSize: 9, padding: '2px 7px', border: '1px solid var(--border)', borderRadius: 3, color: 'rgba(0,71,255,0.7)' }}>{selectedNews.sector}</span>
                    )}
                    {getNewsLabels(selectedNews).map(lb => (
                      <span key={lb.text} style={{ fontSize: 9, padding: '2px 7px', border: `1px solid ${lb.color}`, borderRadius: 3, color: lb.color, background: lb.bg }}>{lb.text}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 10, fontWeight: 500 }}>{selectedNews.title}</p>
                  {selectedNews.summary && (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>{selectedNews.summary}</p>
                  )}
                  <a href={toMobileUrl(selectedNews.url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.08em', textDecoration: 'none' }}>OPEN SOURCE →</a>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* 티커 바 — 헤더 위에 배치 */}
      <TickerBar />

      {/* 헤더 */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: isMobile ? '14px 16px' : '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? 14 : 18, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0 }}>STOCK_NEWS</h1>
          <span style={{ fontSize: 9, color: 'var(--text-ghost)', letterSpacing: '0.1em' }}>v1.0.0</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
          <LiveDot />LIVE · 2MIN
        </div>
      </header>

      {/* 본문 */}
      <div style={{ maxWidth: isMobile ? 'unset' : 1400, margin: '0 auto', padding: isMobile ? '16px 16px 0' : '24px 24px 0' }}>

        {/* 상단: 시스템 상태 + 카테고리 */}
        {isMobile ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--text-ghost)', letterSpacing: '0.1em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              // CATEGORY
              {selectedSector && (
                <button onClick={() => setSelectedSector(undefined)} style={{ fontSize: 10, color: 'var(--text-ghost)', background: 'none', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>ALL ×</button>
              )}
            </div>
            <div style={{ overflowX: 'auto', paddingBottom: 4 }} className="scrollbar-hide">
              <KeywordCloud onKeywordClick={handleSectorClick} selectedKeyword={selectedSector} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, marginBottom: 24 }}>
            <SystemStatus />
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-ghost)', letterSpacing: '0.1em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                // CATEGORY
                {selectedSector && (
                  <button onClick={() => setSelectedSector(undefined)} style={{ fontSize: 10, color: 'var(--text-ghost)', background: 'none', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>ALL ×</button>
                )}
              </div>
              <KeywordCloud onKeywordClick={handleSectorClick} selectedKeyword={selectedSector} />
            </div>
          </div>
        )}

        {/* 메인 그리드 */}
        <div style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: 'var(--text-ghost)', letterSpacing: '0.1em' }}>// NEWS FEED</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                {selectedSector ? `[${selectedSector}] ${newsData?.total ?? 0}건` : `TOTAL: ${newsData?.total ?? 0}`}
              </span>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3,4,5].map(i => <div key={i} style={{ height: 80, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, opacity: 0.4 }} />)}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {newsData?.items.map(news => (
                  <NewsCard key={news.id} news={news} onClick={() => setSelectedNews(prev => prev?.id === news.id ? null : news)} selected={selectedNews?.id === news.id} />
                ))}
                {(!newsData?.items || newsData.items.length === 0) && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-ghost)', padding: 24, textAlign: 'center' }}>NO MATCHING NEWS</div>
                )}
              </div>
            )}
          </section>

          {/* 사이드바 */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: isMobile ? 'static' : 'sticky', top: isMobile ? 'unset' : 72, alignSelf: isMobile ? 'unset' : 'flex-start', marginTop: isMobile ? 16 : 0 }}>
            {/* MARKET PULSE — newsData 그대로 내려줌 */}
            <MarketPulse newsData={newsData} />

            {/* BENEFICIARY STOCKS */}
            <StockPanel />

            {/* PC 선택 뉴스 패널 */}
            {!isMobile && selectedNews && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)', fontFamily: 'var(--font-mono)' }}>
                {selectedNews.thumbnail && (
                  <img src={selectedNews.thumbnail} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                )}
                <div style={{ padding: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-ghost)', letterSpacing: '0.1em', marginBottom: 8 }}>// SELECTED</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {selectedNews.sector && (
                      <span style={{ fontSize: 9, padding: '2px 7px', border: '1px solid var(--border)', borderRadius: 3, color: 'rgba(0,71,255,0.7)' }}>{selectedNews.sector}</span>
                    )}
                    {getNewsLabels(selectedNews).map(lb => (
                      <span key={lb.text} style={{ fontSize: 9, padding: '2px 7px', border: `1px solid ${lb.color}`, borderRadius: 3, color: lb.color, background: lb.bg }}>{lb.text}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 10, fontWeight: 500 }}>{selectedNews.title}</p>
                  {selectedNews.summary && (
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>{selectedNews.summary}</p>
                  )}
                  <a href={selectedNews.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em', textDecoration: 'none' }}>OPEN SOURCE →</a>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
