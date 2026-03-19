import { useQuery } from '@tanstack/react-query'
import { fetchTrendingKeywords, fetchSectors } from '../utils/api'

// ── 고정 카테고리 순서 & 색상 ─────────────────────────────
const FIXED_CATEGORIES = [
  { key: '매크로',   color: 'rgba(255,120,0,1)',   bg: 'rgba(255,120,0,0.10)',   border: 'rgba(255,120,0,0.4)' },
  { key: '실적',    color: 'rgba(160,100,255,1)', bg: 'rgba(160,100,255,0.10)', border: 'rgba(160,100,255,0.4)' },
  { key: '정책',    color: 'rgba(255,190,0,1)',   bg: 'rgba(255,190,0,0.10)',   border: 'rgba(255,190,0,0.4)' },
  { key: '종목',    color: 'rgba(0,210,100,1)',   bg: 'rgba(0,210,100,0.10)',   border: 'rgba(0,210,100,0.4)' },
  { key: '수급',    color: 'rgba(0,190,160,1)',   bg: 'rgba(0,190,160,0.10)',   border: 'rgba(0,190,160,0.4)' },
  { key: '섹터',    color: 'rgba(90,150,255,1)',  bg: 'rgba(90,150,255,0.10)',  border: 'rgba(90,150,255,0.4)' },
  { key: 'IPO·공시', color: 'rgba(255,70,70,1)',   bg: 'rgba(255,70,70,0.10)',   border: 'rgba(255,70,70,0.4)' },
  { key: '테마',    color: 'rgba(0,190,230,1)',   bg: 'rgba(0,190,230,0.10)',   border: 'rgba(0,190,230,0.4)' },
  { key: '기타',    color: 'rgba(180,180,180,1)', bg: 'rgba(180,180,180,0.08)', border: 'rgba(180,180,180,0.3)' },
]

interface KeywordCloudProps {
  onKeywordClick?: (keyword: string) => void
  selectedKeyword?: string
}

export default function KeywordCloud({ onKeywordClick, selectedKeyword }: KeywordCloudProps) {
  const { data: keywords, isLoading: kwLoading } = useQuery({
    queryKey: ['trendingKeywords'],
    queryFn: () => fetchTrendingKeywords(1, 15),
    refetchInterval: 1000 * 60 * 5,
  })

  const { data: sectors } = useQuery({
    queryKey: ['sectors'],
    queryFn: () => fetchSectors(),
    refetchInterval: 1000 * 60 * 5,
  })

  // 카테고리별 뉴스 카운트 맵 (있으면 표시, 없으면 0)
  const countMap: Record<string, number> = {}
  if (sectors) {
    sectors.forEach(s => {
      const key = s.sector || '기타'
      countMap[key] = (countMap[key] || 0) + s.count
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── 고정 카테고리 필터 ── */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {FIXED_CATEGORIES.map(({ key, color, bg, border }) => {
          const isSelected = selectedKeyword === key
          const count = countMap[key] ?? 0
          return (
            <button
              key={key}
              onClick={() => onKeywordClick?.(key)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.07em',
                padding: '4px 10px',
                border: `1px solid ${isSelected ? color : border}`,
                borderRadius: 4,
                background: isSelected ? bg : 'transparent',
                color: color,
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                opacity: count === 0 ? 0.35 : 1,
              }}
              onMouseEnter={e => {
                if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = bg
              }}
              onMouseLeave={e => {
                if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              {key}
              {count > 0 && <span style={{ opacity: 0.5, fontSize: 9 }}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* ── 트렌딩 키워드 ── */}
      {!kwLoading && keywords && keywords.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {keywords.map((kw, idx) => {
            const intensity = Math.max(0.35, 1 - idx * 0.05)
            const isSelected = selectedKeyword === kw.keyword
            return (
              <button
                key={kw.keyword}
                onClick={() => onKeywordClick?.(kw.keyword)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.07em',
                  padding: '4px 10px',
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 4,
                  background: isSelected ? 'var(--accent-soft)' : 'transparent',
                  color: isSelected ? 'var(--accent)' : `rgba(90,150,255,${intensity})`,
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-soft)'
                }}
                onMouseLeave={e => {
                  if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                {kw.keyword}
                <span style={{ marginLeft: 4, opacity: 0.45, fontSize: 9 }}>{kw.count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* 로딩 스켈레톤 */}
      {kwLoading && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[80,60,90,70,55,75,65].map((w, i) => (
            <div key={i} style={{ height: 26, width: w, background: 'var(--bg-input)', borderRadius: 4, opacity: 0.4, animation: 'breathe 1.5s ease infinite', animationDelay: `${i*0.1}s` }} />
          ))}
        </div>
      )}
    </div>
  )
}
