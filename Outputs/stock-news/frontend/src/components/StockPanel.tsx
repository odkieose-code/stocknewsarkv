import { useQuery } from '@tanstack/react-query'
import { fetchBeneficiaryStocks } from '../utils/api'
import type { BeneficiaryStock } from '../types'

// ── 수혜 등급 판정 기준 ──────────────────────────────────
// mention_count(언급 횟수) + avg_impact(AI 분석 영향도) 조합
//
// 🔥 강력 수혜  : 언급 3건↑ AND 영향 '상'
// ✦  수혜 유력  : 언급 2건↑ OR  영향 '상'
// ·  관심 종목  : 언급 1건,  영향 '중/하'

function getGrade(stock: BeneficiaryStock): {
  label: string; color: string; bg: string; border: string; icon: string
} {
  const { mention_count: m, avg_impact: imp } = stock
  if (m >= 3 && imp === '상') return {
    label: '강력 수혜', icon: '🔥',
    color: 'rgba(255,80,80,1)', bg: 'rgba(255,80,80,0.10)', border: 'rgba(255,80,80,0.5)',
  }
  if (m >= 2 || imp === '상') return {
    label: '수혜 유력', icon: '✦',
    color: 'var(--positive)', bg: 'rgba(0,200,100,0.09)', border: 'rgba(0,200,100,0.45)',
  }
  return {
    label: '관심 종목', icon: '·',
    color: 'var(--text-secondary)', bg: 'var(--bg-input)', border: 'var(--border)',
  }
}

export default function StockPanel() {
  const { data: stocks, isLoading, isError } = useQuery({
    queryKey: ['beneficiaryStocks'],
    queryFn: () => fetchBeneficiaryStocks(10),
    refetchInterval: 1000 * 60 * 5,
    retry: 2,
  })

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, overflow: 'hidden' }}>

      {/* 헤더 */}
      <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>// 오늘의 수혜주</span>
          <span style={{ fontSize: 9, color: 'var(--text-ghost)' }}>뉴스 언급 기반</span>
        </div>
        {stocks && stocks.length > 0 && (
          <span style={{ fontSize: 9, color: 'var(--text-ghost)' }}>{stocks.length}종목</span>
        )}
      </div>

      {/* 등급 범례 */}
      {stocks && stocks.length > 0 && (
        <div style={{ padding: '7px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          {[
            { icon: '🔥', label: '강력 수혜', desc: '3건↑·영향高' },
            { icon: '✦',  label: '수혜 유력', desc: '2건↑·영향高' },
            { icon: '·',  label: '관심 종목', desc: '1건 언급'    },
          ].map(g => (
            <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 9 }}>{g.icon}</span>
              <span style={{ fontSize: 8, color: 'var(--text-ghost)', letterSpacing: '0.04em' }}>{g.desc}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        {isLoading ? (
          [1, 2, 3].map(i => (
            <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ height: 11, background: 'var(--bg-input)', borderRadius: 3, marginBottom: 5, width: '55%', animation: 'breathe 1.5s ease infinite', animationDelay: `${i * 0.15}s` }} />
              <div style={{ height: 9, background: 'var(--bg-input)', borderRadius: 3, width: '80%', animation: 'breathe 1.5s ease infinite', animationDelay: `${i * 0.15 + 0.1}s` }} />
            </div>
          ))
        ) : isError ? (
          <div style={{ padding: '18px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--negative)', marginBottom: 3 }}>연결 오류</div>
          </div>
        ) : stocks && stocks.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto', flex: 1 }}>
            {stocks.map((stock: BeneficiaryStock, idx) => {
              const grade = getGrade(stock)
              const barWidth = Math.min(stock.mention_count * 18, 100)
              return (
                <li
                  key={stock.name}
                  style={{ padding: '9px 14px', borderBottom: idx < stocks.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLLIElement).style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLLIElement).style.background = 'transparent'}
                >
                  {/* 종목명 + 등급 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-ghost)', minWidth: 14 }}>{String(idx + 1).padStart(2, '0')}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{stock.name}</span>
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 600,
                      color: grade.color, background: grade.bg,
                      border: `1px solid ${grade.border}`,
                      padding: '2px 7px', borderRadius: 3, whiteSpace: 'nowrap',
                    }}>
                      {grade.icon} {grade.label}
                    </span>
                  </div>

                  {/* 언급 횟수 바 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: stock.reasons[0] ? 4 : 0 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-ghost)', whiteSpace: 'nowrap' }}>뉴스 {stock.mention_count}건</span>
                    <div style={{ flex: 1, height: 2, background: 'var(--bg-input)', borderRadius: 1, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barWidth}%`, background: grade.color, borderRadius: 1, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>

                  {/* 이유 */}
                  {stock.reasons[0] && (
                    <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '0 0 0 21px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stock.reasons[0]}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div style={{ padding: '18px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>오늘 수혜주 데이터가 없습니다</div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>뉴스 수집 후 자동 업데이트</div>
          </div>
        )}
      </div>
    </div>
  )
}
