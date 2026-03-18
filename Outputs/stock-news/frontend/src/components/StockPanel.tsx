import { useQuery } from '@tanstack/react-query'
import { fetchBeneficiaryStocks } from '../utils/api'
import type { BeneficiaryStock } from '../types'

const ImpactBadge = ({ impact }: { impact: string }) => {
  const config = {
    상: 'text-red-600 font-bold',
    중: 'text-orange-500 font-medium',
    하: 'text-gray-500',
  }

  return (
    <span className={config[impact as keyof typeof config] || config.중}>
      {impact}
    </span>
  )
}

export default function StockPanel() {
  const { data: stocks, isLoading } = useQuery({
    queryKey: ['beneficiaryStocks'],
    queryFn: () => fetchBeneficiaryStocks(10),
    refetchInterval: 1000 * 60 * 5, // 5분마다 갱신
  })

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <h2 className="font-bold text-lg mb-4">수혜주</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2 mt-1"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
      <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
        <span className="text-green-500">▲</span>
        수혜주
      </h2>

      {stocks && stocks.length > 0 ? (
        <ul className="space-y-3">
          {stocks.map((stock: BeneficiaryStock) => (
            <li key={stock.name} className="border-b border-gray-50 pb-2 last:border-0">
              <div className="flex items-center justify-between">
                <span className="font-medium">{stock.name}</span>
                <div className="flex items-center gap-2">
                  <ImpactBadge impact={stock.avg_impact} />
                  <span className="text-xs text-gray-400">
                    {stock.mention_count}회
                  </span>
                </div>
              </div>
              {stock.reasons.length > 0 && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                  {stock.reasons[0]}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 text-sm">오늘 수혜주 데이터가 없습니다</p>
      )}
    </div>
  )
}
