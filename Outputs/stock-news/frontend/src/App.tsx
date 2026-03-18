import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'

// ── 테마 컨텍스트 ─────────────────────────────────────────
type Theme = 'dark' | 'light'
export const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark', toggle: () => {},
})
export const useTheme = () => useContext(ThemeContext)

// ── Render keep-alive (14분마다 ping) ────────────────────
function useKeepAlive() {
  useEffect(() => {
    const ping = () => {
      fetch('/api/health', { method: 'GET' }).catch(() => {})
    }
    ping() // 즉시 1회
    const id = setInterval(ping, 14 * 60 * 1000) // 14분마다
    return () => clearInterval(id)
  }, [])
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'dark'
  })

  const toggle = () => setTheme(prev => {
    const next = prev === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', next)
    return next
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useKeepAlive()

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </ThemeContext.Provider>
  )
}
