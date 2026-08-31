import { useEffect, useState } from 'react'
import { confirmMyMealClaimPrint, getMealSchedules, getMyMealClaimPreview, getMyWorkerStatus } from '../services/auth'
import brandLogo from '../assets/litoral-marino-logo.png'

const LABELS = { DESAYUNO: 'Desayuno', TARDE: 'Comida de tarde', NOCHE: 'Comida nocturna' }
const ICONS = { DESAYUNO: '☕', TARDE: '☀', NOCHE: '☾' }
const shortTime = (value) => String(value || '').slice(0, 5)
const CONFIRM_MEAL_TYPES = { ALMUERZO: 'TARDE', LUNCH: 'TARDE', BREAKFAST: 'DESAYUNO', DINNER: 'NOCHE' }
const confirmationMealType = (preview) => CONFIRM_MEAL_TYPES[preview.service?.name] || CONFIRM_MEAL_TYPES[preview.service?.type] || preview.service?.name

async function printThermalTicket(ticket) {
  const frame = document.createElement('iframe')
  frame.setAttribute('title', 'Impresión de ticket')
  Object.assign(frame.style, { position: 'fixed', width: '0', height: '0', border: '0', right: '0', bottom: '0' })
  document.body.appendChild(frame)
  const printDocument = frame.contentDocument
  printDocument.open()
  printDocument.write(`<!doctype html><html><head><title>Ticket Alimenta</title><style>@page{size:80mm auto;margin:0}*{box-sizing:border-box}body{width:80mm;margin:0;padding:7mm 6mm;color:#000;background:#fff;font-family:Arial,sans-serif}.brand{text-align:center;border-bottom:2px solid #000;padding-bottom:4mm}.brand b{display:block;font-size:18pt;letter-spacing:2px}.brand span{font-size:8pt;text-transform:uppercase}.service{text-align:center;padding:5mm 0;border-bottom:1px dashed #000;font-size:14pt;font-weight:800}.authorized{text-align:center;margin-top:2mm;font-size:8pt;font-weight:700}.rows{display:grid;gap:4mm;padding:5mm 0;border-bottom:1px dashed #000}.row small{display:block;font-size:7pt;color:#333;text-transform:uppercase}.row strong{display:block;margin-top:1mm;font-size:10pt;overflow-wrap:anywhere}.ticket{text-align:center;padding:5mm 0}.ticket small{font-size:7pt}.ticket strong{display:block;margin-top:2mm;font-size:8pt;overflow-wrap:anywhere}.redemption{margin-top:3mm;font:6.5pt monospace;overflow-wrap:anywhere}.footer{border-top:2px solid #000;padding-top:4mm;text-align:center;font-size:8pt;font-weight:700}.legal{margin-top:2mm;text-align:center;font-size:7pt}@media print{html,body{width:80mm}}</style></head><body><div class="brand"><b>ALIMENTA</b><span>Servicio de alimentación</span></div><div class="service" id="service"></div><div class="authorized">TICKET AUTORIZADO</div><div class="rows"><div class="row"><small>Trabajador</small><strong id="worker"></strong></div><div class="row"><small>Documento</small><strong id="document"></strong></div><div class="row"><small>Fecha y hora</small><strong id="datetime"></strong></div></div><div class="ticket"><small>NÚMERO DE TICKET</small><strong id="number"></strong><div class="redemption" id="redemption"></div></div><div class="footer">Presenta este ticket al recibir tu comida</div><div class="legal">Válido únicamente para la fecha y servicio indicados.</div></body></html>`)
  printDocument.close()
  printDocument.title = 'Ticket Litoral Marino'
  printDocument.querySelector('.brand b').textContent = 'LITORAL MARINO'
  const logo = printDocument.createElement('img')
  logo.src = brandLogo
  Object.assign(logo.style, { display: 'block', width: '25mm', height: '16mm', margin: '0 auto 2mm', objectFit: 'cover' })
  printDocument.querySelector('.brand').prepend(logo)
  await logo.decode().catch(() => {})
  const fill = (id, value) => { printDocument.getElementById(id).textContent = value || '-' }
  fill('service', ticket.service?.name); fill('worker', ticket.worker?.fullName); fill('document', ticket.worker?.documentNumber); fill('datetime', `${ticket.date} · ${ticket.time}`); fill('number', ticket.ticketNumber); fill('redemption', ticket.redemptionId)
  frame.contentWindow.focus()
  frame.contentWindow.print()
  setTimeout(() => frame.remove(), 1000)
}

function TicketDialog({ preview, onClose }) {
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(Boolean(preview._completed))
  const authorized = preview.status === 'AUTHORIZED'

  async function printTicket() {
    setPrinting(true); setError('')
    try {
      printThermalTicket(preview)
      await confirmMyMealClaimPrint(confirmationMealType(preview))
      setCompleted(true)
    } catch (requestError) { setError(requestError.message); setPrinting(false) }
  }

  return <div className="ticket-dialog-backdrop"><section className="ticket-dialog" role="dialog" aria-modal="true"><button className="ticket-close" onClick={() => onClose(completed)}>×</button>{completed ? <><div className="ticket-status authorized">✓</div><p className="section-kicker">Impresión completada</p><h2>Ticket enviado a la impresora</h2><p className="print-question">El reclamo quedó registrado correctamente.</p><button className="close-denied" onClick={() => onClose(true)}>Listo</button></> : authorized ? <><div className="ticket-status authorized">✓</div><p className="section-kicker">Comida autorizada</p><h2>¿Deseas imprimir el ticket?</h2><p className="print-question">{preview.service?.name} · {preview.date} · {preview.time}</p>{error && <p className="inline-error">{error}</p>}<div className="ticket-question-actions"><button onClick={() => onClose(false)}>No, cancelar</button><button className="print-ticket-action" disabled={printing} onClick={printTicket}>{printing ? 'Enviando a imprimir…' : 'Sí, imprimir ticket'}</button></div></> : <><div className="ticket-status denied">!</div><p className="section-kicker">Solicitud rechazada</p><h2>No puedes generar un ticket</h2><p className="denied-reason">{preview.reason || 'No existe una comida disponible para reclamar.'}</p><div className="denied-details"><span>{preview.worker?.fullName}</span><strong>{preview.date} · {preview.time}</strong></div><button className="close-denied" onClick={() => onClose(false)}>Entendido</button></>}</section></div>
}

export default function WorkerMealOverview() {
  const [status, setStatus] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [request, setRequest] = useState({ loading: true, error: '' })
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    Promise.all([getMyWorkerStatus(), getMealSchedules()]).then(([workerStatus, mealSchedules]) => {
      setStatus(workerStatus)
      setSchedules(Array.isArray(mealSchedules) ? mealSchedules : mealSchedules?.items || mealSchedules?.data || [])
      setRequest({ loading: false, error: '' })
    }).catch((error) => setRequest({ loading: false, error: error.message }))
  }, [])

  if (request.loading) return <div className="worker-overview-loading"><span className="large-spinner" /><p>Consultando tu alimentación de hoy…</p></div>
  if (request.error) return <p className="inline-error">{request.error}</p>

  const meal = status?.current_meal
  const canClaim = Boolean(status?.on_shift && status?.meal_window_open && meal?.eligible && meal?.can_claim && !meal?.already_claimed)
  let stateTitle = 'No tienes una comida disponible ahora'
  let stateText = status?.on_shift ? 'Consulta los horarios disponibles y vuelve durante tu próxima ventana.' : 'No tienes un turno activo para este momento.'
  if (meal?.already_claimed) { stateTitle = 'Tu comida ya fue reclamada'; stateText = 'El registro de esta ventana de alimentación ya fue completado.' }
  if (canClaim) { stateTitle = `${LABELS[meal.meal_type] || meal.meal_type} disponible`; stateText = `Puedes reclamarla entre las ${meal.window_start} y las ${meal.window_end}.` }
  async function requestTicket() {
    setPreviewLoading(true); setPreviewError('')
    try {
      const ticketPreview = await getMyMealClaimPreview()
      if (ticketPreview.status !== 'AUTHORIZED') { setPreview(ticketPreview); return }
      await printThermalTicket(ticketPreview)
      await confirmMyMealClaimPrint(confirmationMealType(ticketPreview))
      setPreview({ ...ticketPreview, _completed: true })
    }
    catch (error) { setPreviewError(error.message) }
    finally { setPreviewLoading(false) }
  }

  return <div className="worker-meal-overview">
    <section className={`claim-card ${canClaim ? 'can-claim' : ''}`}><div className="claim-icon">{canClaim ? '✓' : '—'}</div><div><p className="section-kicker">Estado de alimentación</p><h2>{stateTitle}</h2><p>{stateText}</p>{status?.current_shift && <span className="current-shift">Turno actual: {status.current_shift.shift_type}</span>}{previewError && <p className="claim-error">{previewError}</p>}</div>{canClaim && <button type="button" disabled={previewLoading} onClick={requestTicket}>{previewLoading ? 'Consultando…' : 'Imprimir ticket'} <span>→</span></button>}</section>
    <section className="meal-schedules"><div className="section-heading"><div><p className="section-kicker">Información diaria</p><h2>Horarios de comidas</h2><p>Recuerda realizar el registro dentro de la ventana correspondiente.</p></div><span className="timezone-label">Hora de Perú · America/Lima</span></div><div className="schedule-grid">{schedules.filter((schedule) => schedule.active).map((schedule) => <article key={schedule.meal_type}><span className="meal-icon">{ICONS[schedule.meal_type] || '●'}</span><div><small>{LABELS[schedule.meal_type] || schedule.meal_type}</small><strong>{shortTime(schedule.claim_start)} – {shortTime(schedule.claim_end)}</strong><p>{schedule.description}</p></div></article>)}</div></section>
    {preview && <TicketDialog preview={preview} onClose={(printed) => { setPreview(null); if (printed) setStatus((current) => ({ ...current, current_meal: { ...current.current_meal, can_claim: false, already_claimed: true } })) }} />}
  </div>
}
