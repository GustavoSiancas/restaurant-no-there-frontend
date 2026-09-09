import { useEffect, useRef, useState } from 'react'
import { uploadImage } from '../services/auth'

export default function ImageUpload({ disabled, onBusyChange }) {
  const [preview, setPreview] = useState('')
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function select(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Selecciona un archivo de imagen.')
      event.target.value = ''
      return
    }
    setBusy(true)
    onBusyChange(true)
    setError('')
    setKey('')
    setUrl('')
    setPreview(URL.createObjectURL(file))
    try {
      const uploaded = await uploadImage(file)
      if (!active.current) return
      setKey(uploaded.key)
      setUrl(uploaded.url || uploaded.key)
    } catch (requestError) {
      if (active.current) setError(requestError.message)
    } finally {
      if (active.current) { setBusy(false); onBusyChange(false) }
    }
  }

  return <div className="image-upload">
    <label className="dash-field">Imagen<input type="file" accept="image/*" disabled={disabled || busy} onChange={select} /></label>
    {preview && <img src={preview} alt="Vista previa de la imagen seleccionada" />}
    {busy && <p role="status">Subiendo imagen…</p>}
    {error && <p role="alert" className="inline-error">{error}</p>}
    {key && <p role="status">Imagen subida correctamente.</p>}
    <input name="photo_url" type="hidden" value={url} />
  </div>
}
