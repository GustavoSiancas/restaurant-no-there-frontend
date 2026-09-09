import { useState } from 'react'
import { createTag } from '../services/auth'
import FoodDialog from './FoodDialog'

export default function TagCreate({ onCreated, onCancel }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (saving || !name.trim()) return
    setSaving(true)
    setError('')
    try {
      const response = await createTag({ name: name.trim() })
      const tag = response.data || response
      if (!tag.id) throw new Error('El servidor no devolvió el ID de la etiqueta.')
      onCreated({ ...tag, name: tag.name || name.trim() })
    } catch (requestError) {
      setError(requestError.message)
      setSaving(false)
    }
  }
  return <FoodDialog title="Nueva etiqueta" busy={saving} onClose={onCancel}>
    <form onSubmit={submit}>
      <label className="dash-field">Nombre<input autoFocus required value={name} disabled={saving} onChange={(event) => setName(event.target.value)} placeholder="Ej. Vegetariano" /></label>
      {error && <p role="alert" className="inline-error">{error}</p>}
      <div className="food-create-actions"><button type="button" disabled={saving} onClick={onCancel}>Cancelar</button><button type="submit" disabled={saving || !name.trim()}>{saving ? 'Creando…' : 'Crear etiqueta'}</button></div>
    </form>
  </FoodDialog>
}
