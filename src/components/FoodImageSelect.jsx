import { useEffect, useRef, useState } from 'react'

export default function FoodImageSelect({ file, onChange, disabled }) {
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
    <label className="dash-field">Imagen<input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={disabled} onChange={select} /></label>
    {preview && <div className="food-image-selection">
      <img src={preview} alt="Vista previa de la imagen" />
      <div><p>{file?.name}</p><button type="button" disabled={disabled} onClick={() => { onChange(null); setError(''); input.current.value = '' }}>Quitar imagen</button></div>
    </div>}
    <p>La imagen se subirá al crear la comida.</p>
    {error && <p role="alert" className="inline-error">{error}</p>}
  </div>
}
