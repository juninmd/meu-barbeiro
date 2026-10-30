import { useCallback, useEffect, useState } from 'react'
import { MotionConfig, motion } from 'motion/react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Login } from './components/Login'
import { Shell } from './components/Shell'
import { AccountPage } from './features/account/AccountPage'
import { EstablishmentOnboarding } from './features/account/EstablishmentOnboarding'
import { AdminDashboard } from './features/admin/AdminDashboard'
import { DesignSystemPage } from './features/design-system/DesignSystemPage'
import { BarberDashboard } from './features/barber/BarberDashboard'
import { ClientDashboard } from './features/client/ClientDashboard'
import { errorMessage, mockEnabled, repository, tenantSlug } from './lib/repository'
import type { Appointment, Barber, Barbershop, Product, Service, User } from './types'

interface AppData {
  appointments: Appointment[]
  barbers: Barber[]
  barbershop: Barbershop | null
  products: Product[]
  services: Service[]
}

const emptyData: AppData = { appointments: [], barbers: [], barbershop: null, products: [], services: [] }

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<User | null>(null)
  const [data, setData] = useState<AppData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (currentUser: User) => {
    setError(null)
    if (currentUser.platformAdmin) {
      setData(emptyData)
      return
    }
    try {
      const [appointments, barbers, barbershop, products, services] = await Promise.all([
        repository.appointments(currentUser),
        repository.barbers(),
        repository.barbershop(),
        currentUser.role === 'CUSTOMER' ? Promise.resolve([]) : repository.products(),
        repository.services(),
      ])
      setData({ appointments, barbers, barbershop, products, services })
    } catch (caught) {
      setError(errorMessage(caught, 'Falha ao carregar os dados'))
    }
  }, [])

  const refresh = useCallback(async () => {
    if (user) await loadData(user)
  }, [loadData, user])

  // Quem atua em um estabelecimento é levado ao link dele; o servidor só libera o painel no tenant correto.
  const redirectToOwnEstablishment = useCallback((currentUser: User) => {
    const own = currentUser.establishments ?? []
    if (mockEnabled || currentUser.platformAdmin || currentUser.role === 'CUSTOMER' || own.length === 0) return false
    if (own.some((item) => item.slug === tenantSlug)) return false
    window.location.replace(`/b/${own[0]!.slug}/barbeiro/hoje`)
    return true
  }, [])

  const enter = useCallback(async (currentUser: User) => {
    setUser(currentUser)
    if (redirectToOwnEstablishment(currentUser)) return
    setLoading(true)
    await loadData(currentUser)
    setLoading(false)
  }, [loadData, redirectToOwnEstablishment])

  useEffect(() => {
    repository.currentUser()
      .then(async (currentUser) => {
        setUser(currentUser)
        if (currentUser && !redirectToOwnEstablishment(currentUser)) await loadData(currentUser)
      })
      .catch(() => setError('A API está indisponível. Tente novamente em instantes.'))
      .finally(() => setLoading(false))
  }, [loadData, redirectToOwnEstablishment])

  const logout = async () => {
    await repository.logout()
    setUser(null)
    setData(emptyData)
    navigate('/', { replace: true })
  }

  const establishmentCreated = async (slug: string) => {
    if (!mockEnabled) {
      window.location.assign(`/b/${slug}/barbeiro/hoje`)
      return
    }
    const updated = await repository.currentUser()
    if (updated) await enter(updated)
    navigate('/barbeiro/hoje', { replace: true })
  }

  if (loading) {
    return <div className="loading-screen" role="status"><span className="loader" /><p>Preparando a cadeira…</p></div>
  }

  if (!user) return <Login onAuthenticated={(authenticated) => void enter(authenticated)} />

  const isAdmin = Boolean(user.platformAdmin)
  const isBarber = !isAdmin && (user.role === 'BARBER' || user.role === 'ADMIN')
  const hasUpcomingAppointment = data.appointments.some((appointment) => (
    appointment.status !== 'CANCELLED'
    && appointment.status !== 'DONE'
    && new Date(appointment.scheduledAt) >= new Date()
  ))
  const defaultPath = isAdmin
    ? '/admin/visao'
    : isBarber
      ? '/barbeiro/hoje'
      : hasUpcomingAppointment ? '/cliente/horarios' : '/cliente/agendar'

  return (
    <Shell user={user} barbershop={data.barbershop} onLogout={logout}>
      {error && <div className="error-banner" role="alert">{error}<button onClick={() => refresh()}>Tentar novamente</button></div>}
      {/* Só opacidade: um transform aqui viraria bloco de contenção e deslocaria elementos position:fixed (barra de ação mobile). A chave é só a área (cliente/barbeiro/admin): trocar de seção não remonta nem perde o estado da tela. */}
      <MotionConfig reducedMotion="user">
      <motion.div data-testid="route-transition" key={location.pathname.split('/')[1] ?? ''} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
      <Routes>
        <Route path="/conta" element={<AccountPage user={user} />} />
        {(mockEnabled || isAdmin) && <Route path="/design-system" element={<DesignSystemPage />} />}
        {isAdmin ? (
          <Route path="/admin/:section" element={<AdminDashboard />} />
        ) : isBarber ? (
          <Route path="/barbeiro/:section" element={<BarberDashboard appointments={data.appointments} barbers={data.barbers} barbershop={data.barbershop} currentUser={user} products={data.products} services={data.services} onRefresh={refresh} />} />
        ) : (
          <>
            <Route path="/cliente/negocio" element={<EstablishmentOnboarding user={user} onUserChange={setUser} onCreated={(slug) => void establishmentCreated(slug)} />} />
            <Route path="/cliente/:section" element={<ClientDashboard appointments={data.appointments} barbers={data.barbers} barbershop={data.barbershop} currentUser={user} services={data.services} onRefresh={refresh} />} />
          </>
        )}
        <Route path="*" element={<Navigate replace to={defaultPath} />} />
      </Routes>
      </motion.div>
      </MotionConfig>
    </Shell>
  )
}
