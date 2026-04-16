import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Checklist from './pages/Checklist'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/checklist" element={<Checklist />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}
