import { useRef, useState } from 'react'
import { createFood, uploadImage } from '../services/auth'
import FoodDialog from './FoodDialog'
import FoodImageSelect from './FoodImageSelect'

export default function FoodCreate({ tags, onCreated, onCancel }) {
  const [selectedTags, setSelectedTags] = useState([])
  const [saving, setSaving] = useState(false)
  const [image, setImage] = useState(null)
  const uploadedImage = useRef(null)
  const submitting = useRef(false)
  const [error, setError] = useState('')

  async function saveFood(event) {
    event.preventDefault()
    if (submitting.current) return
    const values = new FormData(event.currentTarget)
    const payload = {
      name: values.get('name').trim(),
      long_description: values.get('long_description').trim(),
      total_calories: Number(values.get('total_calories')),
    }
    if (!payload.name || !payload.long_description) {
      setError('Ingresa el nombre y la descripción de la comida.')
      return
    }
    if (selectedTags.length) payload.tag_ids = selectedTags
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      if (image) {
        if (uploadedImage.current?.file !== image) {
          const uploaded = await uploadImage(image)
          uploadedImage.current = { file: image, url: uploaded.url }
        }
        payload.photo_url = uploadedImage.current.url
      }
      await createFood(payload)
      onCreated()
    } catch (requestError) {
      setError(requestError.message)
      setSaving(false)
    } finally {
      submitting.current = false
    }
  }

  return (
    <FoodDialog title="Nueva comida" busy={saving} onClose={onCancel}>
    <div className="food-create">
      <form id="create-food-form" onSubmit={saveFood}>
        <fieldset disabled={saving} className="food-create-fields">
          <label className="dash-field">Nombre<input name="name" required autoFocus /></label>
          <label className="dash-field">Descripción<textarea name="long_description" required rows={3} /></label>
          <label className="dash-field">Calorías (kcal)<input name="total_calories" type="number" min="0" step="any" required /></label>
          <FoodImageSelect file={image} disabled={saving} onChange={(file) => { setImage(file); uploadedImage.current = null }} />
          <fieldset className="food-create-tags">
            <legend>Etiquetas (opcional)</legend>
            {tags.length ? tags.map((tag) => <label key={tag.id}><input type="checkbox" checked={selectedTags.includes(tag.id)} onChange={(event) => setSelectedTags((values) => event.target.checked ? [...values, tag.id] : values.filter((id) => id !== tag.id))} />{tag.name}</label>) : <p>No hay etiquetas disponibles.</p>}
          </fieldset>
        </fieldset>
      </form>
      {error && <p role="alert" className="inline-error">{error}</p>}
      <div className="food-create-actions">
        <button type="button" disabled={saving} onClick={onCancel}>Cancelar</button>
        <button type="submit" form="create-food-form" disabled={saving}>{saving ? 'Guardando…' : 'Crear comida'}</button>
      </div>
    </div>
    </FoodDialog>
  )
}
