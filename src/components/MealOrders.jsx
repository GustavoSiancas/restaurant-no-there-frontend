import { useEffect, useMemo, useState } from 'react'
import { getDailyMealOrders, getMealOrder, getMealOrders, getMealOrdersSocketConnection, validateMealOrder } from '../services/auth'

const PENDING = new Set(['CLAIMED', 'REQUESTED'])
const normalize = (value) => Array.isArray(value) ? value : value?.orders || value?.items || value?.data || []
const pendingOrders = (value) => normalize(value).filter((order) => PENDING.has(order.status))
const upsertPending = (list, order) => PENDING.has(order.status) ? [order, ...list.filter((item) => item.id !== order.id)] : list.filter((item) => item.id !== order.id)
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
const mealLabel = ({ meal_type, service }) => service?.name || ({ BREAKFAST: 'DESAYUNO', LUNCH: 'ALMUERZO', DINNER: 'CENA', DESAYUNO: 'DESAYUNO', TARDE: 'ALMUERZO', NOCHE: 'CENA' }[meal_type] || meal_type)
const displayTime = (value) => value ? new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const STATES = {
  CREATED: ['Creado', 'Estado'],
  CLAIMED: ['Pendiente', 'Solicitado'], REQUESTED: ['Pendiente', 'Solicitado'], VALIDATED: ['Validado', 'Validado'],
  NOT_CLAIMED: ['No reclamado', 'Estado'], NOT_CONSUMED: ['No consumido', 'Estado'],
  CLAIMED_BUT_NOT_VALIDATED: ['No validado', 'Solicitado'], REQUESTED_BUT_NOT_VALIDATED: ['No validado', 'Solicitado'],
}
const MEALS = { BREAKFAST: 'Desayuno', LUNCH: 'Almuerzo', DINNER: 'Cena' }

export default function MealOrders({ role }) {
  const [view, setView] = useState('live')
  const [pending, setPending] = useState([])
  const [filters, setFilters] = useState({ date: today(), meal_type: 'LUNCH', page: 1, page_size: 20 })
  const [daily, setDaily] = useState({ data: [], page: 1, total: 0, total_pages: 1 })
  const [status, setStatus] = useState({ loading: true, error: '', socket: 'connecting' })
  const [query, setQuery] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searching, setSearching] = useState(false)
  const [confirming, setConfirming] = useState(null)
  const [validating, setValidating] = useState(false)
  const [notice, setNotice] = useState('')

  function loadLive() {
    setStatus((s) => ({ ...s, loading: true, error: '' }))
    getMealOrders('CLAIMED')
      .then((response) => setPending(pendingOrders(response)))
      .catch((error) => setStatus((s) => ({ ...s, error: error.message })))
      .finally(() => setStatus((s) => ({ ...s, loading: false })))
  }

  useEffect(() => {
    if (view === 'live') { loadLive(); return }
    setStatus((s) => ({ ...s, loading: true, error: '' }))
    getDailyMealOrders(filters).then((response) => {
      const data = normalize(response)
      setDaily({ data, page: response?.page || filters.page, total: response?.total ?? data.length, total_pages: response?.total_pages || 1 })
    }).catch((error) => setStatus((s) => ({ ...s, error: error.message })))
      .finally(() => setStatus((s) => ({ ...s, loading: false })))
  }, [view, filters])

  useEffect(() => {
    if (role !== 'COLLABORATOR') return undefined
    let socket, timer, stopped = false
    const connect = () => {
      if (stopped) return
      setStatus((s) => ({ ...s, socket: 'connecting' }))
      const connection = getMealOrdersSocketConnection()
      socket = new WebSocket(connection.url, connection.protocols)
      socket.onopen = () => setStatus((s) => ({ ...s, socket: 'connected' }))
      socket.onmessage = ({ data }) => {
        try {
          const event = JSON.parse(data), order = event.data
          if (event.type === 'CLAIMED_ORDERS') {
            setPending(pendingOrders(event.data))
            return
          }
          if (!order?.id) return
          if (event.type === 'MEAL_ORDER_CREATED') setPending((list) => upsertPending(list, order))
          if (event.type === 'MEAL_ORDER_VALIDATED') {
            setPending((list) => list.filter((item) => item.id !== order.id))
            setDaily((result) => ({ ...result, data: result.data.map((item) => item.id === order.id ? order : item) }))
          }
        } catch { /* El socket también puede enviar mensajes que no sean eventos. */ }
      }
      socket.onerror = () => setStatus((s) => ({ ...s, socket: 'error' }))
      socket.onclose = () => { setStatus((s) => ({ ...s, socket: 'disconnected' })); if (!stopped) timer = setTimeout(connect, 3000) }
    }
    connect()
    return () => { stopped = true; clearTimeout(timer); socket?.close() }
  }, [role])

  async function search(event) {
    event.preventDefault(); if (!query.trim()) return
    setSearching(true); setSearchResult(null); setStatus((s) => ({ ...s, error: '' }))
    try { setSearchResult(await getMealOrder(query.trim())) } catch (error) { setStatus((s) => ({ ...s, error: error.message })) } finally { setSearching(false) }
  }

  async function validate() {
    const order = confirming; setValidating(true)
    try {
      const result = await validateMealOrder(order.id)
      setPending((list) => list.filter((item) => item.id !== order.id))
      setDaily((value) => ({ ...value, data: value.data.map((item) => item.id === order.id ? result : item) }))
      if (searchResult?.id === order.id) setSearchResult(result)
      setNotice('Pedido validado correctamente.'); setConfirming(null); setTimeout(() => setNotice(''), 3000)
    } catch (error) {
      setConfirming(null); setStatus((s) => ({ ...s, error: error.details?.order?.validated_at ? `${error.message}. Validado el ${displayTime(error.details.order.validated_at)}.` : error.message })); loadLive()
    } finally { setValidating(false) }
  }

  const orders = useMemo(() => view === 'daily' ? daily.data : pending, [view, daily, pending])
  const Order = ({ order }) => {
    const state = STATES[order.status] || [order.status, 'Estado']
    const name = order.worker?.fullName || order.worker?.full_name || order.full_name || 'Trabajador'
    const document = order.worker?.documentNumber || order.worker?.document_number || order.document_number || 'Documento no disponible'
    const photo = order.worker?.photoUrl || order.worker?.photo_url
    const initials = name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
    return <article className={`meal-order ${order.status.toLowerCase()}`}><div className="order-service"><span>{['DINNER', 'NOCHE'].includes(order.meal_type) ? '☾' : '☀'}</span><div><small>Servicio</small><strong>{mealLabel(order)}</strong></div></div><div className={`order-worker ${view === 'live' ? 'with-photo' : ''}`}>{view === 'live' && <div className="order-worker-photo"><span>{initials}</span>{photo && <img src={photo} alt={`Foto de ${name}`} onError={(event) => event.currentTarget.remove()} />}</div>}<div><strong>{name}</strong><span>{document}</span>{view === 'daily' && <small>{[order.employee_code, order.department, order.shift_type === 'DAY' ? 'Turno día' : order.shift_type === 'NIGHT' ? 'Turno noche' : order.shift_type].filter(Boolean).join(' · ')}</small>}</div></div><div className="order-meta"><span>{state[1]}</span><strong>{displayTime(order.validated_at || order.claimed_at)}</strong></div><span className={`order-status ${order.status.toLowerCase()}`}>{state[0]}</span>{role === 'COLLABORATOR' && PENDING.has(order.status) && <button onClick={() => setConfirming(order)}>Validar pedido</button>}</article>
  }

  return <section className="orders-module"><header className="orders-heading"><div><p className="section-kicker">Atención en vivo</p><h1>Pedidos de comida</h1><p>Valida pedidos en tiempo real o consulta todas las comidas de un turno.</p></div><span className={`socket-state ${status.socket}`}><i />{status.socket === 'connected' ? 'En vivo' : 'Reconectando'}</span></header>
    <div className="orders-view-tabs"><button className={view === 'live' ? 'active' : ''} onClick={() => setView('live')}><strong>Validar pedidos</strong><small>Pedidos pendientes en tiempo real</small></button><button className={view === 'daily' ? 'active' : ''} onClick={() => setView('daily')}><strong>Ver pedidos del día</strong><small>Todas las comidas por turno</small></button></div>
    {view === 'live' ? <form className="order-search" onSubmit={search}><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pedido por UUID" /><button disabled={searching}>{searching ? 'Buscando…' : 'Buscar'}</button></form> : <div className="daily-orders-filter"><div className="daily-static-date"><span>Fecha de servicio</span><strong>{new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${filters.date}T12:00:00`))}</strong><small>Consulta del día actual</small></div><fieldset><legend>Selecciona una comida</legend><div>{Object.entries(MEALS).map(([value, label]) => <button type="button" className={filters.meal_type === value ? 'active' : ''} onClick={() => setFilters((current) => ({ ...current, meal_type: value, page: 1 }))} key={value}><i>{value === 'BREAKFAST' ? '☕' : value === 'LUNCH' ? '☀' : '☾'}</i>{label}</button>)}</div></fieldset></div>}
    {notice && <p className="inline-success">✓ {notice}</p>}{status.error && <p className="inline-error">{status.error}</p>}
    {searchResult && view === 'live' && <div className="search-result"><div><p className="section-kicker">Resultado de búsqueda</p><button onClick={() => setSearchResult(null)}>Cerrar ×</button></div><Order order={searchResult} /></div>}
    {view === 'daily' && <div className="daily-orders-summary"><div><span>Consulta actual</span><strong>{MEALS[filters.meal_type]}</strong><small>{new Intl.DateTimeFormat('es-PE', { dateStyle: 'long' }).format(new Date(`${filters.date}T12:00:00`))}</small></div><b>{daily.total}<small> registros</small></b></div>}
    {status.loading ? <div className="list-loading"><span className="large-spinner" /> Cargando pedidos…</div> : orders.length ? <div className="orders-list">{orders.map((order) => <Order order={order} key={order.id} />)}</div> : <div className="empty-orders"><span>✓</span><h2>No hay pedidos para mostrar</h2><p>{view === 'daily' ? 'No se encontraron pedidos para la comida seleccionada.' : 'Los nuevos pedidos aparecerán aquí automáticamente.'}</p></div>}
    {view === 'daily' && !status.loading && <div className="pagination"><span>Mostrando {daily.data.length} de {daily.total} registros</span><div><button disabled={daily.page <= 1} onClick={() => setFilters((v) => ({ ...v, page: v.page - 1 }))}>←</button><strong>{daily.page} / {daily.total_pages}</strong><button disabled={daily.page >= daily.total_pages} onClick={() => setFilters((v) => ({ ...v, page: v.page + 1 }))}>→</button></div></div>}
    {confirming && <div className="react-confirm-backdrop fixed-confirm"><section className="react-confirm"><span className="confirm-symbol">✓</span><h3>¿Validar este pedido?</h3><p>Confirma la entrega de {mealLabel(confirming)}.</p><div><button onClick={() => setConfirming(null)}>No, cancelar</button><button className="confirm-action" disabled={validating} onClick={validate}>{validating ? 'Validando…' : 'Sí, validar'}</button></div></section></div>}
  </section>
}
