import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getFoods } from '../services/auth'
import FoodCreate from './FoodCreate'
import TagCreate from './TagCreate'
import { foodColorStyle } from '../utils/foodColor'

export default function FoodList({ selectedFood, onSelectFood, onDragFood, onDragEnd, creating, setCreating, creatingTag, setCreatingTag }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState({ page: 1, name: '' })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [knownTags, setKnownTags] = useState([])
  const [notice, setNotice] = useState('')
  const resultsRef = useRef(null)
  const [resultsHeight, setResultsHeight] = useState(0)

  useLayoutEffect(() => {
    if (!loading && !error && resultsRef.current) {
      const height = resultsRef.current.getBoundingClientRect().height
      setResultsHeight((previous) => Math.max(previous, height))
    }
  }, [result, loading, error])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getFoods({ ...query, page_size: 4 }).then((data) => {
      if (!active) return
      if (data.total_pages > 0 && query.page > data.total_pages) {
        setQuery((value) => ({ ...value, page: data.total_pages }))
        return
      }
      setResult(data)
      setKnownTags((previous) => [...new Map([...previous, ...(data.data || []).flatMap((food) => food.tags || [])].map((tag) => [tag.id, tag])).values()])
    }).catch((requestError) => {
      if (active) setError(requestError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [query, retry])

  const totalPages = Math.max(1, result?.total_pages || 1)
  const currentPage = result?.page || query.page
  const pages = [...new Set([1, ...Array.from({ length: 5 }, (_, i) => currentPage - 2 + i), totalPages])]
    .filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b)
  const goToPage = (page) => setQuery((value) => ({ ...value, page }))

  return (
    <aside className="food-list" aria-labelledby="food-list-title">
      <div className="food-list-heading"><h3 id="food-list-title">Comidas</h3>{!loading && !error && <span>{result?.total || 0} en total</span>}</div>
      {creatingTag && <TagCreate onCancel={() => setCreatingTag(false)} onCreated={(tag) => {
        setKnownTags((values) => [...values.filter((value) => value.id !== tag.id), tag])
        setCreatingTag(false)
        setNotice('Etiqueta creada correctamente.')
      }} />}
      {notice && <p role="status">{notice}</p>}
      {creating && <FoodCreate tags={knownTags} onCancel={() => setCreating(false)} onCreated={() => {
        setCreating(false)
        setNotice('Comida creada correctamente.')
        setSearch('')
        setQuery({ page: 1, name: '' })
      }} />}
      <form className="food-list-search" onSubmit={(event) => { event.preventDefault(); setQuery({ page: 1, name: search.trim() }) }}>
        <label htmlFor="food-search">Buscar por nombre</label>
        <div><input id="food-search" type="search" placeholder="Ej. arroz" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="submit">Buscar</button></div>
      </form>
      <div className="food-list-results" ref={resultsRef} style={{ minHeight: resultsHeight || undefined }} aria-busy={loading}>
        {loading ? <p role="status">Cargando comidas…</p> : error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div> : result?.data?.length ? (
          <ul className="food-list-cards">
            {result.data.map((food) => (
              <li key={food.id} className={`food-card${selectedFood?.id === food.id ? ' is-selected' : ''}`}
                draggable={!!onDragFood}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'copy'
                  event.dataTransfer.setData('text/plain', food.id)
                  onDragFood?.(food)
                }}
                onDragEnd={onDragEnd}>
                {food.photo_url && <img src={food.photo_url} alt={food.name} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
                <div className="food-card-info">
                  <h4>{food.name}</h4>
                  {food.total_calories != null && <strong className="food-card-calories">{Number(food.total_calories).toLocaleString('es-PE')} kcal</strong>}
                  {!!food.tags?.length && <ul className="food-card-tags" aria-label="Etiquetas">{food.tags.map((tag) => <li key={tag.id} style={foodColorStyle(tag.color)}>{tag.name}</li>)}</ul>}
                  {onSelectFood && <button type="button" className="food-select" aria-pressed={selectedFood?.id === food.id} onClick={() => onSelectFood(selectedFood?.id === food.id ? null : food)}>{selectedFood?.id === food.id ? 'Seleccionada' : 'Seleccionar'}</button>}
                </div>
              </li>
            ))}
          </ul>
        ) : <p role="status">{query.name ? 'No se encontraron comidas con ese nombre.' : 'No hay comidas disponibles.'}</p>}
      </div>
      {!loading && !error && result?.data?.length > 0 && <nav className="food-list-pagination" aria-label="Páginas de comidas">
        <button type="button" aria-label="Página anterior" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>←</button>
        {pages.map((page, index) => <span key={page}>{index > 0 && page - pages[index - 1] > 1 && <span className="food-page-gap">…</span>}<button type="button" aria-label={`Página ${page}`} aria-current={page === currentPage ? 'page' : undefined} onClick={() => goToPage(page)} disabled={page === currentPage}>{page}</button></span>)}
        <button type="button" aria-label="Página siguiente" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}>→</button>
      </nav>}
    </aside>
  )
}
