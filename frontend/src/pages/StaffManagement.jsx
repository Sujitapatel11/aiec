import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUsers, createUser, updateUser, deleteUser } from '../api'

const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-700',
  staff: 'bg-blue-100 text-blue-700',
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function StaffManagement() {
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const navigate = useNavigate()
  const isAdmin = localStorage.getItem('aiec_role') === 'admin'

  useEffect(() => {
    if (!isAdmin) { navigate('/dashboard'); return }
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await getUsers()
      setUsers(res.data)
    } catch { setError('Failed to load users.') }
    finally { setLoading(false) }
  }

  const notify = (msg, isError = false) => {
    if (isError) setError(msg); else setSuccess(msg)
    setTimeout(() => { setError(''); setSuccess('') }, 4000)
  }

  const handleDeactivate = async (user) => {
    if (!window.confirm(`Deactivate "${user.username}"? They will lose access immediately.`)) return
    try {
      await deleteUser(user.id)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: false } : u))
      notify(`"${user.username}" has been deactivated.`)
    } catch (e) { notify(e.response?.data?.error || 'Failed.', true) }
  }

  const handleReactivate = async (user) => {
    try {
      await updateUser(user.id, { is_active: true })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: true } : u))
      notify(`"${user.username}" has been reactivated.`)
    } catch (e) { notify(e.response?.data?.error || 'Failed.', true) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-gray-600 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <img src="/logo.png" alt="AIEC" className="h-8 w-auto object-contain" />
            <div>
              <p className="font-bold text-gray-900 text-sm">Staff Management</p>
              <p className="text-xs text-gray-400">Create, manage and deactivate staff accounts</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            + Add Staff
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Alerts */}
        {error   && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">⚠️ {error}</div>}
        {success && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">✅ {success}</div>}

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 mb-6 text-sm text-blue-800">
          <strong>Admin</strong> — full access (leads, dashboard, staff management) &nbsp;·&nbsp;
          <strong>Staff</strong> — can view and update leads only &nbsp;·&nbsp;
          Deactivating a staff member revokes their access immediately.
        </div>

        {/* Users table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">Username</th>
                  <th className="px-5 py-3 text-left">Email</th>
                  <th className="px-5 py-3 text-left">Role</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Joined</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No staff members yet.</td></tr>
                )}
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-gray-900">{user.name}</td>
                    <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{user.username}</td>
                    <td className="px-5 py-3.5 text-gray-500">{user.email || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ROLE_COLORS[user.role]}`}>
                        {user.role === 'admin' ? '👑 Admin' : '👤 Staff'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {user.is_active ? '● Active' : '○ Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{user.date_joined}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditUser(user)}
                          className="text-xs text-primary-600 hover:text-primary-700 font-semibold border border-primary-200 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        {user.is_active ? (
                          <button
                            onClick={() => handleDeactivate(user)}
                            className="text-xs text-red-600 hover:text-red-700 font-semibold border border-red-200 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(user)}
                            className="text-xs text-green-600 hover:text-green-700 font-semibold border border-green-200 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(u) => { setUsers(prev => [u, ...prev]); setShowCreate(false); notify(`"${u.username}" created successfully.`) }}
          onError={(msg) => notify(msg, true)}
        />
      )}

      {/* Edit modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onUpdated={(updated) => { setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u)); setEditUser(null); notify('Updated successfully.') }}
          onError={(msg) => notify(msg, true)}
        />
      )}
    </div>
  )
}

/* ── Create User Modal ─────────────────────────────────────────────── */
function CreateUserModal({ onClose, onCreated, onError }) {
  const [form, setForm] = useState({ username: '', password: '', first_name: '', last_name: '', email: '', role: 'staff' })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await createUser(form)
      onCreated({ id: res.data.id, username: res.data.username, name: res.data.name, role: res.data.role, is_active: true, email: form.email, date_joined: 'Today' })
    } catch (err) { onError(err.response?.data?.error || 'Failed to create user.') }
    finally { setLoading(false) }
  }

  return (
    <Modal title="Add New Staff Member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input className="input-field text-sm" placeholder="First Name" value={form.first_name} onChange={e => set('first_name', e.target.value)} />
          <input className="input-field text-sm" placeholder="Last Name" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
        </div>
        <input className="input-field text-sm" placeholder="Username *" value={form.username} onChange={e => set('username', e.target.value)} required />
        <input className="input-field text-sm" type="email" placeholder="Email" value={form.email} onChange={e => set('email', e.target.value)} />
        <input className="input-field text-sm" type="password" placeholder="Password * (min 6 chars)" value={form.password} onChange={e => set('password', e.target.value)} required />
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Role</label>
          <div className="flex gap-3">
            {['staff', 'admin'].map(r => (
              <label key={r} className={`flex-1 flex items-center gap-2 border-2 rounded-xl px-4 py-2.5 cursor-pointer transition-all ${form.role === r ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
                <input type="radio" name="role" value={r} checked={form.role === r} onChange={() => set('role', r)} className="accent-primary-600" />
                <span className="text-sm font-medium capitalize">{r === 'admin' ? '👑 Admin' : '👤 Staff'}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">{form.role === 'admin' ? 'Full access including staff management' : 'Can view and update leads only'}</p>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
          {loading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating...</> : 'Create Staff Member'}
        </button>
      </form>
    </Modal>
  )
}

/* ── Edit User Modal ───────────────────────────────────────────────── */
function EditUserModal({ user, onClose, onUpdated, onError }) {
  const [form, setForm] = useState({ first_name: user.name?.split(' ')[0] || '', last_name: user.name?.split(' ')[1] || '', email: user.email || '', role: user.role, password: '' })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { first_name: form.first_name, last_name: form.last_name, email: form.email, role: form.role }
      if (form.password) payload.password = form.password
      const res = await updateUser(user.id, payload)
      onUpdated({ ...res.data, name: `${form.first_name} ${form.last_name}`.trim() || user.name, email: form.email })
    } catch (err) { onError(err.response?.data?.error || 'Failed to update.') }
    finally { setLoading(false) }
  }

  return (
    <Modal title={`Edit — ${user.username}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input className="input-field text-sm" placeholder="First Name" value={form.first_name} onChange={e => set('first_name', e.target.value)} />
          <input className="input-field text-sm" placeholder="Last Name" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
        </div>
        <input className="input-field text-sm" type="email" placeholder="Email" value={form.email} onChange={e => set('email', e.target.value)} />
        <input className="input-field text-sm" type="password" placeholder="New Password (leave blank to keep current)" value={form.password} onChange={e => set('password', e.target.value)} />
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Role</label>
          <div className="flex gap-3">
            {['staff', 'admin'].map(r => (
              <label key={r} className={`flex-1 flex items-center gap-2 border-2 rounded-xl px-4 py-2.5 cursor-pointer transition-all ${form.role === r ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
                <input type="radio" name="role" value={r} checked={form.role === r} onChange={() => set('role', r)} className="accent-primary-600" />
                <span className="text-sm font-medium">{r === 'admin' ? '👑 Admin' : '👤 Staff'}</span>
              </label>
            ))}
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
          {loading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : 'Save Changes'}
        </button>
      </form>
    </Modal>
  )
}
