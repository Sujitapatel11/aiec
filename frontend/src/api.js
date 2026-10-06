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
export const adminLogin           = (data) => api.post('/auth/login/', data)
export const adminLogout          = ()     => api.post('/auth/logout/')
export const requestPasswordReset  = (data) => api.post('/auth/password-reset/', data)
export const confirmPasswordReset  = (data) => api.post('/auth/password-reset-confirm/', data)
export const getUsers    = ()     => api.get('/auth/users/')
export const createUser  = (data) => api.post('/auth/users/', data)
export const createStaff = (data) => api.post('/staff/create/', data)
export const updateUser  = (id, data) => api.patch(`/auth/users/${id}/`, data)
export const deleteUser  = (id)   => api.delete(`/auth/users/${id}/`)
// Admin/Staff-initiated password reset (direct set, no email)
export const resetStudentPassword = (studentId, data) => api.post(`/auth/students/${studentId}/reset-password/`, data)
export const resetStaffPassword   = (userId,    data) => api.post(`/auth/staff/${userId}/reset-password/`,    data)

// Public
export const submitQuestionnaire = (data) => api.post('/questionnaire/', data)
export const submitContact        = (data) => api.post('/contact/', data)
export const profileRecommend     = (data) => api.post('/recommend/', data)
export const captureLead          = (data) => api.post('/capture-lead/', data)
export const getCountries         = ()     => api.get('/countries/?popular=true')
export const chatCounsellor       = (messages) => api.post('/chat/', { messages })

// Protected (dashboard)
export const getLeads          = (page = 1, filters = {}) => api.get('/leads/', {
  params: { page, ...filters },
})
export const createLead        = (data)     => api.post('/leads/', data)
export const getLead           = (id)       => api.get(`/leads/${id}/`)
export const updateLead        = (id, data) => api.patch(`/leads/${id}/`, data)
export const getStaffUsers     = ()         => api.get('/leads/staff-users/')
export const getLeadActivities = (id)       => api.get(`/leads/${id}/activities/`)
export const addLeadActivity   = (id, data) => api.post(`/leads/${id}/activities/`, data)
export const getDashboardStats = ()         => api.get('/dashboard/stats/')

// Student Enrollment & Process Tracking
export const enrollStudent        = (data)           => api.post('/students/enroll/', data)
export const getStudents          = (params = {})    => api.get('/students/', { params })
export const getStudentDetail     = (id)             => api.get(`/students/${id}/`)
export const updateStudentProfile = (id, data)       => api.patch(`/students/${id}/`, data)
export const deleteStudent        = (id)             => api.delete(`/students/${id}/`)
export const addProcessStep       = (studentId, data)=> api.post(`/students/${studentId}/steps/`, data)
export const updateProcessStep    = (stepId, data)   => api.patch(`/steps/${stepId}/`, data)
export const deleteProcessStep    = (stepId)         => api.delete(`/steps/${stepId}/`)
export const addStepPayment       = (stepId, data)   => api.post(`/steps/${stepId}/payments/`, data)
export const getStudentPortalMe   = ()               => api.get('/student-portal/my-profile/')
export const getCourses           = (params = {})    => api.get('/courses/', { params })
export const getStudentApplications = (studentId)    => api.get(`/students/${studentId}/applications/`)
export const createStudentApplication = (studentId, data) => api.post(`/students/${studentId}/applications/`, data)
export const getStudentApplication = (id)             => api.get(`/applications/${id}/`)
export const updateStudentApplication = (id, data)    => api.patch(`/applications/${id}/`, data)
export const deleteStudentApplication = (id)          => api.delete(`/applications/${id}/`)
export const getApplicationCountries = (params = {}) => api.get('/countries/', { params })
export const getApplicationEnrollment = (applicationId) => api.get(`/applications/${applicationId}/enrollment/`)
export const createApplicationEnrollment = (applicationId, data) => api.post(`/applications/${applicationId}/enrollment/`, data)
export const updateEnrollment = (id, data) => api.patch(`/enrollments/${id}/`, data)
export const deleteEnrollment = (id) => api.delete(`/enrollments/${id}/`)
export const completeApplicationWorkflowStep = (applicationId, stepId) =>
  api.post(`/applications/${applicationId}/workflow-steps/${stepId}/complete/`)

// Phase 1.4 — Lead → Student conversion
export const convertLeadToStudent = (leadId, data)   => api.post(`/leads/${leadId}/convert-to-student/`, data)

// Video Testimonials API
export const getPublicVideoTestimonials = ()           => api.get('/testimonials/video/public/')
export const getVideoTestimonials       = ()           => api.get('/testimonials/video/')
export const uploadVideoTestimonial      = (formData)   => api.post('/testimonials/video/upload/', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
export const updateVideoTestimonial      = (id, data)   => api.patch(`/testimonials/video/${id}/`, data)
export const deleteVideoTestimonial      = (id)         => api.delete(`/testimonials/video/${id}/`)

// Student Documents API
export const uploadStudentDocument = (formData) => api.post('/documents/upload/', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
export const getStudentDocuments   = (studentId) => api.get(`/documents/${studentId ? `?student_id=${studentId}` : ''}`)
export const verifyStudentDocument  = (id, data) => api.patch(`/documents/${id}/status/`, data)
export const deleteStudentDocument  = (id)       => api.delete(`/documents/${id}/`)

// ── Phase 1.3 — Counselling Operations ────────────────────────────────────

// Counselling Notes
export const getCounsellingNotes   = (params = {}) => api.get('/counselling-notes/', { params })
export const createCounsellingNote = (data)        => api.post('/counselling-notes/', data)
export const updateCounsellingNote = (id, data)    => api.patch(`/counselling-notes/${id}/`, data)
export const deleteCounsellingNote = (id)          => api.delete(`/counselling-notes/${id}/`)

// Follow-ups
export const getFollowUps    = (params = {}) => api.get('/follow-ups/', { params })
export const createFollowUp  = (data)        => api.post('/follow-ups/', data)
export const updateFollowUp  = (id, data)    => api.patch(`/follow-ups/${id}/`, data)
export const deleteFollowUp  = (id)          => api.delete(`/follow-ups/${id}/`)

// Tasks
export const getTasks    = (params = {}) => api.get('/tasks/', { params })
export const createTask  = (data)        => api.post('/tasks/', data)
export const updateTask  = (id, data)    => api.patch(`/tasks/${id}/`, data)
export const deleteTask  = (id)          => api.delete(`/tasks/${id}/`)

// Appointments
export const getAppointments    = (params = {}) => api.get('/appointments/', { params })
export const createAppointment  = (data)        => api.post('/appointments/', data)
export const updateAppointment  = (id, data)    => api.patch(`/appointments/${id}/`, data)
export const deleteAppointment  = (id)          => api.delete(`/appointments/${id}/`)

// ── Phase A — Lead WhatsApp Messaging ─────────────────────────────────────

/**
 * Send an outbound WhatsApp message from the AIEC Business number to a lead.
 *
 * The recipient phone number is NEVER supplied by the caller — the backend
 * retrieves it server-side from the Lead record, preventing IDOR/recipient
 * manipulation.
 *
 * @param {number|string} leadId  - Lead primary key
 * @param {string}        message - Message body (1–1000 chars, validated server-side)
 * @returns {Promise}             - Resolves to { sent, activity_id, message }
 */
export const sendLeadWhatsApp = (leadId, message) =>
  api.post(`/leads/${leadId}/send-whatsapp/`, { message })

export default api
