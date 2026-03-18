export interface Stock {
  name: string
  code?: string
  impact: string
  reason: string
}

export interface NewsItem {
  id: number
  title: string
  url: string
  source: string
  published_at: string
  importance_score?: number
  sentiment?: 'positive' | 'neutral' | 'negative'
  sector?: string
  summary?: string
}

export interface NewsDetail extends NewsItem {
  content: string
  sentiment_score?: number
  beneficiary_stocks?: Stock[]
  affected_stocks?: Stock[]
}

export interface NewsListResponse {
  items: NewsItem[]
  total: number
  page: number
  page_size: number
}

export interface BeneficiaryStock {
  name: string
  code?: string
  mention_count: number
  avg_impact: string
  reasons: string[]
}

export interface TrendingKeyword {
  keyword: string
  count: number
}

export interface SectorCount {
  sector: string
  count: number
}
