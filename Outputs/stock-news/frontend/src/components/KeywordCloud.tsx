import { useQuery } from '@tanstack/react-query'
import { fetchTrendingKeywords } from '../utils/api'

interface KeywordCloudProps {
  onKeywordClick?: (keyword: string) => void
}

export default function KeywordCloud({ onKeywordClick }: KeywordCloudProps) {
  const { data: keywords, isLoading } = useQuery({
    queryKey: ['trendingKeywords'],
    queryFn: () => fetchTrendingKeywords(1, 15),
    refetchInterval: 1000 * 60 * 5,
  })

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="animate-pulse h-8 w-20 bg-gray-200 rounded-full"
          ></div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {keywords?.map((kw) => (
        <button
          key={kw.keyword}
          onClick={() => onKeywordClick?.(kw.keyword)}
          className="shrink-0 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {kw.keyword}
          <span className="ml-1 opacity-70">{kw.count}</span>
        </button>
      ))}
    </div>
  )
}
