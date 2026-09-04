import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './components/LoginPage'
import Dashboard from './components/Dashboard'

function WorkerForm() {
  return (
    <LoginPage
      type="worker"
      eyebrow="Acceso de personal"
      title="Bienvenido a tu jornada."
      description="Ingresa tu DNI y contraseña para acceder a tu jornada."
      fields={[
        {
          id: 'dni',
          label: 'DNI',
          type: 'text',
          inputMode: 'numeric',
          placeholder: 'Ej. 1020304050',
          autoComplete: 'username',
          pattern: '[0-9]{6,12}',
          hint: 'Entre 6 y 12 números, sin puntos ni espacios.',
        },
        {
          id: 'password',
          label: 'Contraseña',
          type: 'password',
          placeholder: 'Ingresa tu contraseña',
          autoComplete: 'current-password',
        },
      ]}
      submitLabel="Iniciar sesión"
    />
  )
}

function CollaboratorForm() {
  return (
    <LoginPage
      type="collaborator"
      eyebrow="Portal de colaboradores"
      title="Todo listo para empezar."
      description="Accede a tu espacio para consultar y gestionar tu información."
      fields={[
        {
          id: 'username',
          label: 'Usuario',
          type: 'text',
          placeholder: 'Ingresa tu usuario',
          autoComplete: 'username',
        },
        {
          id: 'password',
          label: 'Contraseña',
          type: 'password',
          placeholder: 'Ingresa tu contraseña',
          autoComplete: 'current-password',
        },
      ]}
      submitLabel="Iniciar sesión"
    />
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/worker" element={<WorkerForm />} />
      <Route path="/collaborator" element={<CollaboratorForm />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/worker" replace />} />
    </Routes>
  )
}
