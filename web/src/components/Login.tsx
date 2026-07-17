import { ArrowRight, Scissors, ShieldCheck, UserRound } from 'lucide-react'
import { mockEnabled, repository } from '../lib/repository'
import type { Role } from '../types'

interface LoginProps {
  onMockLogin: (role: Role) => void
}

export function Login({ onMockLogin }: LoginProps) {
  return (
    <main className="login-shell">
      <section className="login-story" aria-labelledby="login-title">
        <div className="brand-mark"><Scissors aria-hidden="true" /></div>
        <p className="eyebrow">Agenda cheia. Rotina leve.</p>
        <h1 id="login-title">Seu melhor corte começa antes da cadeira.</h1>
        <p className="login-copy">
          Agendamentos sem conversa perdida, horários sob controle e uma experiência à altura do seu trabalho.
        </p>
        <div className="opening-note">
          <span>Hoje</span>
          <strong>8 horários organizados</strong>
          <small>Sem papel. Sem conflito.</small>
        </div>
      </section>

      <section className="login-card" aria-label="Acesso">
        <p className="eyebrow">Bem-vindo</p>
        <h2>Entre na sua conta</h2>
        <p>Use seu Google para acessar agendamentos e gestão.</p>
        <button className="button button-primary button-wide" onClick={() => repository.loginWithGoogle()}>
          Continuar com Google <ArrowRight aria-hidden="true" />
        </button>

        {mockEnabled && (
          <div className="mock-access">
            <div className="divider"><span>ambiente de desenvolvimento</span></div>
            <p className="mock-label"><ShieldCheck aria-hidden="true" /> Acesso mock — dados locais</p>
            <div className="mock-grid">
              <button className="role-button" onClick={() => onMockLogin('CUSTOMER')}>
                <UserRound aria-hidden="true" />
                <span><strong>Visão cliente</strong><small>Agendar e acompanhar</small></span>
              </button>
              <button className="role-button" onClick={() => onMockLogin('BARBER')}>
                <Scissors aria-hidden="true" />
                <span><strong>Visão barbeiro</strong><small>Agenda e serviços</small></span>
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
