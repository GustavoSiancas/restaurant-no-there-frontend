import { useEffect, useState } from 'react'
import { getMealOrder, getMealOrders, getMealOrdersSocketConnection, validateMealOrder } from '../services/auth'

const normalize = (response) => Array.isArray(response) ? response : response?.orders || response?.items || response?.data || []
const mealLabel = (order) => order.service?.name || ({ DESAYUNO: 'DESAYUNO', TARDE: 'ALMUERZO', NOCHE: 'NOCHE' }[order.meal_type] || order.meal_type)
const displayTime = (value) => value ? new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'

const ORDER_STATUS = {
  REQUESTED: { label: 'Solicitado', timeLabel: 'Solicitado' },
  VALIDATED: { label: 'Entregado', timeLabel: 'Entregado' },
  NOT_CONSUMED: { label: 'No consumido', timeLabel: 'Sin solicitud' },
  REQUESTED_BUT_NOT_VALIDATED: { label: 'Solicitado sin validar', timeLabel: 'Solicitado' },
}

export default function MealOrders({ role }) {
  const [tab, setTab] = useState('REQUESTED')
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '', socket: 'connecting' })
  const [query, setQuery] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searching, setSearching] = useState(false)
  const [confirming, setConfirming] = useState(null)
  const [validating, setValidating] = useState(false)
  const [notice, setNotice] = useState('')

  function load(currentTab = tab) {
    setStatus((value) => ({ ...value, loading: true, error: '' }))
    getMealOrders(currentTab).then((response) => { setOrders(normalize(response)); setStatus((value) => ({ ...value, loading: false })) }).catch((error) => setStatus((value) => ({ ...value, loading: false, error: error.message })))
  }
  useEffect(() => load(tab), [tab])

  useEffect(() => {
    if (role !== 'COLLABORATOR') return
    let socket, reconnectTimer, stopped = false
    const connect = () => {
      if (stopped) return
      setStatus((value) => ({ ...value, socket: 'connecting' }))
      const connection = getMealOrdersSocketConnection()
      socket = new WebSocket(connection.url, connection.protocols)
      socket.onopen = () => setStatus((value) => ({ ...value, socket: 'connected' }))
      socket.onmessage = ({ data }) => {
        const event = JSON.parse(data)
        if (event.type === 'MEAL_ORDER_CREATED' && tab === 'REQUESTED') setOrders((list) => list.some((item) => item.id === event.data.id) ? list : [event.data, ...list])
        if (event.type === 'MEAL_ORDER_VALIDATED') setOrders((list) => tab === 'REQUESTED' ? list.filter((item) => item.id !== event.data.id) : [event.data, ...list.filter((item) => item.id !== event.data.id)])
      }
      socket.onerror = () => setStatus((value) => ({ ...value, socket: 'error' }))
      socket.onclose = () => { setStatus((value) => ({ ...value, socket: 'disconnected' })); if (!stopped) reconnectTimer = setTimeout(connect, 3000) }
    }
    connect()
    return () => { stopped = true; clearTimeout(reconnectTimer); socket?.close() }
  }, [role, tab])

  async function search(event) {
    event.preventDefault()
    if (!query.trim()) return
    setSearching(true); setSearchResult(null); setStatus((value) => ({ ...value, error: '' }))
    try { setSearchResult(await getMealOrder(query.trim())) }
    catch (error) { setStatus((value) => ({ ...value, error: error.message })) }
    finally { setSearching(false) }
  }

  async function confirmValidation() {
    const order = confirming
    setValidating(true)
    try {
      await validateMealOrder(order.id)
      setOrders((list) => list.filter((item) => item.id !== order.id))
      if (searchResult?.id === order.id) setSearchResult((value) => ({ ...value, status: 'VALIDATED', validated_at: new Date().toISOString() }))
      setNotice('Pedido entregado correctamente.')
      setConfirming(null)
      setTimeout(() => setNotice(''), 3000)
    } catch (error) {
      setConfirming(null)
      setStatus((value) => ({ ...value, error: error.details?.order?.validated_at ? `${error.message}. Entregado el ${displayTime(error.details.order.validated_at)}.` : error.message }))
      load()
    } finally { setValidating(false) }
  }

  const OrderCard = ({ order }) => {
    const orderStatus = ORDER_STATUS[order.status] || { label: order.status, timeLabel: 'Estado' }
    return <article className={`meal-order ${order.status.toLowerCase()}`}><div className="order-service"><span>{order.meal_type === 'NOCHE' ? '☾' : '☀'}</span><div><small>Servicio</small><strong>{mealLabel(order)}</strong></div></div><div className="order-worker"><strong>{order.worker?.fullName || 'Trabajador'}</strong><span>{order.worker?.documentNumber || 'Documento no disponible'}</span></div><div className="order-meta"><span>{orderStatus.timeLabel}</span><strong>{displayTime(order.validated_at || order.claimed_at)}</strong></div><span className={`order-status ${order.status.toLowerCase()}`}>{orderStatus.label}</span>{role === 'COLLABORATOR' && order.status === 'REQUESTED' && <button onClick={() => setConfirming(order)}>Validar entrega</button>}</article>
  }

  return <section className="orders-module"><header className="orders-heading"><div><p className="section-kicker">Atención en vivo</p><h1>Pedidos de comida</h1><p>Consulta y entrega los pedidos generados por los trabajadores.</p></div>{role === 'COLLABORATOR' && <span className={`socket-state ${status.socket}`}><i />{status.socket === 'connected' ? 'En vivo' : 'Reconectando'}</span>}</header>
    <form className="order-search" onSubmit={search}><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pedido por UUID" /><button disabled={searching}>{searching ? 'Buscando…' : 'Buscar'}</button></form>
    {notice && <p className="inline-success">✓ {notice}</p>}{status.error && <p className="inline-error">{status.error}</p>}
    {searchResult && <div className="search-result"><div><p className="section-kicker">Resultado de búsqueda</p><button onClick={() => setSearchResult(null)}>Cerrar ×</button></div><OrderCard order={searchResult} /></div>}
    <div className="orders-tabs"><button className={tab === 'REQUESTED' ? 'active' : ''} onClick={() => setTab('REQUESTED')}>Solicitados</button><button className={tab === 'VALIDATED' ? 'active' : ''} onClick={() => setTab('VALIDATED')}>Entregados</button><span>{orders.length} pedidos</span></div>
    {status.loading ? <div className="list-loading"><span className="large-spinner" /> Cargando pedidos…</div> : orders.length ? <div className="orders-list">{orders.map((order) => <OrderCard order={order} key={order.id} />)}</div> : <div className="empty-orders"><span>✓</span><h2>{tab === 'REQUESTED' ? 'No hay pedidos solicitados' : 'No hay entregas registradas'}</h2><p>{tab === 'REQUESTED' ? 'Los nuevos pedidos aparecerán aquí automáticamente.' : 'Las entregas validadas aparecerán en este historial.'}</p></div>}
    {confirming && <div className="react-confirm-backdrop fixed-confirm"><section className="react-confirm"><span className="confirm-symbol">✓</span><h3>¿Entregar este pedido?</h3><p>Confirma que entregarás {mealLabel(confirming)} a {confirming.worker?.fullName}.</p><div><button onClick={() => setConfirming(null)}>No, cancelar</button><button className="confirm-action" disabled={validating} onClick={confirmValidation}>{validating ? 'Validando…' : 'Sí, entregar'}</button></div></section></div>}
  </section>
}
