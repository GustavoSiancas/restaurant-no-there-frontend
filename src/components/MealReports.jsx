import { useEffect, useMemo, useState } from 'react'
import { downloadMealStatusReport, getMealStatusReport } from '../services/auth'

const MEALS = { BREAKFAST: 'Desayuno', LUNCH: 'Almuerzo', DINNER: 'Cena' }
const STATUS = {
  CREATED: 'Creado',
  CLAIMED: 'Reclamado',
  CLAIMED_BUT_NOT_VALIDATED: 'Reclamado sin validar',
  VALIDATED: 'Validado',
  NOT_CLAIMED: 'No reclamado',
}

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

function mondayOf(date) {
  const result = new Date(date)
  result.setHours(12, 0, 0, 0)
  result.setDate(result.getDate() - (result.getDay() === 0 ? 6 : result.getDay() - 1))
  return result
}

function getPastPeriod(unit, offset) {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  if (unit === 'day') {
    const date = new Date(today)
    date.setDate(today.getDate() + Math.min(0, offset))
    const value = toDateValue(date)
    return { from: value, to: value, title: capitalize(new Intl.DateTimeFormat('es-PE', { weekday: 'long' }).format(date)), detail: longDate(value) }
  }
  const from = mondayOf(today)
  from.setDate(from.getDate() + Math.min(0, offset) * 7)
  const naturalTo = new Date(from)
  naturalTo.setDate(from.getDate() + 6)
  const to = offset === 0 ? today : naturalTo
  return { from: toDateValue(from), to: toDateValue(to), title: `Semana ${from.getFullYear()}`, detail: `${longDate(toDateValue(from))} al ${longDate(toDateValue(to))}` }
}

export default function MealReports() {
  const today = toDateValue(new Date())
  const [mode, setMode] = useState('period')
  const [unit, setUnit] = useState('day')
  const [offset, setOffset] = useState(0)
  const [day, setDay] = useState(today)
  const [range, setRange] = useState({ from: today, to: today })
  const [applied, setApplied] = useState({ from: today, to: today, page: 1, page_size: 20 })
  const [report, setReport] = useState(null)
  const [status, setStatus] = useState({ loading: true, exporting: false, error: '', notice: '' })

  const current = useMemo(() => getPastPeriod(unit, offset), [unit, offset])
  const previous = useMemo(() => getPastPeriod(unit, offset - 1), [unit, offset])
  const next = useMemo(() => offset < 0 ? getPastPeriod(unit, offset + 1) : null, [unit, offset])

  useEffect(() => {
    setStatus((value) => ({ ...value, loading: true, error: '', notice: '' }))
    getMealStatusReport(applied)
      .then(setReport)
      .catch((error) => setStatus((value) => ({ ...value, error: error.message })))
      .finally(() => setStatus((value) => ({ ...value, loading: false })))
  }, [applied])

  function applyPeriod(nextOffset) {
    const safeOffset = Math.min(0, nextOffset)
    const period = getPastPeriod(unit, safeOffset)
    setOffset(safeOffset)
    setApplied({ from: period.from, to: period.to, page: 1, page_size: 20 })
  }

  function changeUnit(nextUnit) {
    const period = getPastPeriod(nextUnit, 0)
    setUnit(nextUnit)
    setOffset(0)
    setApplied({ from: period.from, to: period.to, page: 1, page_size: 20 })
  }

  function submitDay(event) {
    event.preventDefault()
    if (!day || day > today) return
    setApplied({ from: day, to: day, page: 1, page_size: 20 })
  }

  function submitRange(event) {
    event.preventDefault()
    if (!range.from || !range.to || range.from > range.to || range.to > today) {
      setStatus((value) => ({ ...value, error: 'El rango debe ser válido y no puede incluir fechas posteriores a hoy.' }))
      return
    }
    setApplied({ from: range.from, to: range.to, page: 1, page_size: 20 })
  }

  function changePage(page) {
    setApplied((value) => ({ ...value, page }))
  }

  async function exportExcel() {
    setStatus((value) => ({ ...value, exporting: true, error: '', notice: '' }))
    try {
      await downloadMealStatusReport(applied.from, applied.to)
      setStatus((value) => ({ ...value, exporting: false, notice: 'Reporte descargado correctamente.' }))
    } catch (error) {
      setStatus((value) => ({ ...value, exporting: false, error: error.message }))
    }
  }

  return <section className="reports-module meal-status-reports">
    <header className="reports-heading"><div><p className="section-kicker">Historial de alimentación</p><h1>Reportes de comidas</h1><p>Consulta y exporta el estado de las comidas desde hoy hacia fechas anteriores.</p></div><button className="excel-button" disabled={status.exporting} onClick={exportExcel}><span>⇩</span>{status.exporting ? 'Preparando Excel…' : 'Exportar Excel'}</button></header>

    <div className="past-only-notice"><span>←</span><div><strong>Consulta histórica</strong><p>Este reporte solo permite seleccionar el día de hoy o fechas anteriores.</p></div></div>

    <div className="preview-mode-tabs"><button type="button" className={mode === 'period' ? 'active' : ''} onClick={() => setMode('period')}><strong>POR DÍA O SEMANA</strong><small>Navega hacia periodos anteriores</small></button><button type="button" className={mode === 'day' ? 'active' : ''} onClick={() => setMode('day')}><strong>DÍA ESPECÍFICO</strong><small>Selecciona una única fecha</small></button><button type="button" className={mode === 'range' ? 'active' : ''} onClick={() => setMode('range')}><strong>RANGO ESPECÍFICO</strong><small>Elige una fecha de inicio y fin</small></button></div>

    {mode === 'period' ? <div className="preview-period-panel"><div className="preview-unit-tabs"><button type="button" className={unit === 'day' ? 'active' : ''} onClick={() => changeUnit('day')}>DÍA</button><button type="button" className={unit === 'week' ? 'active' : ''} onClick={() => changeUnit('week')}>SEMANA</button></div><div className="preview-period-browser"><button className="period-arrow" type="button" onClick={() => applyPeriod(offset - 1)}>←</button><div className="preview-period-carousel"><button type="button" className="preview-period-card side" onClick={() => applyPeriod(offset - 1)}><strong>{previous.title}</strong><small>{previous.detail}</small></button><article className="preview-period-card current"><small>{unit === 'day' ? 'DÍA SELECCIONADO' : 'SEMANA SELECCIONADA'}</small><strong>{current.title}</strong><span>{current.detail}</span></article>{next ? <button type="button" className="preview-period-card side" onClick={() => applyPeriod(offset + 1)}><strong>{next.title}</strong><small>{next.detail}</small></button> : <span className="preview-period-placeholder" />}</div><button className="period-arrow" type="button" disabled={!next} onClick={() => applyPeriod(offset + 1)}>→</button></div></div> : mode === 'day' ? <form className="preview-range-form preview-day-form" onSubmit={submitDay}><label><span>Fecha específica</span><input type="date" value={day} max={today} onChange={(event) => setDay(event.target.value)} required /></label><button className="primary-action">Consultar día</button></form> : <form className="preview-range-form" onSubmit={submitRange}><label><span>Fecha de inicio</span><input type="date" value={range.from} max={today} onChange={(event) => setRange((value) => ({ ...value, from: event.target.value }))} required /></label><label><span>Fecha de fin</span><input type="date" value={range.to} min={range.from} max={today} onChange={(event) => setRange((value) => ({ ...value, to: event.target.value }))} required /></label><button className="primary-action">Consultar rango</button></form>}

    <div className="report-period"><span>Periodo consultado</span><strong>{report?.from?.slice(0, 10) || applied.from} → {report?.to?.slice(0, 10) || applied.to}</strong></div>
    {status.error && <p className="inline-error" role="alert">{status.error}</p>}
    {status.notice && <p className="inline-success">✓ {status.notice}</p>}

    <div className="meal-status-summary simple-meal-summary">{(report?.summary || []).map((meal) => <article className={meal.meal_type.toLowerCase()} key={meal.meal_type}><header><div><small>Tipo de comida</small><strong>{MEALS[meal.meal_type] || meal.meal_type}</strong></div></header><div className="meal-summary-totals"><span><b>{meal.claimed ?? 0}</b> Reclamados</span><span><b>{meal.not_claimed ?? 0}</b> No reclamados</span></div></article>)}</div>

    {status.loading ? <div className="list-loading"><span className="large-spinner" /> Cargando reporte…</div> : <><div className="table-scroll"><table className="workers-table report-table basic-report-table"><thead><tr><th>Trabajador</th><th>Código</th><th>Fecha</th><th>Comida</th><th>Estado</th></tr></thead><tbody>{report?.data?.map((row) => <tr key={row.id}><td><strong>{row.full_name}</strong></td><td>{row.employee_code || '—'}</td><td>{row.service_date?.slice(0, 10)}</td><td>{MEALS[row.meal_type] || row.meal_type}</td><td><span className={`report-status ${row.status?.toLowerCase()}`}>{STATUS[row.status] || row.status}</span></td></tr>)}</tbody></table>{!report?.data?.length && <div className="empty-report">No hay registros para el periodo seleccionado.</div>}</div><div className="pagination"><span>Mostrando {report?.data?.length || 0} de {report?.total || 0} registros</span><div><button disabled={(report?.page || 1) <= 1} onClick={() => changePage(report.page - 1)}>←</button><strong>{report?.page || 1} / {report?.total_pages || 1}</strong><button disabled={(report?.page || 1) >= (report?.total_pages || 1)} onClick={() => changePage(report.page + 1)}>→</button></div></div></>}
  </section>
}
