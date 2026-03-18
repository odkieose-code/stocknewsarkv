import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'

type Theme = 'dark' | 'light'
export const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark', toggle: () => {},
})
export const useTheme = () => useContext(ThemeContext)

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
