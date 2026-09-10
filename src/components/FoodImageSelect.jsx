import { useEffect, useRef, useState } from 'react'

export default function FoodImageSelect({ file, onChange, disabled, itemLabel = 'comida' }) {
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const input = useRef(null)
  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function select(event) {
    const next = event.target.files?.[0]
    event.target.value = ''
    if (!next) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(next.type)) {
      setError('Selecciona una imagen JPEG, PNG, WebP o GIF.')
      return
    }
    setError('')
    onChange(next)
  }

  return <div className="image-upload food-image-select">
    <div className="image-picker-heading"><span>{itemLabel === 'trabajador' ? 'Foto del trabajador' : 'Imagen de la comida'}</span><small>Opcional</small></div>
    <input hidden ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={disabled} onChange={select} aria-label="Seleccionar imagen" />
    <button type="button" className={`image-picker-zone ${preview ? 'has-preview' : ''}`} disabled={disabled} onClick={() => input.current.click()}>
      {preview ? <img src={preview} alt="Vista previa de la imagen seleccionada" /> : <span className="image-picker-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m3 17 5-5 4 4 3-3 6 6" /></svg></span>}
      <span className="image-picker-copy"><strong>{preview ? 'Cambiar imagen' : 'Seleccionar imagen'}</strong><span>{preview ? file?.name : 'Elige una foto desde tu dispositivo'}</span><small>{preview ? 'Haz clic para elegir otra foto' : 'JPG, PNG, WebP o GIF'}</small></span>
      <span className="image-picker-plus" aria-hidden="true">{preview ? '↻' : '+'}</span>
    </button>
    {preview && <div className="image-picker-footer"><span>Imagen seleccionada</span><button type="button" disabled={disabled} onClick={() => { onChange(null); setError(''); input.current.value = '' }}>Quitar imagen</button></div>}
    {error && <p role="alert" className="inline-error">{error}</p>}
  </div>
}
