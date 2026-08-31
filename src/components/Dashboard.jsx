import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearSession, getCollaborators, getManagementUsers, getMyUser, getSession, getWorkers, registerCollaborator, registerManagement, registerWorker } from '../services/auth'
import ShiftPlanner from './ShiftPlanner'
import WorkerShiftCalendar from './WorkerShiftCalendar'
import WorkerSchedule from './WorkerSchedule'
import WorkerMealOverview from './WorkerMealOverview'
import brandLogo from '../assets/litoral-marino-logo.png'
import MealOrders from './MealOrders'
import MealReports from './MealReports'

const MANAGEMENT_ROLES = ['ADMIN', 'OWNER', 'RRHH']
const PAGE_SIZE = 6

function PeruClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer) }, [])
  const time = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)
  const date = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'short', day: '2-digit', month: 'short' }).format(now)
  return <div className="peru-clock"><span>Hora del sistema · Perú</span><strong>{time}</strong><small>{date}</small></div>
}

function WorkerSessionCountdown({ onExpire }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((getSession()?.expiresAt - Date.now()) / 1000)))
  useEffect(() => {
    const update = () => {
      const seconds = Math.max(0, Math.ceil((getSession()?.expiresAt - Date.now()) / 1000))
      setRemaining(seconds)
      if (seconds === 0) onExpire()
    }
    update()
    const timer = setInterval(update, 250)
    return () => clearInterval(timer)
  }, [onExpire])
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0')
  const seconds = String(remaining % 60).padStart(2, '0')
  return <button className={`session-countdown ${remaining <= 10 ? 'is-ending' : ''}`} onClick={onExpire} title="Cerrar sesión ahora"><span>La sesión termina en</span><strong>{minutes}:{seconds}</strong></button>
}

function normalizeList(response, keys) {
  if (Array.isArray(response)) return response
  for (const key of keys) if (Array.isArray(response?.[key])) return response[key]
  return []
}

function Logo() {
  return <div className="dash-logo"><img src={brandLogo} alt="" /><span>ALIMENTA</span></div>
}

function Modal({ title, description, onClose, children }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        <p className="modal-kicker">Nuevo registro</p>
        <h2 id="modal-title">{title}</h2>
        <p className="modal-description">{description}</p>
        {children}
      </section>
    </div>
  )
}

function Field({ label, ...props }) {
  return <label className="dash-field"><span>{label}</span><input {...props} required /></label>
}

function CreateForm({ kind, onClose }) {
  const [status, setStatus] = useState({ loading: false, error: '' })
  const management = kind === 'management'
  const collaborator = kind === 'collaborator'

  async function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    setStatus({ loading: true, error: '' })
    try {
      if (management) await registerManagement(values)
      else if (collaborator) await registerCollaborator(values)
      else await registerWorker(values)
      onClose(true)
    } catch (error) {
      setStatus({ loading: false, error: error.message })
    }
  }

  return (
    <form className="create-form" onSubmit={submit}>
      <div className="form-grid">
        {management || collaborator ? <>
          <Field label="Usuario" name="username" placeholder="Ej. owner1" autoComplete="off" />
          <Field label="Contraseña" name="password" type="password" minLength="8" placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
          <Field label="Nombre" name="first_name" placeholder="Ana" />
          <Field label="Apellido" name="last_name" placeholder="López" />
          <Field label="Correo" name="email" type="email" placeholder="owner@empresa.com" />
          {management && <label className="dash-field"><span>Rol</span><select name="role" required defaultValue="OWNER"><option value="OWNER">Owner</option><option value="RRHH">Recursos humanos</option></select></label>}
        </> : <>
          <Field label="DNI" name="dni" inputMode="numeric" placeholder="10203040" />
          <Field label="Código de empleado" name="employee_code" placeholder="EMP-001" />
          <Field label="Nombre" name="first_name" placeholder="Juan" />
          <Field label="Apellido" name="last_name" placeholder="Pérez" />
          <Field label="Correo" name="email" type="email" placeholder="worker@empresa.com" />
          <Field label="Cargo" name="job_title" placeholder="Operario" />
          <Field label="Departamento" name="department" placeholder="Producción" />
          <Field label="Fecha de contratación" name="hire_date" type="date" />
        </>}
      </div>
      {status.error && <p className="form-error" role="alert">{status.error}</p>}
      <div className="form-actions"><button type="button" onClick={() => onClose(false)}>Cancelar</button><button className="primary-action" disabled={status.loading}>{status.loading ? 'Guardando…' : 'Crear usuario'}</button></div>
    </form>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')
  const [workers, setWorkers] = useState([])
  const [managementUsers, setManagementUsers] = useState([])
  const [collaborators, setCollaborators] = useState([])
  const [listsLoading, setListsLoading] = useState(false)
  const [listsError, setListsError] = useState('')
  const [page, setPage] = useState(1)
  const [activeModule, setActiveModule] = useState('overview')
  const [calendarWorker, setCalendarWorker] = useState(null)

  useEffect(() => {
    if (!getSession()) { navigate('/collaborator', { replace: true }); return }
    getMyUser().then((currentUser) => { setUser(currentUser); if (currentUser.role === 'COLLABORATOR') setActiveModule('orders') }).catch((requestError) => {
      setError(requestError.message)
      if (!getSession()) navigate('/collaborator', { replace: true })
    }).finally(() => setLoading(false))
  }, [navigate])

  useEffect(() => {
    if (!user || !MANAGEMENT_ROLES.includes(user.role)) return
    let active = true
    setListsLoading(true)
    setListsError('')
    const requests = [getWorkers()]
    if (user.role === 'ADMIN') requests.push(getManagementUsers())
    if (user.role === 'OWNER') requests.push(getCollaborators())
    Promise.all(requests).then(([workerResponse, secondaryResponse]) => {
      if (!active) return
      setWorkers(normalizeList(workerResponse, ['workers', 'users', 'items', 'data']))
      if (user.role === 'ADMIN') setManagementUsers(normalizeList(secondaryResponse, ['management', 'users', 'items', 'data']))
      if (user.role === 'OWNER') setCollaborators(normalizeList(secondaryResponse, ['collaborators', 'users', 'items', 'data']))
    }).catch((requestError) => active && setListsError(requestError.message)).finally(() => active && setListsLoading(false))
    return () => { active = false }
  }, [user])

  function logout() { clearSession(); navigate('/collaborator', { replace: true }) }
  async function reloadLists() {
    const workerResponse = await getWorkers()
    setWorkers(normalizeList(workerResponse, ['workers', 'users', 'items', 'data']))
    if (role === 'ADMIN') {
      const managementResponse = await getManagementUsers()
      setManagementUsers(normalizeList(managementResponse, ['management', 'users', 'items', 'data']))
    }
    if (role === 'OWNER') {
      const collaboratorResponse = await getCollaborators()
      setCollaborators(normalizeList(collaboratorResponse, ['collaborators', 'users', 'items', 'data']))
    }
  }
  function closeModal(created) {
    setModal(null)
    if (created === true) {
      setNotice('Usuario creado correctamente.')
      reloadLists().catch((requestError) => setListsError(requestError.message))
      setTimeout(() => setNotice(''), 3500)
    }
  }

  if (loading) return <div className="dashboard-state"><span className="large-spinner" /><p>Cargando tu espacio…</p></div>
  if (error && !user) return <div className="dashboard-state"><h2>No pudimos abrir tu espacio</h2><p>{error}</p><button onClick={logout}>Volver al acceso</button></div>

  const role = user?.role
  const name = [user?.profile?.first_name, user?.profile?.last_name].filter(Boolean).join(' ') || 'Usuario'
  const initials = name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  const canCreateWorker = MANAGEMENT_ROLES.includes(role)
  const pageCount = Math.max(1, Math.ceil(workers.length / PAGE_SIZE))
  const visibleWorkers = workers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <Logo />
        <nav><button className={activeModule === 'overview' ? 'active' : ''} onClick={() => setActiveModule('overview')}><span>⌂</span>Resumen</button>{role === 'WORKER' && <button className={activeModule === 'schedule' ? 'active' : ''} onClick={() => setActiveModule('schedule')}><span>▦</span>Mi horario</button>}{['COLLABORATOR', 'OWNER'].includes(role) && <button className={activeModule === 'orders' ? 'active' : ''} onClick={() => setActiveModule('orders')}><span>▣</span>Pedidos</button>}{canCreateWorker && <button className={activeModule === 'workers' ? 'active' : ''} onClick={() => setActiveModule('workers')}><span>♙</span>Trabajadores</button>}{['ADMIN', 'RRHH'].includes(role) && <button className={activeModule === 'shifts' ? 'active' : ''} onClick={() => setActiveModule('shifts')}><span>◫</span>Turnos</button>}{role === 'OWNER' && <button className={activeModule === 'collaborators' ? 'active' : ''} onClick={() => setActiveModule('collaborators')}><span>♜</span>Colaboradores</button>}{role === 'OWNER' && <button className={activeModule === 'reports' ? 'active' : ''} onClick={() => setActiveModule('reports')}><span>▤</span>Reportes</button>}{role === 'ADMIN' && <button className={activeModule === 'management' ? 'active' : ''} onClick={() => setActiveModule('management')}><span>◇</span>Gestión</button>}</nav>
        <PeruClock /><div className="sidebar-foot"><p>Registro de alimentación</p><span>Versión 1.0</span></div>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-header"><Logo /><div className="header-session">{role === 'WORKER' && <WorkerSessionCountdown onExpire={logout} />}<div className="profile-chip"><span className="avatar">{initials}</span><span><strong>{name}</strong><small>{role}</small></span><button onClick={logout} title="Cerrar sesión">↪</button></div></div></header>
        <div className="dashboard-content">
          {notice && <div className="toast">✓ {notice}</div>}
          <div className="module-tabs"><button className={activeModule === 'overview' ? 'active' : ''} onClick={() => setActiveModule('overview')}>Resumen</button>{role === 'WORKER' && <button className={activeModule === 'schedule' ? 'active' : ''} onClick={() => setActiveModule('schedule')}>Mi horario</button>}{['COLLABORATOR', 'OWNER'].includes(role) && <button className={activeModule === 'orders' ? 'active' : ''} onClick={() => setActiveModule('orders')}>Pedidos</button>}{canCreateWorker && <button className={activeModule === 'workers' ? 'active' : ''} onClick={() => setActiveModule('workers')}>Trabajadores</button>}{['ADMIN', 'RRHH'].includes(role) && <button className={activeModule === 'shifts' ? 'active' : ''} onClick={() => setActiveModule('shifts')}>Turnos</button>}{role === 'OWNER' && <button className={activeModule === 'collaborators' ? 'active' : ''} onClick={() => setActiveModule('collaborators')}>Colaboradores</button>}{role === 'OWNER' && <button className={activeModule === 'reports' ? 'active' : ''} onClick={() => setActiveModule('reports')}>Reportes</button>}{role === 'ADMIN' && <button className={activeModule === 'management' ? 'active' : ''} onClick={() => setActiveModule('management')}>Gestión</button>}</div>
          {activeModule === 'overview' && <>
          <section className="welcome" id="overview"><div><p className="section-kicker">Panel de control</p><h1>Hola, {user?.profile?.first_name || 'bienvenido'}.</h1><p>Gestiona las personas que forman parte del servicio de alimentación.</p></div><div className="role-badge"><span>Acceso</span><strong>{role}</strong></div></section>

          {role === 'WORKER' ? <WorkerMealOverview /> : <div className="metric-grid"><article><span className="metric-icon green">♙</span><div><small>Trabajadores</small><strong>{workers.length}</strong><p>Personas registradas</p></div></article>{role === 'ADMIN' && <article><span className="metric-icon blue">◇</span><div><small>Usuarios de gestión</small><strong>{managementUsers.length}</strong><p>Owners y recursos humanos</p></div></article>}<article><span className="metric-icon orange">▱</span><div><small>Tiquetes de hoy</small><strong>—</strong><p>Registro pendiente de conexión</p></div></article></div>}</>}

          {activeModule === 'workers' && canCreateWorker && <section className="panel-section"><div className="section-heading"><div><p className="section-kicker">Equipo</p><h2>Trabajadores</h2><p>Personal habilitado para registrar sus comidas.</p></div><button className="primary-action" onClick={() => setModal('worker')}><span>＋</span> Nuevo trabajador</button></div>
            {listsError && <p className="inline-error">{listsError}</p>}
            {listsLoading ? <div className="list-loading"><span className="large-spinner" /> Cargando trabajadores…</div> : workers.length ? <>
              <div className="table-scroll"><table className="workers-table"><thead><tr><th>Trabajador</th><th>DNI</th><th>Código</th><th>Cargo</th><th>Departamento</th><th>Estado</th><th>Turnos</th></tr></thead><tbody>{visibleWorkers.map((worker) => {
                const workerName = [worker.profile?.first_name, worker.profile?.last_name].filter(Boolean).join(' ') || 'Sin nombre'
                const dni = worker.credentials?.find((credential) => credential.type === 'DNI')?.identifier || worker.dni || '—'
                return <tr key={worker.id}><td><div className="person-cell"><span>{workerName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div><strong>{workerName}</strong><small>{worker.profile?.email || 'Sin correo'}</small></div></div></td><td>{dni}</td><td>{worker.worker_information?.employee_code || '—'}</td><td>{worker.worker_information?.job_title || '—'}</td><td>{worker.worker_information?.department || '—'}</td><td><span className={`status-pill ${worker.active ? 'is-active' : 'is-inactive'}`}>{worker.active ? 'Activo' : 'Inactivo'}</span></td><td><button className="view-shifts" onClick={() => setCalendarWorker(worker)} title="Ver calendario de turnos" aria-label={`Ver turnos de ${workerName}`}>◉</button></td></tr>
              })}</tbody></table></div>
              <div className="pagination"><span>Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, workers.length)} de {workers.length}</span><div><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>←</button><strong>{page} / {pageCount}</strong><button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>→</button></div></div>
            </> : <div className="empty-table"><strong>Aún no hay trabajadores</strong><p>Crea el primer trabajador para comenzar.</p></div>}
          </section>}

          {activeModule === 'shifts' && ['ADMIN', 'RRHH'].includes(role) && <ShiftPlanner workers={workers} />}

          {activeModule === 'schedule' && role === 'WORKER' && <WorkerSchedule />}

          {activeModule === 'orders' && ['COLLABORATOR', 'OWNER'].includes(role) && <MealOrders role={role} />}

          {activeModule === 'collaborators' && role === 'OWNER' && <section className="panel-section"><div className="section-heading"><div><p className="section-kicker">Equipo operativo</p><h2>Colaboradores</h2><p>Usuarios encargados de validar la entrega de pedidos.</p></div><button className="primary-action" onClick={() => setModal('collaborator')}><span>＋</span> Nuevo colaborador</button></div><div className="management-cards">{collaborators.length ? collaborators.map((collaborator) => { const collaboratorName = [collaborator.profile?.first_name, collaborator.profile?.last_name].filter(Boolean).join(' ') || 'Sin nombre'; const username = collaborator.credentials?.find((credential) => credential.type === 'PASSWORD')?.identifier; return <article className="manager-card" key={collaborator.id}><div className="manager-card-head"><span className="manager-avatar">{collaboratorName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className={`status-dot ${collaborator.active ? 'is-active' : ''}`} /></div><strong>{collaboratorName}</strong><p>{collaborator.profile?.email || 'Sin correo'}</p><div className="manager-meta"><span>COLLABORATOR</span><span>@{username || 'sin-usuario'}</span></div></article> }) : <article className="empty-card"><span>＋</span><strong>Aún no hay colaboradores</strong><p>Crea el primer acceso operativo.</p></article>}</div></section>}

          {activeModule === 'reports' && role === 'OWNER' && <MealReports />}

          {activeModule === 'management' && role === 'ADMIN' && <section className="panel-section"><div className="section-heading"><div><p className="section-kicker">Administración</p><h2>Usuarios de gestión</h2><p>Owners y personal de recursos humanos.</p></div><button className="secondary-action" onClick={() => setModal('management')}><span>＋</span> Crear usuario de gestión</button></div>
            {!listsLoading && <div className="management-cards">{managementUsers.length ? managementUsers.map((manager) => {
              const managerName = [manager.profile?.first_name, manager.profile?.last_name].filter(Boolean).join(' ') || 'Sin nombre'
              const username = manager.credentials?.find((credential) => credential.type === 'PASSWORD')?.identifier
              return <article className="manager-card" key={manager.id}><div className="manager-card-head"><span className="manager-avatar">{managerName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className={`status-dot ${manager.active ? 'is-active' : ''}`} title={manager.active ? 'Activo' : 'Inactivo'} /></div><strong>{managerName}</strong><p>{manager.profile?.email || 'Sin correo'}</p><div className="manager-meta"><span>{manager.role}</span><span>@{username || 'sin-usuario'}</span></div></article>
            }) : <article className="empty-card"><span>＋</span><strong>Aún no hay usuarios</strong><p>Crea un Owner o usuario de RRHH.</p></article>}</div>}
          </section>}
        </div>
      </main>
      {modal && <Modal title={modal === 'management' ? 'Usuario de gestión' : modal === 'collaborator' ? 'Nuevo colaborador' : 'Nuevo trabajador'} description={modal === 'management' ? 'Crea un acceso para un Owner o miembro de RRHH.' : modal === 'collaborator' ? 'Crea un acceso para validar y entregar pedidos.' : 'Registra la información laboral del nuevo trabajador.'} onClose={() => closeModal(false)}><CreateForm kind={modal} onClose={closeModal} /></Modal>}
      {calendarWorker && <WorkerShiftCalendar worker={calendarWorker} onClose={() => setCalendarWorker(null)} />}
    </div>
  )
}
