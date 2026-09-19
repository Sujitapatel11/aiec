import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach token on every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('aiec_token')
  if (token) config.headers.Authorization = `Token ${token}`
  return config
})

// Redirect to login on 401 (except when attempting to log in)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login/')) {
      localStorage.removeItem('aiec_token')
      localStorage.removeItem('aiec_user')
      localStorage.removeItem('aiec_role')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// Auth
export const adminLogin  = (data) => api.post('/auth/login/', data)
export const adminLogout = ()     => api.post('/auth/logout/')
export const getUsers    = ()     => api.get('/auth/users/')
export const createUser  = (data) => api.post('/auth/users/', data)
export const createStaff = (data) => api.post('/staff/create/', data)
export const updateUser  = (id, data) => api.patch(`/auth/users/${id}/`, data)
export const deleteUser  = (id)   => api.delete(`/auth/users/${id}/`)

// Public
export const submitQuestionnaire = (data) => api.post('/questionnaire/', data)
export const submitContact        = (data) => api.post('/contact/', data)
export const profileRecommend     = (data) => api.post('/recommend/', data)
export const captureLead          = (data) => api.post('/capture-lead/', data)
export const getCountries         = ()     => api.get('/countries/?popular=true')
export const chatCounsellor       = (messages) => api.post('/chat/', { messages })

// Protected (dashboard)
export const getLeads          = (page = 1) => api.get(`/leads/?page=${page}`)
export const getLead           = (id)       => api.get(`/leads/${id}/`)
export const updateLead        = (id, data) => api.patch(`/leads/${id}/`, data)
export const getDashboardStats = ()         => api.get('/dashboard/stats/')

// Student Enrollment & Process Tracking
export const enrollStudent        = (data)           => api.post('/students/enroll/', data)
export const getStudents          = ()               => api.get('/students/')
export const getStudentDetail     = (id)             => api.get(`/students/${id}/`)
export const deleteStudent        = (id)             => api.delete(`/students/${id}/`)
export const addProcessStep       = (studentId, data)=> api.post(`/students/${studentId}/steps/`, data)
export const updateProcessStep    = (stepId, data)   => api.patch(`/steps/${stepId}/`, data)
export const deleteProcessStep    = (stepId)         => api.delete(`/steps/${stepId}/`)
export const addStepPayment       = (stepId, data)   => api.post(`/steps/${stepId}/payments/`, data)
export const getStudentPortalMe   = ()               => api.get('/student-portal/my-profile/')

// Video Testimonials API
export const getPublicVideoTestimonials = ()           => api.get('/testimonials/video/public/')
export const getVideoTestimonials       = ()           => api.get('/testimonials/video/')
export const uploadVideoTestimonial      = (formData)   => api.post('/testimonials/video/upload/', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
export const updateVideoTestimonial      = (id, data)   => api.patch(`/testimonials/video/${id}/`, data)
export const deleteVideoTestimonial      = (id)         => api.delete(`/testimonials/video/${id}/`)

export default api

