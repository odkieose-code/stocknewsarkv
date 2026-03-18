import { useQuery } from '@tanstack/react-query'
import { fetchTrendingKeywords, fetchSectors } from '../utils/api'

// 카테고리 라벨 색상 매핑 (ai_analyzer와 동일한 라벨)
const CATEGORY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  '실적':    { color: 'rgba(160,100,255,1)', bg: 'rgba(160,100,255,0.10)', border: 'rgba(160,100,255,0.5)' },
  '정책':    { color: 'rgba(255,190,0,1)',   bg: 'rgba(255,190,0,0.10)',   border: 'rgba(255,190,0,0.5)' },
  '수급':    { color: 'rgba(0,190,160,1)',   bg: 'rgba(0,190,160,0.10)',   border: 'rgba(0,190,160,0.5)' },
  '매크로':  { color: 'rgba(255,120,0,1)',   bg: 'rgba(255,120,0,0.10)',   border: 'rgba(255,120,0,0.5)' },
  '섹터':    { color: 'rgba(90,150,255,1)',  bg: 'rgba(90,150,255,0.10)',  border: 'rgba(90,150,255,0.5)' },
  '종목':    { color: 'rgba(0,210,100,1)',   bg: 'rgba(0,210,100,0.10)',   border: 'rgba(0,210,100,0.5)' },
  'IPO·공시':{ color: 'rgba(255,70,70,1)',   bg: 'rgba(255,70,70,0.10)',   border: 'rgba(255,70,70,0.5)' },
  '테마':    { color: 'rgba(0,190,230,1)',   bg: 'rgba(0,190,230,0.10)',   border: 'rgba(0,190,230,0.5)' },
  '기타':    { color: 'rgba(180,180,180,1)', bg: 'rgba(180,180,180,0.08)', border: 'rgba(180,180,180,0.3)' },
}

// 섹터 색상 (기존 키워드 클라우드용)
const SECTOR_COLORS: Record<string, string> = {
  '반도체': 'rgba(90,150,255,1)',
  '2차전지': 'rgba(0,210,100,1)',
  '바이오': 'rgba(255,70,70,1)',
  'AI': 'rgba(0,190,230,1)',
  '금융': 'rgba(255,190,0,1)',
  '자동차': 'rgba(160,100,255,1)',
  '유통': 'rgba(255,120,0,1)',
  '에너지': 'rgba(255,200,50,1)',
  '건설': 'rgba(180,140,80,1)',
  '엔터': 'rgba(255,80,160,1)',
  '방산': 'rgba(120,180,80,1)',
  '조선': 'rgba(0,160,200,1)',
}

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

  if (kwLoading) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[80,60,90,70,55,75,65].map((w, i) => (
          <div key={i} style={{ height: 26, width: w, background: 'var(--bg-input)', borderRadius: 4, opacity: 0.4, animation: 'breathe 1.5s ease infinite', animationDelay: `${i*0.1}s` }} />
        ))}
      </div>
    )
  }

  // 카테고리 필터 버튼 (섹터 데이터 기반)
  const categoryFilters = sectors
    ? Object.entries(
        sectors.reduce((acc, s) => {
          const cat = s.sector || '기타'
          acc[cat] = (acc[cat] || 0) + s.count
          return acc
        }, {} as Record<string, number>)
      )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 카테고리 색상 필터 */}
      {categoryFilters.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {categoryFilters.map(([cat, count]) => {
            const style = CATEGORY_COLORS[cat] || CATEGORY_COLORS['기타']
            const isSelected = selectedKeyword === cat
            const sectorColor = SECTOR_COLORS[cat]
            const finalColor = sectorColor ? {
              color: sectorColor,
              bg: sectorColor.replace('1)', '0.10)'),
              border: sectorColor.replace('1)', '0.5)'),
            } : style

            return (
              <button
                key={cat}
                onClick={() => onKeywordClick?.(cat)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.07em',
                  padding: '4px 10px',
                  border: `1px solid ${isSelected ? finalColor.color : finalColor.border}`,
                  borderRadius: 4,
                  background: isSelected ? finalColor.bg : 'transparent',
                  color: finalColor.color,
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                onMouseEnter={e => {
                  if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = finalColor.bg
                }}
                onMouseLeave={e => {
                  if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: finalColor.color, display: 'inline-block', flexShrink: 0 }} />
                {cat}
                <span style={{ opacity: 0.5, fontSize: 9 }}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* 트렌딩 키워드 */}
      {keywords && keywords.length > 0 && (
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
                  color: isSelected ? 'var(--accent)' : `rgba(var(--accent-rgb, 90,150,255),${intensity})`,
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
    </div>
  )
}
