import { useEffect, useMemo, useState } from 'react'
import { getMyShiftAssignments } from '../services/auth'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const isoDate = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

function normalize(response) {
  if (Array.isArray(response)) return response
  return response?.assignments || response?.shifts || response?.items || response?.data || []
}

export default function WorkerSchedule() {
  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [shifts, setShifts] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const year = month.getFullYear(), monthIndex = month.getMonth()
  const from = isoDate(year, monthIndex, 1)
  const to = isoDate(year, monthIndex, new Date(year, monthIndex + 1, 0).getDate())

  useEffect(() => {
    setStatus({ loading: true, error: '' })
    getMyShiftAssignments(from, to).then((response) => { setShifts(normalize(response)); setStatus({ loading: false, error: '' }) }).catch((error) => setStatus({ loading: false, error: error.message }))
  }, [from, to])

  const cells = useMemo(() => {
    const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7
    const days = new Date(year, monthIndex + 1, 0).getDate()
    const values = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)]
    return [...values, ...Array(42 - values.length).fill(null)]
  }, [year, monthIndex])
  const shiftsByDate = Object.fromEntries(shifts.map((shift) => [String(shift.work_date).slice(0, 10), shift]))
  const todayString = isoDate(today.getFullYear(), today.getMonth(), today.getDate())

  return <section className="worker-schedule"><header className="schedule-intro"><div><p className="section-kicker">Mi jornada</p><h1>Mi horario</h1><p>Consulta los turnos que tienes programados para cada fecha.</p></div><div className="schedule-legend"><span><i className="day-dot" /> Turno día</span><span><i className="night-dot" /> Turno noche</span></div></header>
    <div className="schedule-card"><div className="calendar-toolbar"><button onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}>←</button><strong>{MONTHS[monthIndex]} {year}</strong><button onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}>→</button></div>{status.error && <p className="inline-error">{status.error}</p>}
      <div className={`month-calendar readonly-calendar ${status.loading ? 'is-loading' : ''}`}>{WEEKDAYS.map((day) => <div className="weekday" key={day}>{day}</div>)}{cells.map((day, index) => { if (!day) return <div className="calendar-day empty" key={`empty-${index}`} />; const date = isoDate(year, monthIndex, day), shift = shiftsByDate[date]; return <div className={`calendar-day ${shift ? `has-shift ${shift.shift_type.toLowerCase()}` : ''} ${date === todayString ? 'today' : ''}`} key={date}><span>{day}</span>{shift && <div><strong>{shift.shift_type === 'DIA' ? '☀ Turno día' : '☾ Turno noche'}</strong>{shift.notes && <small>{shift.notes}</small>}</div>}</div>})}{status.loading && <div className="calendar-loading"><span className="large-spinner" /> Cargando horario…</div>}</div>
    </div>
  </section>
}
