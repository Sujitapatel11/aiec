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

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('aiec_token')
      localStorage.removeItem('aiec_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const adminLogin  = (data) => api.post('/auth/login/', data)
export const adminLogout = ()     => api.post('/auth/logout/')
export const getUsers    = ()     => api.get('/auth/users/')
export const createUser  = (data) => api.post('/auth/users/', data)
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

export default api
