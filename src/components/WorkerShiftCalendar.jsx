import { useEffect, useMemo, useRef, useState } from 'react'
import { createShiftAssignment, deleteShiftAssignment, getWorkerShifts, updateShiftAssignment } from '../services/auth'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const isoDate = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
const todayText = () => { const d = new Date(); return isoDate(d.getFullYear(), d.getMonth(), d.getDate()) }

function ConfirmDialog({ confirmation, onAnswer }) {
  if (!confirmation) return null
  return <div className="react-confirm-backdrop"><section className="react-confirm" role="alertdialog" aria-modal="true"><span className="confirm-symbol">?</span><h3>{confirmation.title}</h3><p>{confirmation.message}</p><div><button onClick={() => onAnswer(false)}>No, cancelar</button><button className={confirmation.danger ? 'danger-confirm' : 'confirm-action'} onClick={() => onAnswer(true)}>Sí, confirmar</button></div></section></div>
}

function ShiftEditor({ mode, date, shift, workerId, onClose, onChanged, askConfirmation }) {
  const [form, setForm] = useState({ shift_type: shift?.shift_type || 'DIA', notes: shift?.notes || '' })
  const [status, setStatus] = useState({ loading: false, error: '' })
  const locked = mode === 'edit' && date <= todayText()
  async function save(event) {
    event.preventDefault(); setStatus({ loading: true, error: '' })
    const payload = { shift_type: form.shift_type, work_date: date, notes: form.notes }
    if (mode === 'edit' && !await askConfirmation('Cambiar turno', '¿Estás seguro de cambiar el tipo de turno o sus notas?')) { setStatus({ loading: false, error: '' }); return }
    try { onChanged(mode === 'create' ? await createShiftAssignment({ worker_id: workerId, ...payload }) : await updateShiftAssignment(shift.id, payload), mode) }
    catch (error) { setStatus({ loading: false, error: error.message }) }
  }
  async function remove() {
    if (locked || !await askConfirmation('Eliminar turno', '¿Estás seguro de eliminar este turno? Esta acción no se puede deshacer.', true)) return
    setStatus({ loading: true, error: '' })
    try { await deleteShiftAssignment(shift.id); onChanged(shift, 'delete') }
    catch (error) { setStatus({ loading: false, error: error.message }) }
  }
  return <div className="calendar-editor-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><form className="calendar-editor" onSubmit={save}><header><div><small>{mode === 'create' ? 'Nuevo turno' : 'Editar turno'}</small><strong>{date}</strong></div><button type="button" onClick={onClose}>×</button></header>{locked && <p className="locked-warning">Esta fecha ya no admite cambios.</p>}<div className="shift-choice"><button type="button" disabled={locked} className={form.shift_type === 'DIA' ? 'selected day' : ''} onClick={() => setForm({ ...form, shift_type: 'DIA' })}><span>☀</span><strong>Día</strong><small>Turno diurno</small></button><button type="button" disabled={locked} className={form.shift_type === 'NOCHE' ? 'selected night' : ''} onClick={() => setForm({ ...form, shift_type: 'NOCHE' })}><span>☾</span><strong>Noche</strong><small>Turno nocturno</small></button></div><label>Notas<textarea disabled={locked} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observación opcional" /></label>{status.error && <p className="inline-error">{status.error}</p>}<footer>{mode === 'edit' && <button className="delete-assignment" type="button" disabled={locked || status.loading} onClick={remove}>Eliminar turno</button>}<span /><button type="button" onClick={onClose}>Cancelar</button><button className="primary-action" disabled={locked || status.loading}>{status.loading ? 'Guardando…' : mode === 'create' ? 'Crear turno' : 'Guardar cambios'}</button></footer></form></div>
}

export default function WorkerShiftCalendar({ worker, onClose }) {
  const now = new Date(), holdTimer = useRef(null), hoveredRef = useRef(null), confirmResolver = useRef(null), suppressClick = useRef(false)
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [shifts, setShifts] = useState([]), [editor, setEditor] = useState(null), [moving, setMoving] = useState(null)
  const [hoveredDate, setHoveredDate] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [status, setStatus] = useState({ loading: true, error: '', notice: '' })
  const year = month.getFullYear(), monthIndex = month.getMonth()
  const name = [worker.profile?.first_name, worker.profile?.last_name].filter(Boolean).join(' ') || 'Trabajador'
  const from = isoDate(year, monthIndex, 1), to = isoDate(year, monthIndex, new Date(year, monthIndex + 1, 0).getDate())
  function load() {
    setStatus((value) => ({ ...value, loading: true, error: '' }))
    getWorkerShifts(worker.id, from, to).then((response) => { setShifts(Array.isArray(response) ? response : response?.shifts || response?.items || response?.data || []); setStatus((value) => ({ ...value, loading: false })) }).catch((error) => setStatus({ loading: false, error: error.message, notice: '' }))
  }
  useEffect(load, [worker.id, from, to])
  useEffect(() => {
    if (!moving) return
    const trackDestination = (event) => {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-calendar-date]')
      const date = target?.dataset.calendarDate || null
      hoveredRef.current = date
      setHoveredDate(date)
    }
    const finishMove = () => { suppressClick.current = true; setTimeout(() => { suppressClick.current = false }, 250); const date = hoveredRef.current; if (date) moveShift(moving, date); else setMoving(null) }
    window.addEventListener('pointermove', trackDestination)
    window.addEventListener('pointerup', finishMove, { once: true })
    return () => { window.removeEventListener('pointermove', trackDestination); window.removeEventListener('pointerup', finishMove) }
  }, [moving])
  const calendar = useMemo(() => { const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7, days = new Date(year, monthIndex + 1, 0).getDate(), cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]; return [...cells, ...Array(42 - cells.length).fill(null)] }, [year, monthIndex])
  const byDate = Object.fromEntries(shifts.map((shift) => [String(shift.work_date).slice(0, 10), shift]))

  async function moveShift(shift, date) {
    const oldDate = String(shift.work_date).slice(0, 10); setMoving(null); setHoveredDate(null)
    if (date === oldDate || date <= todayText()) return
    if (byDate[date]) { setStatus((value) => ({ ...value, notice: '', error: 'Ese día ya tiene un turno asignado.' })); return }
    if (!await askConfirmation('Mover turno', `¿Estás seguro de cambiar la fecha del turno del ${oldDate} al ${date}?`)) return
    setStatus((value) => ({ ...value, loading: true, error: '' }))
    try { await updateShiftAssignment(shift.id, { shift_type: shift.shift_type, work_date: date, notes: shift.notes || '' }); setStatus({ loading: false, error: '', notice: `Turno movido del ${oldDate} al ${date}.` }); load() }
    catch (error) { setStatus({ loading: false, error: error.message, notice: '' }) }
  }
  function clickDay(date, shift) { if (suppressClick.current) return; if (moving) { moveShift(moving, date); return } if (!shift && date > todayText()) setEditor({ mode: 'create', date }) }
  function startHold(shift) { if (String(shift.work_date).slice(0, 10) <= todayText()) return; holdTimer.current = setTimeout(() => setMoving(shift), 550) }
  const cancelHold = () => clearTimeout(holdTimer.current)
  function changed(_, action) { setEditor(null); setStatus({ loading: false, error: '', notice: action === 'delete' ? 'Turno eliminado.' : action === 'create' ? 'Turno creado.' : 'Turno actualizado.' }); load() }
  function askConfirmation(title, message, danger = false) {
    return new Promise((resolve) => { confirmResolver.current = resolve; setConfirmation({ title, message, danger }) })
  }
  function answerConfirmation(answer) { confirmResolver.current?.(answer); confirmResolver.current = null; setConfirmation(null) }

  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal calendar-modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose}>×</button><p className="modal-kicker">Calendario individual</p><h2>Turnos de {name}</h2><p className="modal-description">Clic en un día vacío para crear · doble clic para editar · arrastra o mantén presionado para mover.</p><div className="calendar-toolbar"><button onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}>←</button><strong>{MONTHS[monthIndex]} {year}</strong><button onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}>→</button></div><div className="calendar-legend"><span><i className="day-dot" /> Día</span><span><i className="night-dot" /> Noche</span></div>
    {moving && <div className="move-banner">Moviendo turno del {String(moving.work_date).slice(0, 10)}. Selecciona el nuevo día. <button onClick={() => setMoving(null)}>Cancelar</button></div>}{status.error && <p className="inline-error">{status.error}</p>}{status.notice && <p className="inline-success">✓ {status.notice}</p>}
    <div className={`month-calendar ${status.loading ? 'is-loading' : ''}`}>{WEEKDAYS.map((day) => <div className="weekday" key={day}>{day}</div>)}{calendar.map((day, index) => { if (!day) return <div className="calendar-day empty" key={`e-${index}`} />; const date = isoDate(year, monthIndex, day), shift = byDate[date], locked = date <= todayText(); return <div data-calendar-date={date} className={`calendar-day ${shift ? `has-shift ${shift.shift_type.toLowerCase()}` : ''} ${date === todayText() ? 'today' : ''} ${locked ? 'locked' : ''} ${moving && !shift && !locked ? 'move-target' : ''} ${hoveredDate === date && moving ? 'is-destination' : ''}`} key={date} onClick={() => clickDay(date, shift)} onDoubleClick={() => shift && !locked && setEditor({ mode: 'edit', date, shift })}><span>{day}</span>{shift && <div onPointerDown={() => startHold(shift)} onPointerUp={cancelHold} onPointerLeave={cancelHold}><strong>{shift.shift_type === 'DIA' ? '☀ Día' : '☾ Noche'}</strong>{shift.notes && <small>{shift.notes}</small>}</div>}</div>})}{status.loading && <div className="calendar-loading"><span className="large-spinner" /> Cargando…</div>}</div>{editor && <ShiftEditor {...editor} workerId={worker.id} onClose={() => setEditor(null)} onChanged={changed} askConfirmation={askConfirmation} />}<ConfirmDialog confirmation={confirmation} onAnswer={answerConfirmation} /></section></div>
}
