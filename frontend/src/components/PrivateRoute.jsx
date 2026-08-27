import React from 'react'
import { Navigate } from 'react-router-dom'

export default function PrivateRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('aiec_token')
  const role  = localStorage.getItem('aiec_role')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === 'student') {
      return <Navigate to="/student-portal" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  return children
}
