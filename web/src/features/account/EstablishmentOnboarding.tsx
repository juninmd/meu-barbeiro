import { BadgeCheck, Clock3, LoaderCircle, Send, Store, XCircle } from 'lucide-react'
import { useState } from 'react'
import { errorMessage, repository } from '../../lib/repository'
import type { User } from '../../types'

interface Props {
  user: User
  onUserChange: (user: User) => void
  onCreated: (slug: string) => void
}

export const slugify = (value: string) => value
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

export function EstablishmentOnboarding({ user, onUserChange, onCreated }: Props) {
  const status = user.establishmentRequest ?? 'NONE'
  const owns = (user.establishments?.length ?? 0) > 0
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try { await action() } catch (caught) { setError(errorMessage(caught, 'Não foi possível concluir. Tente novamente.')) } finally { setBusy(false) }
  }

  const request = (event: React.FormEvent) => {
    event.preventDefault()
    void run(async () => { onUserChange(await repository.requestEstablishment(note.trim())) })
  }

  const create = (event: React.FormEvent) => {
    event.preventDefault()
    void run(async () => {
      const created = await repository.createEstablishment({ name: name.trim(), slug, ...(address.trim() ? { address: address.trim() } : {}) })
      onCreated(created.slug)
    })
  }

  return (
    <main className="page-wrap section-page">
      <header className="page-heading">
        <p className="eyebrow">Meu negócio</p>
        <h1>Cadastre o estabelecimento onde você atende.</h1>
        <p>O administrador da plataforma libera o cadastro. Depois disso, a barbearia ganha um link próprio para os clientes agendarem.</p>
      </header>

      <ol className="journey" aria-label="Etapas do cadastro">
        <li className={status === 'NONE' || status === 'REJECTED' ? 'current' : 'complete'}><span>1</span> Solicitar liberação</li>
        <li className={status === 'PENDING' ? 'current' : status === 'APPROVED' || owns ? 'complete' : ''}><span>2</span> Análise do administrador</li>
        <li className={status === 'APPROVED' ? 'current' : owns ? 'complete' : ''}><span>3</span> Cadastrar a barbearia</li>
      </ol>

      {owns && status !== 'APPROVED' && (
        <section className="panel status-card status-ok" aria-live="polite">
          <BadgeCheck aria-hidden="true" />
          <div>
            <h2>Seu estabelecimento está ativo</h2>
            <p>{user.establishments!.map((item) => item.name).join(', ')}. Para cadastrar outra unidade, solicite uma nova liberação.</p>
          </div>
        </section>
      )}

      {status === 'PENDING' && (
        <section className="panel status-card status-wait" aria-live="polite">
          <Clock3 aria-hidden="true" />
          <div>
            <h2>Solicitação em análise</h2>
            <p>A resposta do administrador aparece nesta tela: volte aqui para acompanhar. Você informou:</p>
            <blockquote>{user.establishmentRequestNote}</blockquote>
          </div>
        </section>
      )}

      {status === 'REJECTED' && (
        <section className="panel status-card status-no" aria-live="polite">
          <XCircle aria-hidden="true" />
          <div>
            <h2>Solicitação não aprovada</h2>
            <p>Você pode corrigir as informações e enviar de novo.</p>
          </div>
        </section>
      )}

      {(status === 'NONE' || status === 'REJECTED') && (
        <form className="panel form-card" onSubmit={request}>
          <div className="section-heading compact"><h2>Pedir liberação</h2><span className="step-count">Passo 1 de 3</span></div>
          <div className="field">
            <label htmlFor="request-note">Qual é o seu estabelecimento?</label>
            <textarea id="request-note" required minLength={3} maxLength={300} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nome da barbearia, cidade e como você atua (dono ou barbeiro)" />
            <small>{note.length}/300</small>
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={busy || note.trim().length < 3}>
            {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />} Enviar solicitação
          </button>
        </form>
      )}

      {status === 'APPROVED' && (
        <form className="panel form-card" onSubmit={create}>
          <div className="section-heading compact"><h2><Store aria-hidden="true" /> Dados do estabelecimento</h2><span className="step-count">Passo 3 de 3</span></div>
          <p className="form-message">Liberação aprovada. Preencha os dados básicos — horários, serviços e equipe você ajusta depois.</p>
          <div className="field">
            <label htmlFor="shop-name">Nome da barbearia</label>
            <input id="shop-name" required minLength={3} maxLength={80} value={name} onChange={(event) => { setName(event.target.value); if (!slugTouched) setSlug(slugify(event.target.value)) }} placeholder="Barbearia do Zé" />
          </div>
          <div className="field">
            <label htmlFor="shop-slug">Endereço do seu link</label>
            <div className="slug-input"><span>/b/</span>
              <input id="shop-slug" required minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)) }} placeholder="barbearia-do-ze" />
            </div>
            <small>Seus clientes agendam em <strong>{window.location.origin}/b/{slug || 'seu-link'}</strong></small>
          </div>
          <div className="field">
            <label htmlFor="shop-address">Endereço (opcional)</label>
            <input id="shop-address" maxLength={160} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Rua, número · bairro" />
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={busy || name.trim().length < 3 || slug.length < 3}>
            {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Store aria-hidden="true" />} Cadastrar estabelecimento
          </button>
        </form>
      )}
    </main>
  )
}
