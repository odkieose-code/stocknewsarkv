import { fetchSectors } from '../utils/api'
import { useQuery } from '@tanstack/react-query'

const FIXED_CATEGORIES = [
  { key: '매크로',    color: 'rgba(255,120,0,1)',   bg: 'rgba(255,120,0,0.13)',   border: 'rgba(255,120,0,0.6)' },
  { key: '실적',     color: 'rgba(160,100,255,1)', bg: 'rgba(160,100,255,0.13)', border: 'rgba(160,100,255,0.6)' },
  { key: '정책',     color: 'rgba(255,190,0,1)',   bg: 'rgba(255,190,0,0.13)',   border: 'rgba(255,190,0,0.6)' },
  { key: '종목',     color: 'rgba(0,210,100,1)',   bg: 'rgba(0,210,100,0.13)',   border: 'rgba(0,210,100,0.6)' },
  { key: '수급',     color: 'rgba(0,190,160,1)',   bg: 'rgba(0,190,160,0.13)',   border: 'rgba(0,190,160,0.6)' },
  { key: '섹터',     color: 'rgba(90,150,255,1)',  bg: 'rgba(90,150,255,0.13)',  border: 'rgba(90,150,255,0.6)' },
  { key: 'IPO·공시', color: 'rgba(255,70,70,1)',   bg: 'rgba(255,70,70,0.13)',   border: 'rgba(255,70,70,0.6)' },
  { key: '테마',     color: 'rgba(0,190,230,1)',   bg: 'rgba(0,190,230,0.13)',   border: 'rgba(0,190,230,0.6)' },
  { key: '기타',     color: 'rgba(160,160,160,1)', bg: 'rgba(160,160,160,0.10)', border: 'rgba(160,160,160,0.5)' },
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

  const countMap: Record<string, number> = {}
  if (sectors) {
    sectors.forEach(s => {
      const key = s.sector || '기타'
      countMap[key] = (countMap[key] || 0) + s.count
    })
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {FIXED_CATEGORIES.map(({ key, color, bg, border }) => {
        const isSelected = selectedKeyword === key
        const count = countMap[key] ?? 0

        return (
          <button
            key={key}
            onClick={() => onKeywordClick?.(key)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: isSelected ? 700 : 400,
              letterSpacing: '0.06em',
              padding: '5px 12px',
              border: `1px solid ${isSelected ? color : border}`,
              borderRadius: 5,
              background: isSelected ? bg : 'transparent',
              color: isSelected ? color : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              opacity: 1,
            }}
            onMouseEnter={e => {
              if (!isSelected) {
                const b = e.currentTarget as HTMLButtonElement
                b.style.background = bg
                b.style.borderColor = color
                b.style.color = color
              }
            }}
            onMouseLeave={e => {
              if (!isSelected) {
                const b = e.currentTarget as HTMLButtonElement
                b.style.background = 'transparent'
                b.style.borderColor = border
                b.style.color = 'var(--text-secondary)'
              }
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: color,
              display: 'inline-block', flexShrink: 0,
            }} />
            {key}
            {count > 0 && (
              <span style={{ fontSize: 9, opacity: 0.55 }}>{count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
