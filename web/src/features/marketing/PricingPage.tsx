import { ArrowLeft, ArrowRight, BadgeCheck, Check, Scissors } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { formatCurrency } from '../../lib/format'
import { PLAN_CATALOG } from '../../lib/plans'

interface PricingPageProps {
  onStart: () => void
  onBack: () => void
}

const comparison = [
  ['Meu Barbeiro', 'R$ 49,90/mês', 'Fixo por faixa de equipe', 'Não'],
  ['Trinks', 'R$ 110/mês', 'Por profissional', 'Sim'],
  ['Booksy', 'R$ 99,90/mês', 'Por profissional adicional', 'Sim'],
  ['Genda', 'R$ 69,90/mês', 'Por faixa de equipe', 'Não'],
  ['AppBarber', 'R$ 79,90/mês', 'Por plano e equipe', 'Não'],
  ['Fresha', 'Variável', 'Por profissional + lead', 'Sim'],
]

export function PricingPage({ onStart, onBack }: PricingPageProps) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 bg-ink px-5 py-3 text-paper">
        <Link className="flex items-center gap-2 font-black tracking-widest" to="/">
          <span className="grid size-9 place-items-center rounded-full border border-white/20 text-brand-light"><Scissors aria-hidden="true" /></span>
          <span><strong className="text-brand-light">MEU</strong> BARBEIRO</span>
        </Link>
        <Button variant="ghost" size="sm" className="border-white/20 bg-transparent text-paper" onClick={onBack}>
          <ArrowLeft aria-hidden="true" /> Voltar
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12">
        <header className="mb-10 max-w-3xl">
          <p className="mb-2 text-[.72rem] font-extrabold tracking-[.16em] text-brand-deep uppercase">Preço sem surpresa</p>
          <h1 className="mb-3 font-serif text-4xl leading-none sm:text-6xl">Planos que cabem na cadeira.</h1>
          <p className="text-muted">
            14 dias grátis em qualquer plano. Depois, mensal no cartão. No anual, dois meses grátis.
            Sem taxa por agendamento e sem marketplace leiloando seu cliente.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-3">
          {PLAN_CATALOG.map((plan) => (
            <Card key={plan.id} className={`relative flex flex-col gap-3 ${plan.recommended ? 'border-brand shadow-card' : ''}`}>
              {plan.recommended && <span className="absolute -top-3 left-6 rounded-full bg-brand px-2.5 py-1 text-[.6rem] font-black tracking-[.08em] text-[#1c1810] uppercase">Mais escolhido</span>}
              <h2 className="font-serif text-2xl">{plan.name}</h2>
              <p className="min-h-[2.6em] text-sm text-muted">{plan.tagline}</p>
              <strong className="font-serif text-4xl">{formatCurrency(plan.monthlyFeeCents / 100)}<small className="font-sans text-sm font-normal text-muted">/mês</small></strong>
              <small className="-mt-2 text-xs text-muted">ou {formatCurrency(plan.annualFeeCents / 100)}/ano</small>
              <ul className="my-3 grid gap-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-ink" /> {feature}</li>
                ))}
              </ul>
              <Button className="mt-auto" block variant={plan.recommended ? 'primary' : 'dark'} onClick={onStart}>
                Começar grátis <ArrowRight aria-hidden="true" />
              </Button>
            </Card>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted">
          Todos os planos incluem 1% por serviço pago online. Sem taxa de adesão e sem fidelidade.
          O cliente agenda pelo link público sem app e sem criar senha.
        </p>

        <section className="mt-14">
          <h2 className="mb-2 font-serif text-3xl">Como nos comparamos</h2>
          <p className="mb-5 text-sm text-muted">Preços públicos de concorrentes em outubro de 2026, no menor plano pago.</p>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="text-left text-[.62rem] tracking-[.09em] text-muted uppercase">
                  <th className="p-4">Plataforma</th><th className="p-4">Preço de entrada</th><th className="p-4">Como cobra</th><th className="p-4">Marketplace</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map(([name, price, model, marketplace], index) => (
                  <tr key={name} className={`border-t border-line ${index === 0 ? 'bg-brand/10 font-bold' : ''}`}>
                    <th scope="row" className="p-4 text-left">{name}</th>
                    <td className="p-4">{price}</td>
                    <td className="p-4">{model}</td>
                    <td className="p-4">{marketplace}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            <li className="flex gap-2 text-sm"><BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-ink" /> <span><b>Sem marketplace:</b> seu cliente não é leiloado para a barbearia da esquina.</span></li>
            <li className="flex gap-2 text-sm"><BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-ink" /> <span><b>Sem taxa por barbeiro:</b> contratar mais um não aumenta a mensalidade dentro da faixa.</span></li>
            <li className="flex gap-2 text-sm"><BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-ink" /> <span><b>Mercado Pago na sua conta:</b> o sinal não passa pela plataforma.</span></li>
            <li className="flex gap-2 text-sm"><BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-ink" /> <span><b>Dados seus:</b> exportação financeira e exclusão da conta a qualquer momento.</span></li>
          </ul>
        </section>

        <section className="mt-14 grid gap-4 sm:grid-cols-2">
          <Card>
            <h3 className="mb-2 font-serif text-xl">Preciso instalar algo?</h3>
            <p className="text-sm text-muted">Não. Funciona no navegador do celular ou do computador. O cliente agenda pelo seu link, sem baixar app nem criar senha.</p>
          </Card>
          <Card>
            <h3 className="mb-2 font-serif text-xl">O que acontece quando o teste acaba?</h3>
            <p className="text-sm text-muted">A barbearia continua no ar e os dados ficam guardados. Só a edição de serviços, equipe e preços fica bloqueada até escolher um plano.</p>
          </Card>
        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-xs text-muted">
          <span>Meu Barbeiro · gestão de barbearia</span>
          <nav className="flex gap-4">
            <Link to="/termos" className="hover:text-ink">Termos de uso</Link>
            <Link to="/privacidade" className="hover:text-ink">Privacidade e LGPD</Link>
          </nav>
        </footer>
      </main>
    </div>
  )
}
