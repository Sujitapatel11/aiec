import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import WhatsAppButton from './components/WhatsAppButton'
import ChatBot from './components/ChatBot'
import PrivateRoute from './components/PrivateRoute'

// Lazy load all pages — only loads when user navigates there
const Home           = lazy(() => import('./pages/Home'))
const Questionnaire  = lazy(() => import('./pages/Questionnaire'))
const Results        = lazy(() => import('./pages/Results'))
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const Login          = lazy(() => import('./pages/Login'))
const StaffManagement = lazy(() => import('./pages/StaffManagement'))

// Loading spinner
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading...</p>
      </div>
    </div>
  )
}

export default function App() {
  // Keep Render backend warm — ping every 10 minutes to avoid cold starts
  useEffect(() => {
    const ping = () => {
      fetch(`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://aiec-1.onrender.com'}/`)
        .catch(() => {}) // silent — just keeping it warm
    }
    ping() // ping on load
    const id = setInterval(ping, 10 * 60 * 1000) // every 10 min
    return () => clearInterval(id)
  }, [])

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"            element={<Home />} />
              <Route path="/apply"       element={<Questionnaire />} />
              <Route path="/results/:id" element={<Results />} />
              <Route path="/login"       element={<Login />} />
              <Route path="/dashboard"   element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/staff"       element={<PrivateRoute><StaffManagement /></PrivateRoute>} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
        <WhatsAppButton />
        <ChatBot />
      </div>
    </BrowserRouter>
  )
}
