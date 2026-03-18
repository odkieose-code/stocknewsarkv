import axios from 'axios'
import type { NewsListResponse, NewsDetail, BeneficiaryStock, TrendingKeyword, SectorCount } from '../types'

const api = axios.create({
  baseURL: '/api',
})

export const fetchNews = async (params?: {
  sector?: string
  sentiment?: string
  page?: number
  page_size?: number
}): Promise<NewsListResponse> => {
  const { data } = await api.get('/news', { params })
  return data
}

export const fetchNewsDetail = async (id: number): Promise<NewsDetail> => {
  const { data } = await api.get(`/news/${id}`)
  return data
}

export const fetchBeneficiaryStocks = async (limit = 10): Promise<BeneficiaryStock[]> => {
  const { data } = await api.get('/stocks/beneficiary', { params: { limit } })
  return data
}

export const fetchTrendingKeywords = async (hours = 1, limit = 10): Promise<TrendingKeyword[]> => {
  const { data } = await api.get('/keywords/trending', { params: { hours, limit } })
  return data
}

export const fetchSectors = async (): Promise<SectorCount[]> => {
  const { data } = await api.get('/sectors')
  return data
}
