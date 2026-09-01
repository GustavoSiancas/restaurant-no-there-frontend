import { useEffect, useMemo, useState } from 'react'
import { downloadShiftPreview, getShiftPreview } from '../services/auth'

const toDateValue = (date) => {
  const local = new Date(date)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 10)
}

const longDate = (value) => new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date(`${value}T12:00:00`))

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1)

function getPeriod(unit, offset) {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const safeOffset = Math.max(0, offset)
  if (unit === 'day') {
    const date = new Date(tomorrow)
    date.setDate(tomorrow.getDate() + safeOffset)
    const value = toDateValue(date)
    return { from: value, to: value, title: capitalize(new Intl.DateTimeFormat('es-PE', { weekday: 'long' }).format(date)), detail: longDate(value) }
  }
  const from = new Date(tomorrow)
  from.setDate(tomorrow.getDate() + safeOffset * 7)
  const to = new Date(from)
  to.setDate(from.getDate() + 6)
  return { from: toDateValue(from), to: toDateValue(to), title: `Semana ${from.getFullYear()}`, detail: `${longDate(toDateValue(from))} al ${longDate(toDateValue(to))}` }
}

export function MultiChoice({ label, options, value, onChange }) {
  const toggle = (option) => onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option])
  return <fieldset className="multi-choice"><legend>{label}</legend>{options.map((option) => <button type="button" className={value.includes(option.value) ? 'selected' : ''} onClick={() => toggle(option.value)} key={option.value}>{option.label}</button>)}</fieldset>
}

export default function ShiftPreview() {
  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = toDateValue(tomorrowDate)
  const [mode, setMode] = useState('period')
  const [unit, setUnit] = useState('day')
  const [offset, setOffset] = useState(0)
  const [day, setDay] = useState(tomorrow)
  const [range, setRange] = useState({ from: tomorrow, to: tomorrow })
  const [applied, setApplied] = useState({ from: tomorrow, to: tomorrow })
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState({ loading: true, exporting: false, error: '', notice: '' })
  const current = useMemo(() => getPeriod(unit, offset), [unit, offset])
  const previous = useMemo(() => offset > 0 ? getPeriod(unit, offset - 1) : null, [unit, offset])
  const next = useMemo(() => getPeriod(unit, offset + 1), [unit, offset])

  useEffect(() => {
    setStatus((value) => ({ ...value, loading: true, error: '', notice: '' }))
    getShiftPreview(applied)
      .then(setPreview)
      .catch((error) => setStatus((value) => ({ ...value, error: error.message })))
      .finally(() => setStatus((value) => ({ ...value, loading: false })))
  }, [applied])

  function submitDay(event) {
    event.preventDefault()
    if (!day || day < tomorrow) {
      setStatus((value) => ({ ...value, error: 'Solo puedes consultar desde mañana en adelante.' }))
      return
    }
    setApplied({ from: day, to: day })
  }

  function applyPeriod(nextOffset) {
    const safeOffset = Math.max(0, nextOffset)
    const period = getPeriod(unit, safeOffset)
    setOffset(safeOffset)
    setApplied({ from: period.from, to: period.to })
  }

  function changeUnit(nextUnit) {
    const period = getPeriod(nextUnit, 0)
    setUnit(nextUnit)
    setOffset(0)
    setApplied({ from: period.from, to: period.to })
  }

  function submitRange(event) {
    event.preventDefault()
    if (!range.from || !range.to || range.from > range.to || range.from < tomorrow) {
      setStatus((value) => ({ ...value, error: 'El rango debe comenzar desde mañana en adelante.' }))
      return
    }
    setApplied({ from: range.from, to: range.to })
  }

  async function exportFile() {
    setStatus((value) => ({ ...value, exporting: true, error: '', notice: '' }))
    try {
      await downloadShiftPreview(applied.from, applied.to)
      setStatus((value) => ({ ...value, exporting: false, notice: `Se exportó el periodo del ${longDate(applied.from)} al ${longDate(applied.to)}.` }))
    } catch (error) {
      setStatus((value) => ({ ...value, exporting: false, error: error.message }))
    }
  }

  const summary = preview?.summary || {}
  const rows = (preview?.dates || []).flatMap((dateGroup) =>
    (dateGroup.data || []).map((row) => ({
      ...row,
      preview_date: dateGroup.date,
    }))
  )
  const resultFrom = preview?.from?.slice(0, 10) || applied.from
  const resultTo = preview?.to?.slice(0, 10) || applied.to

  return <section className="preview-report owner-shift-preview">
    <div className="subreport-heading"><div><p className="section-kicker">Planificación de alimentación</p><h2>Consultar pedidos</h2><p>Consulta los trabajadores y comidas programados para un día o rango específico.</p></div><button className="excel-button" onClick={exportFile} disabled={status.exporting}><span>⇩</span>{status.exporting ? 'Preparando…' : 'Exportar Excel'}</button></div>

    <div className="preview-mode-tabs"><button type="button" className={mode === 'period' ? 'active' : ''} onClick={() => setMode('period')}><strong>POR DÍA O SEMANA</strong><small>Navega rápidamente entre periodos</small></button><button type="button" className={mode === 'day' ? 'active' : ''} onClick={() => setMode('day')}><strong>DÍA ESPECÍFICO</strong><small>Selecciona una única fecha</small></button><button type="button" className={mode === 'range' ? 'active' : ''} onClick={() => setMode('range')}><strong>RANGO ESPECÍFICO</strong><small>Elige una fecha de inicio y fin</small></button></div>

    {mode === 'period' ? <div className="preview-period-panel"><div className="preview-unit-tabs"><button type="button" className={unit === 'day' ? 'active' : ''} onClick={() => changeUnit('day')}>DÍA</button><button type="button" className={unit === 'week' ? 'active' : ''} onClick={() => changeUnit('week')}>SEMANA</button></div><div className="preview-period-browser"><button className="period-arrow" type="button" disabled={!previous} onClick={() => applyPeriod(offset - 1)}>←</button><div className="preview-period-carousel">{previous ? <button type="button" className="preview-period-card side" onClick={() => applyPeriod(offset - 1)}><strong>{previous.title}</strong><small>{previous.detail}</small></button> : <span className="preview-period-placeholder" />}<article className="preview-period-card current"><small>{unit === 'day' ? 'DÍA SELECCIONADO' : 'SEMANA SELECCIONADA'}</small><strong>{current.title}</strong><span>{current.detail}</span></article><button type="button" className="preview-period-card side" onClick={() => applyPeriod(offset + 1)}><strong>{next.title}</strong><small>{next.detail}</small></button></div><button className="period-arrow" type="button" onClick={() => applyPeriod(offset + 1)}>→</button></div></div> : mode === 'day' ? <form className="preview-range-form preview-day-form" onSubmit={submitDay}><label><span>Fecha específica</span><input type="date" value={day} min={tomorrow} onChange={(event) => setDay(event.target.value)} required /></label><button className="primary-action">Consultar día</button></form> : <form className="preview-range-form" onSubmit={submitRange}><label><span>Fecha de inicio</span><input type="date" value={range.from} min={tomorrow} onChange={(event) => setRange((value) => ({ ...value, from: event.target.value }))} required /></label><label><span>Fecha de fin</span><input type="date" value={range.to} min={range.from > tomorrow ? range.from : tomorrow} onChange={(event) => setRange((value) => ({ ...value, to: event.target.value }))} required /></label><button className="primary-action">Consultar rango</button></form>}

    <div className="applied-range"><span>Periodo consultado</span><strong>{longDate(resultFrom)} — {longDate(resultTo)}</strong></div>
    {status.error && <p className="inline-error" role="alert">{status.error}</p>}
    {status.notice && <p className="inline-success">✓ {status.notice}</p>}

    <div className="preview-summary"><article className="summary-meal breakfast"><span className="summary-meal-icon">☕</span><div><small>Desayunos</small><strong>{summary.by_meal?.BREAKFAST ?? 0}</strong></div></article><article className="summary-meal afternoon"><span className="summary-meal-icon">☀</span><div><small>Almuerzos</small><strong>{summary.by_meal?.LUNCH ?? 0}</strong></div></article><article className="summary-meal dinner"><span className="summary-meal-icon">☾</span><div><small>Cenas</small><strong>{summary.by_meal?.DINNER ?? 0}</strong></div></article></div>

    {status.loading ? <div className="list-loading"><span className="large-spinner" /> Cargando pedidos…</div> : <><div className="table-scroll"><table className="workers-table preview-table"><thead><tr><th>Fecha</th><th>Trabajador</th><th>Documento</th><th>Código</th><th>Cargo</th><th>Departamento</th><th>Turno</th><th>Comidas asignadas</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.assignment_id || `${row.preview_date}-${row.worker?.id || index}`}><td><strong>{row.preview_date?.slice(0, 10)}</strong></td><td><strong>{row.worker?.full_name}</strong></td><td>{row.worker?.document_number}</td><td>{row.worker?.employee_code}</td><td>{row.worker?.job_title || '—'}</td><td>{row.worker?.department || '—'}</td><td><span className={`shift-label ${row.shift_type === 'NOCHE' || row.shift_type === 'NIGHT' ? 'night' : ''}`}>{row.shift_type}</span></td><td><div className="assigned-meals">{row.assigned_meals?.map((meal) => <span key={`${meal.meal_type}-${meal.service_date}`}><b>{meal.display_name}</b><small>{meal.service_date?.slice(0, 10)}</small>{meal.start}–{meal.end}</span>)}</div></td></tr>)}</tbody></table>{!rows.length && <div className="empty-report">No hay pedidos para el periodo seleccionado.</div>}</div><div className="pagination"><span>Mostrando {rows.length} registros en {preview?.dates?.length || 0} días</span></div></>}
  </section>
}
