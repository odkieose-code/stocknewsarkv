import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { NewsItem } from '../types'

interface NewsCardProps {
  news: NewsItem
  onClick: () => void
}

const SentimentBadge = ({ sentiment }: { sentiment?: string }) => {
  const config = {
    positive: { label: '긍정', className: 'bg-green-100 text-green-800' },
    negative: { label: '부정', className: 'bg-red-100 text-red-800' },
    neutral: { label: '중립', className: 'bg-gray-100 text-gray-800' },
  }

  const cfg = config[sentiment as keyof typeof config] || config.neutral

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

export default function NewsCard({ news, onClick }: NewsCardProps) {
  const timeAgo = formatDistanceToNow(new Date(news.published_at), {
    addSuffix: true,
    locale: ko,
  })

  return (
    <div
      onClick={onClick}
      className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-gray-900 line-clamp-2 flex-1">
          {news.title}
        </h3>
        {news.importance_score && news.importance_score >= 80 && (
          <span className="shrink-0 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
            주요
          </span>
        )}
      </div>

      {news.summary && (
        <p className="mt-2 text-sm text-gray-600 line-clamp-1">
          {news.summary}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        <SentimentBadge sentiment={news.sentiment} />
        {news.sector && (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
            {news.sector}
          </span>
        )}
        <span className="ml-auto">{news.source}</span>
        <span>{timeAgo}</span>
      </div>
    </div>
  )
}
