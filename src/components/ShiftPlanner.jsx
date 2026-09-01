import { useMemo, useState } from 'react'
import { createMassiveShiftAssignments } from '../services/auth'

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const toDateValue = (date) => {
  const local = new Date(date)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 10)
}

const shortDate = (date) => new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit' }).format(date)
const longDate = (value) => new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
const nameOf = (worker) => [worker?.profile?.first_name, worker?.profile?.last_name].filter(Boolean).join(' ') || 'Sin nombre'
const detailOf = (worker) => [worker?.worker_information?.employee_code, worker?.worker_information?.department].filter(Boolean).join(' · ') || 'Sin información laboral'

function firstUpcomingMonday() {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const result = new Date(today)
  result.setDate(today.getDate() + (today.getDay() === 0 ? 1 : 8 - today.getDay()))
  return result
}

function getPeriods(type, page, amount = 3) {
  if (type === 'week') {
    const firstMonday = firstUpcomingMonday()
    return Array.from({ length: amount }, (_, index) => {
      const position = page * amount + index
      const from = new Date(firstMonday)
      from.setDate(firstMonday.getDate() + position * 7)
      const to = new Date(from)
      to.setDate(from.getDate() + 6)
      return {
        id: `week-${toDateValue(from)}`,
        from: toDateValue(from),
        to: toDateValue(to),
        title: `Semana · ${MONTHS[from.getMonth()]} ${from.getFullYear()}`,
        detail: `Lunes ${shortDate(from)} al domingo ${shortDate(to)}`,
      }
    })
  }

  const today = new Date()
  return Array.from({ length: amount }, (_, index) => {
    const position = page * amount + index + 1
    const from = new Date(today.getFullYear(), today.getMonth() + position, 1, 12)
    const to = new Date(today.getFullYear(), today.getMonth() + position + 1, 0, 12)
    return {
      id: `month-${toDateValue(from)}`,
      from: toDateValue(from),
      to: toDateValue(to),
      title: `${MONTHS[from.getMonth()].toUpperCase()} ${from.getFullYear()}`,
      detail: `${shortDate(from)} al ${shortDate(to)}`,
    }
  })
}

function AvailableWorker({ worker, onAdd }) {
  const workerName = nameOf(worker)
  const initials = workerName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  return <article className="bulk-worker" onDoubleClick={onAdd} title="Haz doble clic para seleccionar">
    <span className="bulk-worker-avatar">{initials}</span>
    <div><strong>{workerName}</strong><small>{detailOf(worker)}</small></div>
  </article>
}

export default function ShiftPlanner({ workers }) {
  const [periodType, setPeriodType] = useState('week')
  const [periodIndex, setPeriodIndex] = useState(0)
  const activePeriod = useMemo(() => getPeriods(periodType, periodIndex, 1)[0], [periodType, periodIndex])
  const previousPeriod = useMemo(() => periodIndex > 0 ? getPeriods(periodType, periodIndex - 1, 1)[0] : null, [periodType, periodIndex])
  const nextPeriod = useMemo(() => getPeriods(periodType, periodIndex + 1, 1)[0], [periodType, periodIndex])
  const [range, setRange] = useState(() => getPeriods('week', 0)[0])
  const [shift, setShift] = useState('DAY')
  const [selectedIds, setSelectedIds] = useState([])
  const [search, setSearch] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState({ loading: false, error: '' })

  const selectedWorkers = workers.filter((worker) => selectedIds.includes(worker.id))
  const availableWorkers = workers.filter((worker) => {
    if (selectedIds.includes(worker.id)) return false
    return `${nameOf(worker)} ${detailOf(worker)}`.toLowerCase().includes(search.trim().toLowerCase())
  })

  function changePeriodType(type) {
    const nextPeriods = getPeriods(type, 0)
    setPeriodType(type)
    setPeriodIndex(0)
    setRange(nextPeriods[0])
    setSaved(false)
    setStatus({ loading: false, error: '' })
  }

  function movePeriod(nextIndex) {
    const safeIndex = Math.max(0, nextIndex)
    const nextRange = getPeriods(periodType, safeIndex, 1)[0]
    setPeriodIndex(safeIndex)
    setRange(nextRange)
    setSaved(false)
    setStatus({ loading: false, error: '' })
  }

  function addWorker(id) {
    setSelectedIds((current) => current.includes(id) ? current : [...current, id])
    setSaved(false)
    setStatus({ loading: false, error: '' })
  }

  function removeWorker(id) {
    setSelectedIds((current) => current.filter((workerId) => workerId !== id))
    setSaved(false)
    setStatus({ loading: false, error: '' })
  }

  async function confirmSave() {
    const payload = {
      dates: { from: range.from, to: range.to },
      shift,
      workers: selectedIds,
    }
    setStatus({ loading: true, error: '' })
    try {
      await createMassiveShiftAssignments(payload)
      setConfirming(false)
      setSaved(true)
      setStatus({ loading: false, error: '' })
    } catch (error) {
      setStatus({ loading: false, error: error.message })
    }
  }

  return <section className="panel-section bulk-shift-planner" id="shifts">
    <div className="section-heading">
      <div><p className="section-kicker">Planificación de RRHH</p><h2>Asignación de turnos masiva</h2><p>Prepara un mismo turno para varios trabajadores durante una semana o un mes.</p></div>
      <span className="planner-lock">{workers.length} trabajadores disponibles</span>
    </div>

    <div className="bulk-warning" role="alert"><span>!</span><div><strong>Cuidado con esta asignación</strong><p>Si algún trabajador seleccionado ya tiene un turno programado dentro de estas fechas, la asignación anterior se eliminará y será reemplazada por este nuevo turno.</p></div></div>

    <div className="bulk-range-section">
      <div className="period-heading"><header><span>1</span><div><strong>Elige el periodo</strong><p>Selecciona semana o mes y navega hacia adelante sin límite.</p></div></header><div className="period-type-tabs"><button type="button" className={periodType === 'week' ? 'active' : ''} onClick={() => changePeriodType('week')}>SEMANA</button><button type="button" className={periodType === 'month' ? 'active' : ''} onClick={() => changePeriodType('month')}>MES</button></div></div>
      <div className="period-browser">
        <button className="period-arrow" type="button" disabled={periodIndex === 0} onClick={() => movePeriod(periodIndex - 1)} aria-label="Periodo anterior">←</button>
        <div className="period-carousel">
          {previousPeriod ? <button type="button" className="period-card previous" onClick={() => movePeriod(periodIndex - 1)}><strong>{previousPeriod.title}</strong><small>{previousPeriod.detail}</small></button> : <span className="period-placeholder" />}
          <button type="button" className="period-card current"><small>{periodType === 'week' ? 'SEMANA SELECCIONADA' : 'MES SELECCIONADO'}</small><strong>{activePeriod.title}</strong><span>Del {longDate(activePeriod.from)}<br />al {longDate(activePeriod.to)}</span></button>
          <button type="button" className="period-card next" onClick={() => movePeriod(periodIndex + 1)}><strong>{nextPeriod.title}</strong><small>{nextPeriod.detail}</small></button>
        </div>
        <button className="period-arrow" type="button" onClick={() => movePeriod(periodIndex + 1)} aria-label="Periodo siguiente">→</button>
      </div>
      <p className="period-page-label">{periodType === 'week' ? 'Semana' : 'Mes'} futuro #{periodIndex + 1}</p>
    </div>

    <div className="bulk-workers-grid">
      <article className="bulk-worker-column">
        <header><span>2</span><div><strong>Lista de trabajadores</strong><p>Doble clic para agregar · {availableWorkers.length} disponibles</p></div></header>
        <input className="worker-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, código o área…" />
        <div className="bulk-worker-list">{availableWorkers.length ? availableWorkers.map((worker) => <AvailableWorker worker={worker} onAdd={() => addWorker(worker.id)} key={worker.id} />) : <p className="bulk-empty">No hay trabajadores disponibles.</p>}</div>
      </article>
      <article className="bulk-worker-column selected-workers">
        <header><span>3</span><div><strong>Trabajadores seleccionados</strong><p>{selectedWorkers.length} incluidos en la asignación</p></div></header>
        <div className="selected-worker-chips">{selectedWorkers.length ? selectedWorkers.map((worker) => <span className="selected-worker-chip" key={worker.id}>{nameOf(worker)}<button type="button" onClick={() => removeWorker(worker.id)} aria-label={`Quitar a ${nameOf(worker)}`}>×</button></span>) : <p className="bulk-empty">Haz doble clic sobre un trabajador para agregarlo aquí.</p>}</div>
      </article>
    </div>

    <div className="bulk-final-step">
      <div><span className="step-number">4</span><div><strong>Selecciona el turno</strong><p>Se aplicará a todos los trabajadores y fechas elegidas.</p></div></div>
      <div className="shift-choice bulk-shift-choice"><button type="button" className={shift === 'DAY' ? 'selected day' : ''} onClick={() => { setShift('DAY'); setSaved(false) }}><span>☀</span><strong>DÍA</strong><small>Turno diurno</small></button><button type="button" className={shift === 'NIGHT' ? 'selected night' : ''} onClick={() => { setShift('NIGHT'); setSaved(false) }}><span>☾</span><strong>NOCHE</strong><small>Turno nocturno</small></button></div>
    </div>

    <div className="planner-save bulk-save"><div><strong>{range.title} · {shift === 'DAY' ? 'Día' : 'Noche'}</strong><p>{range.from} → {range.to} · {selectedIds.length} trabajadores</p></div><button className="primary-action" type="button" disabled={!selectedIds.length || status.loading} onClick={() => { setStatus({ loading: false, error: '' }); setConfirming(true) }}>Generar asignación</button></div>
    {saved && <p className="bulk-console-success">✓ Turnos guardados correctamente.</p>}
    {status.error && !confirming && <p className="inline-error" role="alert">{status.error}</p>}

    {confirming && <div className="bulk-confirm-backdrop" role="presentation" onMouseDown={(event) => !status.loading && event.target === event.currentTarget && setConfirming(false)}><section className="bulk-confirm" role="dialog" aria-modal="true" aria-labelledby="bulk-confirm-title"><span className="confirm-symbol">!</span><p className="section-kicker">Confirmar asignación masiva</p><h3 id="bulk-confirm-title">¿Estás seguro de asignar estos turnos?</h3><p>Se asignará el turno <strong>{shift === 'DAY' ? 'DÍA' : 'NOCHE'}</strong> a <strong>{selectedIds.length} trabajadores</strong>, desde el <strong>{longDate(range.from)}</strong> hasta el <strong>{longDate(range.to)}</strong>.</p><small>Los turnos existentes dentro de este periodo serán reemplazados.</small>{status.error && <p className="inline-error" role="alert">{status.error}</p>}<div><button type="button" disabled={status.loading} onClick={() => setConfirming(false)}>Cancelar</button><button type="button" className="primary-action" disabled={status.loading} onClick={confirmSave}>{status.loading ? 'Guardando…' : 'Sí, guardar turnos'}</button></div></section></div>}
  </section>
}
