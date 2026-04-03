import { Scissors, Calendar, Clock, User } from 'lucide-react'

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
      <header className="mb-12 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-amber-500 p-3 rounded-full shadow-lg shadow-amber-500/20">
            <Scissors className="w-8 h-8 text-zinc-950" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Meu Barbeiro</h1>
        <p className="text-zinc-400">Agende seu horário com os melhores profissionais.</p>
      </header>

      <main className="w-full max-w-md space-y-4">
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            Novo Agendamento
          </h2>

          <div className="space-y-4">
            <button className="w-full flex items-center justify-between p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 rounded-xl transition-all group">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-zinc-400 group-hover:text-amber-500 transition-colors" />
                <span className="font-medium">Escolher Serviço</span>
              </div>
              <span className="text-zinc-500">→</span>
            </button>

            <button className="w-full flex items-center justify-between p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 rounded-xl transition-all group">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-zinc-400 group-hover:text-amber-500 transition-colors" />
                <span className="font-medium">Escolher Barbeiro</span>
              </div>
              <span className="text-zinc-500">→</span>
            </button>
          </div>

          <button className="w-full mt-8 py-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/10 active:scale-[0.98]">
            Ver Horários Disponíveis
          </button>
        </section>
      </main>

      <footer className="mt-12 text-zinc-500 text-sm">
        © 2026 Meu Barbeiro - Gerenciador Inteligente
      </footer>
    </div>
  )
}
