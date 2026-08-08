import { useCallback, useEffect, useState } from 'react'
import { Login } from './components/Login'
import { Shell } from './components/Shell'
import { BarberDashboard } from './features/barber/BarberDashboard'
import { ClientDashboard } from './features/client/ClientDashboard'
import { errorMessage, repository } from './lib/repository'
import type { Appointment, Barber, Barbershop, Product, Role, Service, User } from './types'

interface AppData {
  appointments: Appointment[]
  barbers: Barber[]
  barbershop: Barbershop | null
  products: Product[]
  services: Service[]
}

const emptyData: AppData = { appointments: [], barbers: [], barbershop: null, products: [], services: [] }

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [data, setData] = useState<AppData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (currentUser: User) => {
    setError(null)
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
        <BarberDashboard appointments={data.appointments} barbers={data.barbers} barbershop={data.barbershop} currentUser={user} products={data.products} services={data.services} onRefresh={refresh} />
      ) : (
        <ClientDashboard appointments={data.appointments} barbers={data.barbers} barbershop={data.barbershop} currentUser={user} services={data.services} onRefresh={refresh} />
      )}
    </Shell>
  )
}
