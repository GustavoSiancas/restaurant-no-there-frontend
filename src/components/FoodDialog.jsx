import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function FoodDialog({ title, busy = false, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return createPortal(
    <dialog ref={ref} className="food-dialog" aria-label={title} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
      <header><h2>{title}</h2><button type="button" aria-label="Cerrar" disabled={busy} onClick={onClose}>×</button></header>
      {children}
    </dialog>, document.body,
  )
}
