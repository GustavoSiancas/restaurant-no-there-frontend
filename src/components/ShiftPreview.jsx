import { useEffect, useState } from 'react'
import { downloadShiftPreview, getShiftPreview } from '../services/auth'

const INITIAL = { date: '', meal_type: [], shift_type: [], page: 1, page_size: 20 }

export function MultiChoice({ label, options, value, onChange }) {
  const toggle = (option) => onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option])
  return <fieldset className="multi-choice"><legend>{label}</legend>{options.map((option) => <button type="button" className={value.includes(option.value) ? 'selected' : ''} onClick={() => toggle(option.value)} key={option.value}>{option.label}</button>)}</fieldset>
}

export default function ShiftPreview() {
  const [filters, setFilters] = useState(INITIAL)
  const [applied, setApplied] = useState(INITIAL)

  const [preview, setPreview] = useState(null)

  const [status, setStatus] = useState({
    loading: true,
    exporting: false,
    error: '',
    notice: '',
  })

  useEffect(() => {
    setStatus((value) => ({
      ...value,
      loading: true,
      error: '',
    }))

    getShiftPreview(applied)
      .then(setPreview)
      .catch((error) =>
        setStatus((value) => ({
          ...value,
          error: error.message,
        }))
      )
      .finally(() =>
        setStatus((value) => ({
          ...value,
          loading: false,
        }))
      )
  }, [applied])

  const submit = (event) => {
    event.preventDefault()

    const next = {
      ...filters,
      page: 1,
    }

    setFilters(next)
    setApplied(next)
  }

  const clear = () => {
    setFilters(INITIAL)
    setApplied(INITIAL)
  }

  const page = (number) => {
    const next = {
      ...applied,
      page: number,
    }

    setApplied(next)

    setFilters((value) => ({
      ...value,
      page: number,
    }))
  }

  async function exportFile() {
    setStatus((value) => ({
      ...value,
      exporting: true,
      error: '',
    }))

    try {
      await downloadShiftPreview(applied)

      setStatus((value) => ({
        ...value,
        exporting: false,
        notice: 'Preview exportada correctamente.',
      }))
    } catch (error) {
      setStatus((value) => ({
        ...value,
        exporting: false,
        error: error.message,
      }))
    }
  }

  const summary = preview?.summary || {}

  return (
    <div className="preview-report">

      <div className="subreport-heading">
        <div>
          <h2>Preview de turnos</h2>
          <p>
            Revisa qué trabajadores y comidas están programados para una fecha.
          </p>
        </div>

        <button
          className="excel-button"
          onClick={exportFile}
          disabled={status.exporting}
        >
          <span>⇩</span>
          {status.exporting ? 'Preparando…' : 'Exportar turnos'}
        </button>
      </div>

      <form className="preview-filters" onSubmit={submit}>
        <label>
          Fecha
          <input
            type="date"
            value={filters.date}
            onChange={(event) =>
              setFilters({
                ...filters,
                date: event.target.value,
              })
            }
          />
        </label>

        <MultiChoice
          label="Comidas"
          value={filters.meal_type}
          onChange={(value) =>
            setFilters({
              ...filters,
              meal_type: value,
            })
          }
          options={[
            {
              value: 'DESAYUNO',
              label: 'Desayuno',
            },
            {
              value: 'TARDE',
              label: 'Almuerzo',
            },
            {
              value: 'NOCHE',
              label: 'Cena',
            },
          ]}
        />

        <div className="filter-actions">
          <button
            type="button"
            onClick={clear}
          >
            Limpiar
          </button>

          <button className="primary-action">
            Consultar
          </button>
        </div>
      </form>

      {status.error && (
        <p className="inline-error">
          {status.error}
        </p>
      )}

      {status.notice && (
        <p className="inline-success">
          ✓ {status.notice}
        </p>
      )}

      <div className="preview-summary">
        <article>
          <small>Total asignados</small>
          <strong>
            {summary.total_assigned ?? '—'}
          </strong>
        </article>

        <article>
          <small>Turno día</small>
          <strong>
            {summary.by_shift?.DIA ?? '—'}
          </strong>
        </article>

        <article>
          <small>Turno noche</small>
          <strong>
            {summary.by_shift?.NOCHE ?? '—'}
          </strong>
        </article>

        <article>
          <small>Desayunos</small>
          <strong>
            {summary.by_meal?.DESAYUNO ?? '—'}
          </strong>
        </article>

        <article>
          <small>Almuerzos</small>
          <strong>
            {summary.by_meal?.TARDE ?? '—'}
          </strong>
        </article>

        <article>
          <small>Cenas</small>
          <strong>
            {summary.by_meal?.NOCHE ?? '—'}
          </strong>
        </article>
      </div>

      {status.loading ? (
        <div className="list-loading">
          <span className="large-spinner" />
          Cargando preview…
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table className="workers-table preview-table">
              <thead>
                <tr>
                  <th>Trabajador</th>
                  <th>Documento</th>
                  <th>Código</th>
                  <th>Cargo</th>
                  <th>Departamento</th>
                  <th>Turno</th>
                  <th>Comidas asignadas</th>
                </tr>
              </thead>

              <tbody>
                {preview?.data?.map((row) => (
                  <tr key={row.assignment_id}>
                    <td>
                      <strong>
                        {row.worker?.full_name}
                      </strong>
                    </td>

                    <td>
                      {row.worker?.document_number}
                    </td>

                    <td>
                      {row.worker?.employee_code}
                    </td>

                    <td>
                      {row.worker?.job_title || '—'}
                    </td>

                    <td>
                      {row.worker?.department || '—'}
                    </td>

                    <td>
                      <span
                        className={`shift-label ${
                          row.shift_type === 'NOCHE'
                            ? 'night'
                            : ''
                        }`}
                      >
                        {row.shift_type}
                      </span>
                    </td>

                    <td>
                      <div className="assigned-meals">
                        {row.assigned_meals?.map((meal) => (
                          <span
                            key={`${meal.meal_type}-${meal.service_date}`}
                          >
                            <b>
                              {meal.display_name}
                            </b>

                            <small>
                              {meal.service_date?.slice(0, 10)}
                            </small>

                            {meal.start}–{meal.end}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!preview?.data?.length && (
              <div className="empty-report">
                No hay turnos para los filtros seleccionados.
              </div>
            )}
          </div>

          <div className="pagination">
            <span>
              Mostrando {preview?.data?.length || 0} de{' '}
              {preview?.total || 0}
            </span>

            <div>
              <button
                disabled={(preview?.page || 1) <= 1}
                onClick={() => page(preview.page - 1)}
              >
                ←
              </button>

              <strong>
                {preview?.page || 1} /{' '}
                {preview?.total_pages || 1}
              </strong>

              <button
                disabled={
                  (preview?.page || 1) >=
                  (preview?.total_pages || 1)
                }
                onClick={() => page(preview.page + 1)}
              >
                →
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
