import { useQuery } from '@tanstack/react-query'
import { fetchBeneficiaryStocks } from '../utils/api'
import type { BeneficiaryStock } from '../types'

const impactMap: Record<string, { color: string; bg: string; label: string }> = {
  '상': { color: 'rgba(0,200,100,0.9)',  bg: 'rgba(0,200,100,0.08)',  label: '▲ 상' },
  '중': { color: 'rgba(255,180,0,0.9)',  bg: 'rgba(255,180,0,0.08)',  label: '— 중' },
  '하': { color: 'rgba(255,255,255,0.25)', bg: 'rgba(255,255,255,0.04)', label: '▽ 하' },
}

export default function StockPanel() {
  const { data: stocks, isLoading, isError } = useQuery({
    queryKey: ['beneficiaryStocks'],
    queryFn: () => fetchBeneficiaryStocks(10),
    refetchInterval: 1000 * 60 * 5,
    retry: 2,
  })

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)', fontFamily: 'var(--font-mono)' }}>
      <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-ghost)', letterSpacing: '0.1em' }}>// BENEFICIARY STOCKS</span>
        {stocks && stocks.length > 0 && (
          <span style={{ fontSize: 9, color: 'var(--text-ghost)' }}>{stocks.length}종목</span>
        )}
      </div>

      <div>
        {isLoading ? (
          [1,2,3].map(i => (
            <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ height: 11, background: 'var(--bg-input)', borderRadius: 3, marginBottom: 5, width: '55%', animation: 'breathe 1.5s ease infinite', animationDelay: `${i * 0.15}s` }} />
              <div style={{ height: 9, background: 'var(--bg-input)', borderRadius: 3, width: '80%', animation: 'breathe 1.5s ease infinite', animationDelay: `${i * 0.15 + 0.1}s` }} />
            </div>
          ))
        ) : isError ? (
          <div style={{ padding: '18px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--negative)', marginBottom: 3 }}>연결 오류</div>
            <div style={{ fontSize: 9, color: 'var(--text-ghost)' }}>API 응답 없음</div>
          </div>
        ) : stocks && stocks.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {stocks.map((stock: BeneficiaryStock, idx) => {
              const impact = impactMap[stock.avg_impact] || impactMap['하']
              return (
                <li key={stock.name}
                  style={{ padding: '9px 14px', borderBottom: idx < stocks.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s', cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget as HTMLLIElement).style.background = 'var(--bg-input)'}
                  onMouseLeave={e => (e.currentTarget as HTMLLIElement).style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-ghost)', minWidth: 16 }}>{String(idx + 1).padStart(2, '0')}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{stock.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, color: impact.color, background: impact.bg, padding: '2px 7px', borderRadius: 3, border: `1px solid ${impact.color}`, fontWeight: 600 }}>
                        {impact.label}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--text-ghost)' }}>{stock.mention_count}회</span>
                    </div>
                  </div>
                  {stock.reasons.length > 0 && (
                    <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '0 0 0 24px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stock.reasons[0]}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div style={{ padding: '18px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-ghost)', marginBottom: 3 }}>오늘 수혜주 데이터가 없습니다</div>
            <div style={{ fontSize: 9, color: 'var(--text-ghost)', opacity: 0.5 }}>뉴스 수집 후 자동 업데이트</div>
          </div>
        )}
      </div>
    </div>
  )
}
