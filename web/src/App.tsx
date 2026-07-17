import { useCallback, useEffect, useState } from 'react'
import { Login } from './components/Login'
import { Shell } from './components/Shell'
import { BarberDashboard } from './features/barber/BarberDashboard'
import { ClientDashboard } from './features/client/ClientDashboard'
import { errorMessage, repository } from './lib/repository'
import type { Appointment, Barber, Barbershop, Role, Service, User } from './types'

interface AppData {
  appointments: Appointment[]
  barbers: Barber[]
  barbershop: Barbershop | null
  services: Service[]
}

const emptyData: AppData = { appointments: [], barbers: [], barbershop: null, services: [] }

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [data, setData] = useState<AppData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (currentUser: User) => {
    setError(null)
    try {
      const [appointments, barbers, barbershop, services] = await Promise.all([
        repository.appointments(currentUser),
        repository.barbers(),
        repository.barbershop(),
        repository.services(),
      ])
      setData({ appointments, barbers, barbershop, services })
    } catch (caught) {
      setError(errorMessage(caught, 'Falha ao carregar os dados'))
    }
  }, [])

  const refresh = useCallback(async () => {
    if (user) await loadData(user)
  }, [loadData, user])

  useEffect(() => {
    repository.currentUser()
      .then((currentUser) => {
        setUser(currentUser)
        if (currentUser) return loadData(currentUser)
      })
      .catch(() => setError('A API está indisponível. Tente novamente em instantes.'))
      .finally(() => setLoading(false))
  }, [loadData])

  const enterMock = async (role: Role) => {
    const mockUser = repository.mockUser(role)
    setUser(mockUser)
    setLoading(true)
    await loadData(mockUser)
    setLoading(false)
  }

  const logout = async () => {
    await repository.logout()
    setUser(null)
    setData(emptyData)
  }

  if (loading) {
    return <div className="loading-screen"><span className="loader" /><p>Preparando a cadeira…</p></div>
  }

  if (!user) return <Login onMockLogin={enterMock} />

  return (
    <Shell user={user} barbershop={data.barbershop} onLogout={logout} onSwitchRole={enterMock}>
      {error && <div className="error-banner" role="alert">{error}<button onClick={() => refresh()}>Tentar novamente</button></div>}
      {user.role === 'BARBER' || user.role === 'ADMIN' ? (
        <BarberDashboard appointments={data.appointments} barbershop={data.barbershop} services={data.services} onRefresh={refresh} />
      ) : (
        <ClientDashboard appointments={data.appointments} barbers={data.barbers} barbershop={data.barbershop} services={data.services} onRefresh={refresh} />
      )}
    </Shell>
  )
}
