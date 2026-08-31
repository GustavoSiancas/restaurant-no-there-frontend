import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { login } from '../services/auth'
import brandLogo from '../assets/litoral-marino-logo.png'

function BrandMark() {
  return (
    <div className="brand" aria-label="Alimenta">
      <img className="brand-image" src={brandLogo} alt="" />
      <span>ALIMENTA</span>
    </div>
  )
}

function EyeIcon({ crossed }) {
  return crossed ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.8 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5.7 9 5.7a14 14 0 0 1-2.4 3M6.6 6.7A15.5 15.5 0 0 0 3 9.7s3.5 5.7 9 5.7c1 0 2-.2 2.8-.5" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-5.7 9-5.7 9 5.7 9 5.7-3.5 5.7-9 5.7S3 12 3 12Z" /><circle cx="12" cy="12" r="2.4" /></svg>
  )
}

export default function LoginPage({ type, eyebrow, title, description, fields, submitLabel }) {
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const alternative = type === 'worker'
    ? { to: '/collaborator', label: 'Soy colaborador' }
    : { to: '/worker', label: 'Soy trabajador' }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity()
      return
    }
    const form = new FormData(event.currentTarget)
    const credentials = type === 'worker'
      ? { dni: form.get('dni').trim() }
      : {
          username: form.get('username').trim(),
          password: form.get('password'),
        }

    setError('')
    setLoading(true)
    try {
      await login({ type, credentials })
      setSubmitted(true)
      navigate('/dashboard', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={`page page-${type}`}>
      <section className="story-panel" aria-label="Presentación">
        <header><BrandMark /></header>
        <div className="story-copy">
          <p className="story-index">01 / ACCESO</p>
          <h2>Cada comida,<br />bien registrada.</h2>
          <p>Control ágil de alimentación para tu equipo y tiquetes listos al instante.</p>
        </div>
        <div className="decor" aria-hidden="true">
          <span className="orb orb-one" />
          <span className="orb orb-two" />
          <span className="line line-one" />
          <span className="line line-two" />
        </div>
        <footer>REGISTRO DE ALIMENTACIÓN · 2026</footer>
      </section>

      <section className="login-panel">
        <div className="mobile-brand"><BrandMark /></div>
        <nav aria-label="Cambiar tipo de acceso">
          <span>¿Otro tipo de acceso?</span>
          <Link to={alternative.to}>{alternative.label} <span aria-hidden="true">↗</span></Link>
        </nav>

        <div className="login-content">
          <div className="intro">
            <p className="eyebrow"><span />{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>

          {submitted ? (
            <div className="success" role="status">
              <span className="success-icon">✓</span>
              <div>
                <strong>Sesión iniciada</strong>
                <p>Tu acceso fue validado correctamente por Alimenta.</p>
              </div>
              <button type="button" onClick={() => setSubmitted(false)}>Volver</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate={false}>
              {fields.map((field) => {
                const isPassword = field.type === 'password'
                const { hint, label, ...inputProps } = field
                return (
                  <div className="field" key={field.id}>
                    <label htmlFor={field.id}>{label}</label>
                    <div className="input-wrap">
                      <input
                        {...inputProps}
                        name={field.id}
                        type={isPassword && showPassword ? 'text' : field.type}
                        required
                        disabled={loading}
                      />
                      {isPassword && (
                        <button
                          className="password-toggle"
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          <EyeIcon crossed={!showPassword} />
                        </button>
                      )}
                    </div>
                    {hint && <small>{hint}</small>}
                  </div>
                )
              })}
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="submit-button" type="submit" disabled={loading}>
                <span>{loading ? 'Validando acceso…' : submitLabel}</span>
                <span aria-hidden="true">{loading ? <i className="spinner" /> : '→'}</span>
              </button>
            </form>
          )}

          <p className="help">¿Necesitas ayuda? <a href="mailto:soporte@alimenta.com">Contacta a soporte</a></p>
        </div>
        <p className="legal">Al continuar aceptas los términos de uso y la política de privacidad.</p>
      </section>
    </main>
  )
}
