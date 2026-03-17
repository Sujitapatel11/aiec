import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import WhatsAppButton from './components/WhatsAppButton'
import ChatBot from './components/ChatBot'
import PrivateRoute from './components/PrivateRoute'
import Home from './pages/Home'
import Questionnaire from './pages/Questionnaire'
import Results from './pages/Results'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import StaffManagement from './pages/StaffManagement'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/"         element={<Home />} />
            <Route path="/apply"    element={<Questionnaire />} />
            <Route path="/results/:id" element={<Results />} />
            <Route path="/login"    element={<Login />} />
            <Route path="/dashboard" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
            <Route path="/staff" element={
              <PrivateRoute>
                <StaffManagement />
              </PrivateRoute>
            } />
          </Routes>
        </main>
        <Footer />
        <WhatsAppButton />
        <ChatBot />
      </div>
    </BrowserRouter>
  )
}
