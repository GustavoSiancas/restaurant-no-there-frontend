import { useEffect, useState } from 'react'
import { downloadMealReport, getDailyMealReport } from '../services/auth'
import ShiftPreview, { MultiChoice } from './ShiftPreview'

const EMPTY_FILTERS = { from: '', to: '', meal_type: [], shift_type: [], page: 1, page_size: 20 }
const STATUS = { VALIDATED: 'Consumió', PENDING: 'Pedido pendiente', NOT_CLAIMED: 'No reclamó' }
const MEALS = { DESAYUNO: 'Desayuno', TARDE: 'Tarde', NOCHE: 'Noche' }

export default function MealReports() {
  const [view, setView] = useState('daily')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [applied, setApplied] = useState(EMPTY_FILTERS)
  const [report, setReport] = useState(null)
  const [status, setStatus] = useState({ loading: true, exporting: false, error: '', notice: '' })

  useEffect(() => {
    setStatus((value) => ({ ...value, loading: true, error: '' }))
    getDailyMealReport(applied).then(setReport).catch((error) => setStatus((value) => ({ ...value, error: error.message }))).finally(() => setStatus((value) => ({ ...value, loading: false })))
  }, [applied])

  function submit(event) { event.preventDefault(); setApplied({ ...filters, page: 1 }); setFilters((value) => ({ ...value, page: 1 })) }
  function clear() { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS) }
  function changePage(page) { const next = { ...applied, page }; setApplied(next); setFilters((value) => ({ ...value, page })) }
  async function exportExcel() {
    setStatus((value) => ({ ...value, exporting: true, error: '', notice: '' }))
    try { await downloadMealReport(applied); setStatus((value) => ({ ...value, exporting: false, notice: 'Archivo Excel descargado correctamente.' })); setTimeout(() => setStatus((value) => ({ ...value, notice: '' })), 3000) }
    catch (error) { setStatus((value) => ({ ...value, exporting: false, error: error.message })) }
  }

  const summary = report?.summary || {}
  return <section className="reports-module"><header className="reports-heading"><div><p className="section-kicker">Análisis de alimentación</p><h1>Reportes</h1><p>Consulta la programación y el consumo del servicio de alimentación.</p></div>{view === 'daily' && <button className="excel-button" disabled={status.exporting} onClick={exportExcel}><span>⇩</span>{status.exporting ? 'Preparando Excel…' : 'Exportar Excel'}</button>}</header>
    <div className="report-view-tabs"><button className={view === 'daily' ? 'active' : ''} onClick={() => setView('daily')}>Consumo diario</button><button className={view === 'shifts' ? 'active' : ''} onClick={() => setView('shifts')}>Preview de turnos</button></div>
    {view === 'shifts' ? <ShiftPreview /> : <>
    <form className="report-filters" onSubmit={submit}><label>Desde<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label><label>Hasta<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label><MultiChoice label="Comidas" value={filters.meal_type} onChange={(value) => setFilters({ ...filters, meal_type: value })} options={[{ value: 'DESAYUNO', label: 'Desayuno' }, { value: 'TARDE', label: 'Tarde' }, { value: 'NOCHE', label: 'Noche' }]} /><MultiChoice label="Turnos" value={filters.shift_type} onChange={(value) => setFilters({ ...filters, shift_type: value })} options={[{ value: 'DIA', label: 'Día' }, { value: 'NOCHE', label: 'Noche' }]} /><button type="button" onClick={clear}>Limpiar</button><button className="primary-action">Aplicar filtros</button></form>
    {status.error && <p className="inline-error">{status.error}</p>}{status.notice && <p className="inline-success">✓ {status.notice}</p>}
    <div className="report-summary"><article><small>Elegibles</small><strong>{summary.total_eligible ?? '—'}</strong><span>Total programado</span></article><article className="positive"><small>Consumieron</small><strong>{summary.consumed ?? '—'}</strong><span>Pedidos entregados</span></article><article className="warning"><small>Sin validar</small><strong>{summary.requested_not_validated ?? '—'}</strong><span>Pedidos pendientes</span></article><article><small>No reclamaron</small><strong>{summary.not_claimed ?? '—'}</strong><span>Sin solicitud</span></article><article className="negative"><small>No consumieron</small><strong>{summary.did_not_consume ?? '—'}</strong><span>Pendientes + no reclamados</span></article></div>
    <div className="report-period"><span>Periodo consultado</span><strong>{report?.filters?.from?.slice(0, 10) || '—'} → {report?.filters?.to?.slice(0, 10) || '—'}</strong></div>
    {status.loading ? <div className="list-loading"><span className="large-spinner" /> Cargando reporte…</div> : <><div className="table-scroll"><table className="workers-table report-table"><thead><tr><th>Trabajador</th><th>Documento</th><th>Código</th><th>Departamento</th><th>Fecha</th><th>Comida</th><th>Turno</th><th>Resultado</th></tr></thead><tbody>{report?.data?.map((row) => <tr key={row.id}><td><strong>{row.full_name}</strong></td><td>{row.document_number}</td><td>{row.employee_code || '—'}</td><td>{row.department || '—'}</td><td>{row.service_date?.slice(0, 10)}</td><td>{MEALS[row.meal_type] || row.meal_type}</td><td>{row.shift_type}</td><td><span className={`report-status ${row.status?.toLowerCase()}`}>{STATUS[row.status] || row.status}</span></td></tr>)}</tbody></table>{!report?.data?.length && <div className="empty-report">No hay registros para los filtros seleccionados.</div>}</div><div className="pagination"><span>Mostrando {report?.data?.length || 0} de {report?.total || 0} registros</span><div><button disabled={(report?.page || 1) <= 1} onClick={() => changePage(report.page - 1)}>←</button><strong>{report?.page || 1} / {report?.total_pages || 1}</strong><button disabled={(report?.page || 1) >= (report?.total_pages || 1)} onClick={() => changePage(report.page + 1)}>→</button></div></div></>}</>}
  </section>
}
