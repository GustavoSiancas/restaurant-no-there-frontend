import { useMemo, useState } from 'react'
import { createShiftAssignment } from '../services/auth'

const dateText = (date = new Date()) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const nameOf = (worker) => [worker?.profile?.first_name, worker?.profile?.last_name].filter(Boolean).join(' ') || 'Sin nombre'

function rangeBetween(start, end) {
  if (!start || !end || end < start) return []
  const dates = [], cursor = new Date(`${start}T12:00:00`), last = new Date(`${end}T12:00:00`)
  while (cursor <= last) { dates.push(dateText(cursor)); cursor.setDate(cursor.getDate() + 1) }
  return dates
}

export default function ShiftPlanner({ workers }) {
  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = dateText(tomorrowDate)
  const [start, setStart] = useState(tomorrow), [end, setEnd] = useState(tomorrow)
  const [shift, setShift] = useState('DIA'), [notes, setNotes] = useState('')
  const [selected, setSelected] = useState([]), [search, setSearch] = useState('')
  const [status, setStatus] = useState({ loading: false, error: '', success: '', failures: [] })
  const dates = useMemo(() => rangeBetween(start, end), [start, end])
  const filtered = workers.filter((worker) => `${nameOf(worker)} ${worker.worker_information?.employee_code || ''}`.toLowerCase().includes(search.toLowerCase()))
  const total = dates.length * selected.length
  const toggle = (id) => setSelected((list) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id])

  async function save() {
    if (!dates.length || start < tomorrow || !selected.length) { setStatus({ loading: false, error: 'Los turnos solo pueden programarse desde mañana. Selecciona fechas válidas y al menos un trabajador.', success: '', failures: [] }); return }
    setStatus({ loading: true, error: '', success: '', failures: [] })
    const payloads = selected.flatMap((workerId) => dates.map((workDate) => ({ worker_id: workerId, shift_type: shift, work_date: workDate, notes })))
    const results = await Promise.allSettled(payloads.map(createShiftAssignment))
    const created = results.filter((result) => result.status === 'fulfilled').map((result) => result.value)
    const failed = results.map((result, index) => ({ result, payload: payloads[index] })).filter(({ result }) => result.status === 'rejected').map(({ result, payload }) => ({
      worker: nameOf(workers.find((item) => item.id === payload.worker_id)),
      date: payload.work_date,
      message: result.reason.message,
      existing: result.reason.details?.existing_shift,
    }))
    if (failed.length === 0 && created.length) { setSelected([]); setNotes('') }
    setStatus({ loading: false, error: failed.length ? 'Algunas personas no pudieron ser anotadas. Revisa los siguientes casos y verifica el motivo.' : '', success: failed.length === 0 && created.length ? 'Salió bien.' : '', failures: failed })
  }

  return <section className="panel-section shift-planner" id="shifts">
    <div className="section-heading"><div><p className="section-kicker">Planificación</p><h2>Asignación de turnos</h2><p>Programa turnos por rango de fechas y grupo de trabajadores.</p></div><span className="planner-lock">Los días vencidos quedan bloqueados</span></div>
    <div className="planner-steps">
      <article className="planner-step"><header><span>1</span><div><strong>Fechas y turno</strong><p>Define el periodo natural.</p></div></header>
        <div className="date-range"><label>Desde<input type="date" min={tomorrow} value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value) }} /></label><b>→</b><label>Hasta<input type="date" min={start > tomorrow ? start : tomorrow} value={end} onChange={(e) => setEnd(e.target.value)} /></label></div>
        <div className="shift-choice"><button type="button" className={shift === 'DIA' ? 'selected day' : ''} onClick={() => setShift('DIA')}><span>☀</span><strong>Día</strong><small>Turno diurno</small></button><button type="button" className={shift === 'NOCHE' ? 'selected night' : ''} onClick={() => setShift('NOCHE')}><span>☾</span><strong>Noche</strong><small>Turno nocturno</small></button></div>
        <label className="planner-notes">Notas<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional para todo el grupo" /></label>
      </article>
      <article className="planner-step"><header><span>2</span><div><strong>Trabajadores</strong><p>Selecciona uno o varios.</p></div><em>{selected.length} seleccionados</em></header>
        <input className="worker-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o código…" />
        <div className="worker-picker">{filtered.length ? filtered.map((worker) => <button type="button" className={selected.includes(worker.id) ? 'selected' : ''} onClick={() => toggle(worker.id)} key={worker.id}><span className="picker-check">{selected.includes(worker.id) ? '✓' : ''}</span><div><strong>{nameOf(worker)}</strong><small>{worker.worker_information?.employee_code || 'Sin código'} · {worker.worker_information?.department || 'Sin departamento'}</small></div></button>) : <p>No se encontraron trabajadores.</p>}</div>
      </article>
    </div>
    <div className="planner-save"><div><strong>{total} asignaciones por crear</strong><p>{dates.length} día(s) × {selected.length} trabajador(es)</p></div><button className="primary-action" type="button" disabled={status.loading || !total} onClick={save}>{status.loading ? 'Guardando…' : 'Guardar planificación'}</button></div>
    {status.error && <p className="inline-error">{status.error}</p>}{status.success && <p className="inline-success">✓ {status.success}</p>}
    {status.failures?.length > 0 && <div className="assignment-failures"><strong>Personas y fechas que debes revisar</strong>{status.failures.map((failure, index) => <article key={`${failure.worker}-${failure.date}-${index}`}><div><b>{failure.worker}</b><span>{failure.date}</span></div><p>{failure.message}</p>{failure.existing && <small>Turno existente: <b>{failure.existing.shift_type}</b>{failure.existing.notes ? ` · ${failure.existing.notes}` : ''}</small>}</article>)}</div>}
  </section>
}
