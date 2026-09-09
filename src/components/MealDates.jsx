import { useEffect, useRef, useState } from 'react'
import FoodList from './FoodList'
import { foodColorStyle } from '../utils/foodColor'
import { createFoodDay, deleteFoodDay, getFoodDays } from '../services/auth'

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
})
const displayDate = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})
const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const meals = [{ type: 'BREAKFAST', label: 'Desayuno' }, { type: 'LUNCH', label: 'Almuerzo' }, { type: 'DINNER', label: 'Cena' }]
const calories = (value) => `${Number(value || 0).toLocaleString('es-PE')} kcal`

function todayInPeru() {
  const parts = Object.fromEntries(dateFormatter.formatToParts(new Date()).map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
function weekDays(today, offset) {
  const monday = new Date(`${today}T00:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7 + offset * 7)
  return weekdays.map((label, index) => {
    const date = new Date(monday)
    date.setUTCDate(monday.getUTCDate() + index)
    return { label, date, key: date.toISOString().slice(0, 10) }
  })
}
async function loadDay(date) {
  const data = await getFoodDays(date)
  if (!Array.isArray(data)) throw new Error('El servidor devolvió un calendario con formato inesperado.')
  return data.find((day) => day.service_date === date) || { service_date: date, total_calories: 0, meals: [] }
}

function MealSlotFoods({ foods, unavailable, mealLabel, date, onRemove }) {
  const listRef = useRef(null)
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height))
    observer.observe(listRef.current)
    return () => observer.disconnect()
  }, [])
  const rowHeight = (height - Math.max(0, foods.length - 1) * 4) / Math.max(1, foods.length)
  const mode = rowHeight >= 110 ? 'large' : rowHeight >= 64 ? 'medium' : 'compact'
  return <ul ref={listRef} className={`meal-slot-foods is-${mode}`} style={{ gridAutoRows: 'minmax(36px, 1fr)' }}>
    {foods.map((item, index) => {
      const food = item.food || item
      const assignmentId = item.food_day_id ?? item.id
      const name = food.name || item.food_name || 'Comida'
      const photo = food.photo_url || item.photo_url
      return <li key={assignmentId || index} style={foodColorStyle(food.mixed_color ?? item.mixed_color)}>
        {photo && mode !== 'compact' && <img className="meal-food-photo" src={photo} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
        <div className="meal-food-details"><strong title={name}>{name}</strong><span>{calories(food.total_calories ?? item.total_calories ?? food.calories)}</span></div>
        <button type="button" className="meal-food-delete" disabled={unavailable || !assignmentId}
          aria-label={`Eliminar ${name} de ${mealLabel} del ${date}`} title={`Eliminar ${name}`}
          onClick={(event) => { event.stopPropagation(); onRemove(date, assignmentId, name) }}>×</button>
      </li>
    })}
  </ul>
}

export default function MealDates() {
  const [today, setToday] = useState(todayInPeru)
  const [offset, setOffset] = useState(0)
  const [entries, setEntries] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const [selectedFood, setSelectedFood] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [target, setTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showFoods, setShowFoods] = useState(false)
  const [creating, setCreating] = useState(false)
  const [creatingTag, setCreatingTag] = useState(false)
  const savingRef = useRef(false)
  const days = weekDays(today, offset)
  const weekStart = days[0].key
  useEffect(() => {
    const timer = setInterval(() => setToday(todayInPeru()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setEntries({})
    Promise.all(weekDays(weekStart, 0).map(({ key }) => loadDay(key))).then((data) => {
      if (active) setEntries(Object.fromEntries(data.map((day) => [day.service_date, day])))
    }).catch((requestError) => {
      if (active) setError(requestError.message)
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [weekStart, retry])

  async function assignFood(date, type, food) {
    if (!food || savingRef.current || loading || error) return
    savingRef.current = true
    setSaving(true)
    setNotice('')
    setTarget(null)
    let created = false
    try {
      await createFoodDay({ service_date: date, meal_type: type, food_id: food.id })
      created = true
      setSelectedFood(null)
      const day = await loadDay(date)
      setEntries((previous) => ({ ...previous, [date]: day }))
      setNotice(`${food.name} se agregó a ${meals.find((meal) => meal.type === type).label.toLowerCase()} del ${date}.`)
    } catch (requestError) {
      if (created) setError('La comida se guardó, pero no pudimos actualizar el calendario. Pulsa Reintentar para consultar los datos sin volver a agregarla.')
      else setNotice(`No se pudo agregar la comida: ${requestError.message}`)
    } finally {
      savingRef.current = false
      setSaving(false)
      setDragging(null)
    }
  }
  async function removeFood(date, id, name) {
    if (!id || savingRef.current || loading || error) return
    savingRef.current = true
    setSaving(true)
    setNotice('')
    let deleted = false
    try {
      await deleteFoodDay(id)
      deleted = true
      const day = await loadDay(date)
      setEntries((previous) => ({ ...previous, [date]: day }))
      setNotice(`${name} se eliminó del ${date}.`)
    } catch (requestError) {
      if (deleted) setError('La comida se eliminó, pero no pudimos actualizar el calendario. Pulsa Reintentar para consultar los datos.')
      else setNotice(`No se pudo eliminar la comida: ${requestError.message}`)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }
  const unavailable = loading || saving || !!error
  return (
    <section className="panel-section meal-dates" aria-labelledby="meal-dates-title">
      <div className="section-heading meal-dates-heading">
        <h2 id="meal-dates-title">Fecha de comidas</h2>
        <div className="meal-heading-actions">
        <button type="button" className="meal-foods-toggle" onClick={() => { setShowFoods(true); setCreating(true) }}>+ Nueva comida</button>
        <button type="button" className="meal-foods-toggle" onClick={() => { setShowFoods(true); setCreatingTag(true) }}>+ Nueva etiqueta</button>
        <button type="button" className="meal-foods-toggle" aria-expanded={showFoods} aria-controls="meal-foods-panel"
          onClick={() => { setShowFoods((value) => !value); setDragging(null); setTarget(null) }}>
          {showFoods ? 'Ocultar comidas y etiquetas' : 'Comidas y etiquetas'}
        </button>
        </div>
      </div>
      <div className="meal-planner-status" role="status">{saving ? 'Actualizando calendario…' : notice}</div>
      {selectedFood && <p className="meal-planner-selection">Seleccionada: <strong>{selectedFood.name}</strong> · {calories(selectedFood.total_calories)} <button type="button" onClick={() => setSelectedFood(null)}>Cancelar selección</button></p>}
      <div className={`meal-dates-layout${showFoods ? '' : ' is-calendar-only'}`}>
        <div className="meal-dates-calendar">
          <div className="meal-dates-navigation">
            <button type="button" disabled={saving} aria-label="Semana anterior" onClick={() => setOffset((value) => value - 1)}>←</button>
            <p aria-live="polite">Semana del {displayDate.format(days[0].date)} al {displayDate.format(days[6].date)}</p>
            <button type="button" disabled={saving} aria-label="Semana siguiente" onClick={() => setOffset((value) => value + 1)}>→</button>
            <button type="button" className="meal-dates-current" disabled={offset === 0 || saving} onClick={() => setOffset(0)}>Semana actual</button>
          </div>
          {loading && <p role="status">Cargando calendario…</p>}
          {error && <div className="meal-planner-error" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div>}
          <div className="meal-dates-scroll" role="region" aria-label="Horario semanal de comidas" tabIndex={0} aria-busy={loading || saving}>
            <div className="meal-dates-grid">
              <div className="meal-row-labels" aria-label="Tipos de comida">
                <div />
                {meals.map(({ type, label }) => <div className="meal-row-label" key={type}><span>{label}</span></div>)}
                <div />
              </div>
              {days.map(({ label, date, key }) => (
                <section key={key} className={`meal-dates-day${key === today ? ' is-today' : ''}`} aria-label={displayDate.format(date)} aria-current={key === today ? 'date' : undefined}>
                  <header><span>{label}</span><time dateTime={key}>{date.getUTCDate()}</time><small>{key === today ? 'Hoy' : '\u00a0'}</small></header>
                  {meals.map(({ type, label: mealLabel }) => {
                    const meal = entries[key]?.meals?.find((item) => item.meal_type === type)
                    const slot = `${key}-${type}`
                    return <div key={type} className={`meal-slot${target === slot ? ' is-target' : ''}${selectedFood && !unavailable ? ' can-assign' : ''}`}
                      role="group" tabIndex={selectedFood && !unavailable ? 0 : -1}
                      aria-label={`${mealLabel} del ${key}${selectedFood ? `: agregar ${selectedFood.name}` : ''}`}
                      onClick={() => assignFood(key, type, selectedFood)}
                      onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); assignFood(key, type, selectedFood) } }}
                      onDragOver={(event) => { if (dragging && !unavailable) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setTarget(slot) } }}
                      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setTarget(null) }}
                      onDrop={(event) => { event.preventDefault(); assignFood(key, type, dragging) }}>
                      <MealSlotFoods foods={meal?.foods || []} unavailable={unavailable} mealLabel={mealLabel} date={key} onRemove={removeFood} />
                    </div>
                  })}
                  <footer className="meal-day-total"><span>Total del día</span><strong>{entries[key] ? calories(entries[key].total_calories) : '—'}</strong></footer>
                </section>
              ))}
            </div>
          </div>
        </div>
        <div id="meal-foods-panel" hidden={!showFoods}>
          {showFoods && <FoodList creating={creating} setCreating={setCreating} creatingTag={creatingTag} setCreatingTag={setCreatingTag} selectedFood={selectedFood} onSelectFood={setSelectedFood} onDragFood={setDragging} onDragEnd={() => { setDragging(null); setTarget(null) }} />}
        </div>
      </div>
    </section>
  )
}
