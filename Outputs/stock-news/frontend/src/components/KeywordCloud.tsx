import { useQuery } from '@tanstack/react-query'
import { fetchSectors } from '../utils/api'

// ── 고정 카테고리 순서 & 색상 ─────────────────────────────
const FIXED_CATEGORIES = [
  { key: '매크로',    color: 'rgba(255,120,0,1)',   bg: 'rgba(255,120,0,0.12)',   border: 'rgba(255,120,0,0.5)' },
  { key: '실적',     color: 'rgba(160,100,255,1)', bg: 'rgba(160,100,255,0.12)', border: 'rgba(160,100,255,0.5)' },
  { key: '정책',     color: 'rgba(255,190,0,1)',   bg: 'rgba(255,190,0,0.12)',   border: 'rgba(255,190,0,0.5)' },
  { key: '종목',     color: 'rgba(0,210,100,1)',   bg: 'rgba(0,210,100,0.12)',   border: 'rgba(0,210,100,0.5)' },
  { key: '수급',     color: 'rgba(0,190,160,1)',   bg: 'rgba(0,190,160,0.12)',   border: 'rgba(0,190,160,0.5)' },
  { key: '섹터',     color: 'rgba(90,150,255,1)',  bg: 'rgba(90,150,255,0.12)',  border: 'rgba(90,150,255,0.5)' },
  { key: 'IPO·공시', color: 'rgba(255,70,70,1)',   bg: 'rgba(255,70,70,0.12)',   border: 'rgba(255,70,70,0.5)' },
  { key: '테마',     color: 'rgba(0,190,230,1)',   bg: 'rgba(0,190,230,0.12)',   border: 'rgba(0,190,230,0.5)' },
  { key: '기타',     color: 'rgba(180,180,180,1)', bg: 'rgba(180,180,180,0.10)', border: 'rgba(180,180,180,0.4)' },
]

interface KeywordCloudProps {
  onKeywordClick?: (keyword: string) => void
  selectedKeyword?: string
}

export default function KeywordCloud({ onKeywordClick, selectedKeyword }: KeywordCloudProps) {
  const { data: sectors } = useQuery({
    queryKey: ['sectors'],
    queryFn: () => fetchSectors(),
    refetchInterval: 1000 * 60 * 5,
  })

  // 카테고리별 뉴스 카운트 맵
  const countMap: Record<string, number> = {}
  if (sectors) {
    sectors.forEach(s => {
      const key = s.sector || '기타'
      countMap[key] = (countMap[key] || 0) + s.count
    })
  }

  // 필터 모드: 선택된 카테고리만 표시, 나머지 숨김
  const visibleCategories = selectedKeyword
    ? FIXED_CATEGORIES.filter(c => c.key === selectedKeyword)
    : FIXED_CATEGORIES

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {visibleCategories.map(({ key, color, bg, border }) => {
        const isSelected = selectedKeyword === key
        const count = countMap[key] ?? 0
        const hasNews = count > 0

        return (
          <button
            key={key}
            onClick={() => onKeywordClick?.(key)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: isSelected ? 700 : 500,
              letterSpacing: '0.06em',
              padding: '5px 12px',
              border: `1px solid ${isSelected ? color : hasNews ? border : 'var(--border)'}`,
              borderRadius: 5,
              background: isSelected ? bg : 'transparent',
              color: isSelected ? color : hasNews ? color : 'var(--text-ghost)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseEnter={e => {
              if (!isSelected && hasNews) {
                const b = e.currentTarget as HTMLButtonElement
                b.style.background = bg
                b.style.borderColor = color
              }
            }}
            onMouseLeave={e => {
              if (!isSelected) {
                const b = e.currentTarget as HTMLButtonElement
                b.style.background = 'transparent'
                b.style.borderColor = hasNews ? border : 'var(--border)'
              }
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: hasNews ? color : 'var(--text-ghost)',
              display: 'inline-block', flexShrink: 0,
            }} />
            {key}
            {hasNews && (
              <span style={{ fontSize: 9, opacity: 0.55 }}>{count}</span>
            )}
            {isSelected && (
              <span style={{ fontSize: 13, opacity: 0.5, marginLeft: 1 }}>×</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
