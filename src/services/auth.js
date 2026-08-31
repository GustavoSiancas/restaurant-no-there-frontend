const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '')

const SESSION_KEY = 'alimenta_session'
const API_BASE = API_URL

export async function login({ type, credentials }) {
  const endpoint = type === 'worker' ? '/auth/login/dni' : '/auth/login/password'
  let response

  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
  } catch {
    throw new Error('No pudimos conectar con el servidor. Verifica que esté disponible.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.error || data.detail || data.message || 'Los datos ingresados no son correctos.',
    )
  }

  if (!data.access_token || (type !== 'worker' && !data.refresh_token)) {
    throw new Error('El servidor respondió sin los datos de sesión esperados.')
  }

  const session = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    tokenType: data.token_type || 'Bearer',
    expiresAt: Date.now() + Number(data.expires_in || 300) * 1000,
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

export async function refreshSession() {
  const currentSession = getSession()
  if (!currentSession?.refreshToken) {
    throw new Error('No existe una sesión para renovar.')
  }

  let response
  try {
    response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: currentSession.refreshToken }),
    })
  } catch {
    throw new Error('No pudimos conectar con el servidor.')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.access_token || !data.refresh_token) {
    clearSession()
    throw new Error(data.error || 'La sesión expiró. Inicia sesión nuevamente.')
  }

  const renewedSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type || 'Bearer',
    expiresAt: Date.now() + Number(data.expires_in || 300) * 1000,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(renewedSession))
  return renewedSession
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export async function apiRequest(path, options = {}, retry = true) {
  let session = getSession()
  if (!session) throw new Error('Tu sesión no está disponible.')

  if (session.expiresAt <= Date.now() && retry) {
    if (!session.refreshToken) {
      clearSession()
      throw new Error('Tu sesión terminó. Ingresa nuevamente.')
    }
    session = await refreshSession()
  }

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
        Authorization: `${session.tokenType} ${session.accessToken}`,
      },
    })
  } catch {
    throw new Error('No pudimos conectar con el servidor.')
  }

  if (response.status === 401 && retry) {
    if (!session.refreshToken) {
      clearSession()
      throw new Error('Tu sesión terminó. Ingresa nuevamente.')
    }
    await refreshSession()
    return apiRequest(path, options, false)
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const backendError = data.error
    const message = typeof backendError === 'object'
      ? backendError.message
      : backendError || data.detail || data.message
    const error = new Error(message || 'No se pudo completar la solicitud.')
    error.details = typeof backendError === 'object' ? backendError : null
    error.status = response.status
    throw error
  }
  return data
}

export function getMyUser() {
  return apiRequest('/users/my')
}

export function registerManagement(payload) {
  return apiRequest('/users/register/management', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function registerWorker(payload) {
  return apiRequest('/users/register/worker', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function registerCollaborator(payload) {
  return apiRequest('/users/register/collaborator', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getWorkers() {
  return apiRequest('/users/workers')
}

export function getManagementUsers() {
  return apiRequest('/users/management')
}

export function getCollaborators() {
  return apiRequest('/users/collaborators')
}

export function createShiftAssignment(payload) {
  return apiRequest('/worker-shift-assignments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateShiftAssignment(id, payload) {
  return apiRequest(`/worker-shift-assignments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function getWorkerShifts(workerId, from, to) {
  const params = new URLSearchParams({ from, to })
  return apiRequest(`/workers/${workerId}/shifts/range?${params}`)
}

export function deleteShiftAssignment(id) {
  return apiRequest(`/worker-shift-assignments/${id}`, { method: 'DELETE' })
}

export function getMyShiftAssignments(from, to) {
  const params = new URLSearchParams({ from, to })
  return apiRequest(`/workers/my/shifts/range?${params}`)
}

export function getMyWorkerStatus() {
  return apiRequest('/workers/my/status')
}

export function getMealSchedules() {
  return apiRequest('/meal-schedules')
}

export function getMyMealClaimPreview() {
  return apiRequest('/meal-claims/my/preview')
}

export function confirmMyMealClaimPrint(mealType) {
  return apiRequest('/meal-claims/my/confirm-print', {
    method: 'POST',
    body: JSON.stringify({ meal_type: mealType, printed: true }),
  })
}

export function getMealOrders(status = 'PENDING') {
  return apiRequest(`/meal-orders?${new URLSearchParams({ status })}`)
}

export function getMealOrder(id) {
  return apiRequest(`/meal-orders/${encodeURIComponent(id)}`)
}

export function validateMealOrder(id) {
  return apiRequest(`/meal-orders/${encodeURIComponent(id)}/validate`, { method: 'PATCH' })
}

export function getMealOrdersSocketUrl() {
  const session = getSession()
  const socketBase = API_URL.replace(/^http/, 'ws')
  return `${socketBase}/ws/meal-orders?${new URLSearchParams({ access_token: session?.accessToken || '' })}`
}

function buildQuery(filters = {}, excluded = []) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (excluded.includes(key) || value === '' || value == null) return
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item))
    else params.set(key, value)
  })
  return params
}

export function getDailyMealReport(filters = {}) {
  const params = buildQuery(filters)
  return apiRequest(`/meal-reports/daily?${params}`)
}

async function downloadAuthenticated(path, filters = {}, fallbackName, retry = true) {
  let session = getSession()
  if (!session) throw new Error('Tu sesión no está disponible.')
  if (session.expiresAt <= Date.now() && session.refreshToken) session = await refreshSession()
  const params = buildQuery(filters, ['page', 'page_size'])
  let response
  try { response = await fetch(`${API_URL}${path}?${params}`, { headers: { Authorization: `${session.tokenType} ${session.accessToken}` } }) }
  catch { throw new Error('No pudimos conectar con el servidor.') }
  if (response.status === 401 && retry && session.refreshToken) { await refreshSession(); return downloadAuthenticated(path, filters, fallbackName, false) }
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error?.message || data.error || data.message || 'No se pudo exportar el reporte.') }
  const disposition = response.headers.get('Content-Disposition') || ''
  const filename = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i)?.[1] || fallbackName
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a'); link.href = url; link.download = decodeURIComponent(filename); document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadMealReport(filters = {}) {
  return downloadAuthenticated('/meal-reports/export.xlsx', filters, 'reporte-comidas.xlsx')
}

export function getShiftPreview(filters = {}) {
  return apiRequest(`/workforce/shift-preview?${buildQuery(filters)}`)
}

export function downloadShiftPreview(filters = {}) {
  return downloadAuthenticated('/workforce/shift-preview/export.xlsx', filters, `turnos-${filters.date || 'hoy'}.xlsx`)
}
