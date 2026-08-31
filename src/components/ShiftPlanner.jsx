import { useMemo, useState } from 'react'
import { createShiftAssignment } from '../services/auth'

const dateText = (date = new Date()) =>
  new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10)

const nameOf = (worker) =>
  [worker?.profile?.first_name, worker?.profile?.last_name]
    .filter(Boolean)
    .join(' ') || 'Sin nombre'

function rangeBetween(start, end) {
  if (!start || !end || end < start) return []

  const dates = []
  const cursor = new Date(`${start}T12:00:00`)
  const last = new Date(`${end}T12:00:00`)

  while (cursor <= last) {
    dates.push(dateText(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

function getNextWeekRange() {
  const today = new Date()

  // JS:
  // Sunday = 0
  // Monday = 1
  // ...
  // Saturday = 6
  const day = today.getDay()

  const daysUntilNextMonday =
    day === 0
      ? 1
      : 8 - day

  const nextMonday = new Date(today)
  nextMonday.setDate(today.getDate() + daysUntilNextMonday)

  const nextSunday = new Date(nextMonday)
  nextSunday.setDate(nextMonday.getDate() + 6)

  return {
    start: dateText(nextMonday),
    end: dateText(nextSunday),
  }
}

export default function ShiftPlanner({ workers }) {
  const nextWeek = useMemo(() => getNextWeekRange(), [])

  const [start, setStart] = useState(nextWeek.start)
  const [end, setEnd] = useState(nextWeek.start)

  const [shift, setShift] = useState('DIA')
  const [notes, setNotes] = useState('')

  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')

  const [status, setStatus] = useState({
    loading: false,
    error: '',
    success: '',
    failures: [],
  })

  const dates = useMemo(
    () => rangeBetween(start, end),
    [start, end]
  )

  const filtered = workers.filter((worker) =>
    `${nameOf(worker)} ${worker.worker_information?.employee_code || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const total = dates.length * selected.length

  const toggle = (id) => {
    setSelected((list) =>
      list.includes(id)
        ? list.filter((item) => item !== id)
        : [...list, id]
    )
  }

  async function save() {
    if (
      !dates.length ||
      start < nextWeek.start ||
      end > nextWeek.end ||
      !selected.length
    ) {
      setStatus({
        loading: false,
        error:
          'Solo puedes programar turnos correspondientes a la próxima semana. Selecciona fechas válidas y al menos un trabajador.',
        success: '',
        failures: [],
      })

      return
    }

    setStatus({
      loading: true,
      error: '',
      success: '',
      failures: [],
    })

    const payloads = selected.flatMap((workerId) =>
      dates.map((workDate) => ({
        worker_id: workerId,
        shift_type: shift,
        work_date: workDate,
        notes,
      }))
    )

    const results = await Promise.allSettled(
      payloads.map(createShiftAssignment)
    )

    const created = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value)

    const failed = results
      .map((result, index) => ({
        result,
        payload: payloads[index],
      }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ result, payload }) => ({
        worker: nameOf(
          workers.find(
            (item) => item.id === payload.worker_id
          )
        ),
        date: payload.work_date,
        message: result.reason.message,
        existing: result.reason.details?.existing_shift,
      }))

    if (failed.length === 0 && created.length) {
      setSelected([])
      setNotes('')
    }

    setStatus({
      loading: false,
      error: failed.length
        ? 'Algunas personas no pudieron ser anotadas. Revisa los siguientes casos y verifica el motivo.'
        : '',
      success:
        failed.length === 0 && created.length
          ? 'Salió bien.'
          : '',
      failures: failed,
    })
  }

  return (
    <section
      className="panel-section shift-planner"
      id="shifts"
    >
      <div className="section-heading">
        <div>
          <p className="section-kicker">
            Planificación
          </p>

          <h2>
            Asignación de turnos
          </h2>

          <p>
            Programa turnos por rango de fechas y grupo de trabajadores.
          </p>
        </div>

        <span className="planner-lock">
          Solo se puede planificar la próxima semana
        </span>
      </div>

      <div className="planner-steps">
        <article className="planner-step">
          <header>
            <span>
              1
            </span>

            <div>
              <strong>
                Fechas y turno
              </strong>

              <p>
                Solo puedes seleccionar días de la próxima semana.
              </p>
            </div>
          </header>

          <div className="date-range">
            <label>
              Desde

              <input
                type="date"
                min={nextWeek.start}
                max={nextWeek.end}
                value={start}
                onChange={(e) => {
                  const value = e.target.value

                  setStart(value)

                  if (value > end) {
                    setEnd(value)
                  }
                }}
              />
            </label>

            <b>
              →
            </b>

            <label>
              Hasta

              <input
                type="date"
                min={start}
                max={nextWeek.end}
                value={end}
                onChange={(e) =>
                  setEnd(e.target.value)
                }
              />
            </label>
          </div>

          <div className="shift-choice">
            <button
              type="button"
              className={
                shift === 'DIA'
                  ? 'selected day'
                  : ''
              }
              onClick={() =>
                setShift('DIA')
              }
            >
              <span>
                ☀
              </span>

              <strong>
                Día
              </strong>

              <small>
                Turno diurno
              </small>
            </button>

            <button
              type="button"
              className={
                shift === 'NOCHE'
                  ? 'selected night'
                  : ''
              }
              onClick={() =>
                setShift('NOCHE')
              }
            >
              <span>
                ☾
              </span>

              <strong>
                Noche
              </strong>

              <small>
                Turno nocturno
              </small>
            </button>
          </div>

          <label className="planner-notes">
            Notas

            <input
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value)
              }
              placeholder="Opcional para todo el grupo"
            />
          </label>
        </article>

        <article className="planner-step">
          <header>
            <span>
              2
            </span>

            <div>
              <strong>
                Trabajadores
              </strong>

              <p>
                Selecciona uno o varios.
              </p>
            </div>

            <em>
              {selected.length} seleccionados
            </em>
          </header>

          <input
            className="worker-search"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Buscar por nombre o código…"
          />

          <div className="worker-picker">
            {filtered.length ? (
              filtered.map((worker) => (
                <button
                  type="button"
                  className={
                    selected.includes(worker.id)
                      ? 'selected'
                      : ''
                  }
                  onClick={() =>
                    toggle(worker.id)
                  }
                  key={worker.id}
                >
                  <span className="picker-check">
                    {selected.includes(worker.id)
                      ? '✓'
                      : ''}
                  </span>

                  <div>
                    <strong>
                      {nameOf(worker)}
                    </strong>

                    <small>
                      {worker.worker_information?.employee_code ||
                        'Sin código'}{' '}
                      ·{' '}
                      {worker.worker_information?.department ||
                        'Sin departamento'}
                    </small>
                  </div>
                </button>
              ))
            ) : (
              <p>
                No se encontraron trabajadores.
              </p>
            )}
          </div>
        </article>
      </div>

      <div className="planner-save">
        <div>
          <strong>
            {total} asignaciones por crear
          </strong>

          <p>
            {dates.length} día(s) × {selected.length} trabajador(es)
          </p>

          <small>
            Semana permitida: {nextWeek.start} → {nextWeek.end}
          </small>
        </div>

        <button
          className="primary-action"
          type="button"
          disabled={
            status.loading ||
            !total
          }
          onClick={save}
        >
          {status.loading
            ? 'Guardando…'
            : 'Guardar planificación'}
        </button>
      </div>

      {status.error && (
        <p className="inline-error">
          {status.error}
        </p>
      )}

      {status.success && (
        <p className="inline-success">
          ✓ {status.success}
        </p>
      )}

      {status.failures?.length > 0 && (
        <div className="assignment-failures">
          <strong>
            Personas y fechas que debes revisar
          </strong>

          {status.failures.map(
            (failure, index) => (
              <article
                key={`${failure.worker}-${failure.date}-${index}`}
              >
                <div>
                  <b>
                    {failure.worker}
                  </b>

                  <span>
                    {failure.date}
                  </span>
                </div>

                <p>
                  {failure.message}
                </p>

                {failure.existing && (
                  <small>
                    Turno existente:{' '}
                    <b>
                      {failure.existing.shift_type}
                    </b>

                    {failure.existing.notes
                      ? ` · ${failure.existing.notes}`
                      : ''}
                  </small>
                )}
              </article>
            )
          )}
        </div>
      )}
    </section>
  )
}