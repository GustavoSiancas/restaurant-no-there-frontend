import { useState } from 'react'
import { createTag } from '../services/auth'
import FoodDialog from './FoodDialog'
import { foodColorStyle } from '../utils/foodColor'

const pastelColors = [
  { name: 'Verde salvia', color: '#D8E8DC' },
  { name: 'Menta', color: '#D5EEE7' },
  { name: 'Azul cielo', color: '#DCE9F5' },
  { name: 'Lavanda', color: '#E5DDF2' },
  { name: 'Rosa', color: '#F3DDE3' },
  { name: 'Durazno', color: '#F5DFCC' },
  { name: 'Amarillo', color: '#F4EABE' },
  { name: 'Gris', color: '#E3E7E5' },
]

export default function TagCreate({ onCreated, onCancel }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(pastelColors[0].color)
  const validColor = /^#[0-9a-f]{6}$/i.test(color)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (saving || !name.trim() || !validColor) return
    setSaving(true)
    setError('')
    try {
      const response = await createTag({ name: name.trim(), color })
      const tag = response.data || response
      if (!tag.id) throw new Error('El servidor no devolvió el ID de la etiqueta.')
      onCreated({ ...tag, name: tag.name || name.trim(), color: tag.color || color })
    } catch (requestError) {
      setError(requestError.message)
      setSaving(false)
    }
  }
  return <FoodDialog title="Nueva etiqueta" busy={saving} onClose={onCancel}>
    <form onSubmit={submit}>
      <label className="dash-field">Nombre<input autoFocus required value={name} disabled={saving} onChange={(event) => setName(event.target.value)} placeholder="Ej. Vegetariano" /></label>
      <fieldset className="tag-color-options" disabled={saving}>
        <legend>Color de la etiqueta</legend>
        <div className="tag-color-palette">{pastelColors.map((preset) => (
          <button key={preset.color} type="button" className="tag-color-swatch"
            style={{ backgroundColor: preset.color }} title={`${preset.name} (${preset.color})`}
            aria-label={preset.name} aria-pressed={color.toUpperCase() === preset.color}
            onClick={() => setColor(preset.color)}>
            {color.toUpperCase() === preset.color ? '✓' : ''}
          </button>
        ))}</div>
        <label className="dash-field">Color personalizado
          <div className="tag-custom-color">
            <input type="color" aria-label="Elegir color personalizado" value={validColor ? color : pastelColors[0].color} onChange={(event) => setColor(event.target.value.toUpperCase())} />
            <input type="text" aria-label="Código hexadecimal" value={color} required pattern="#[0-9a-fA-F]{6}" maxLength={7} placeholder="#D8E8DC" title="Escribe # seguido de 6 dígitos hexadecimales, por ejemplo #D8E8DC" onChange={(event) => setColor(event.target.value.toUpperCase())} />
          </div>
        </label>
        <span className="tag-color-preview" style={foodColorStyle(validColor ? color : pastelColors[0].color)}>{name.trim() || 'Tu etiqueta'}</span>
      </fieldset>
      {error && <p role="alert" className="inline-error">{error}</p>}
      <div className="food-create-actions"><button type="button" disabled={saving} onClick={onCancel}>Cancelar</button><button type="submit" disabled={saving || !name.trim() || !validColor}>{saving ? 'Creando…' : 'Crear etiqueta'}</button></div>
    </form>
  </FoodDialog>
}
