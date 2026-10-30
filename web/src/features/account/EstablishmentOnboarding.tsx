import { BadgeCheck, Clock3, Send, Store, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, PageHeader } from '../../components/ui/Card'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { cn } from '../../lib/cn'
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

const steps = ['Solicitar liberação', 'Análise do administrador', 'Cadastrar a barbearia']

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

  // 0 = solicitar, 1 = em análise, 2 = cadastrar, 3 = concluído
  const stage = status === 'PENDING' ? 1 : status === 'APPROVED' ? 2 : owns ? 3 : 0

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
      <PageHeader eyebrow="Meu negócio" title="Cadastre o estabelecimento onde você atende.">
        O administrador da plataforma libera o cadastro. Depois disso, a barbearia ganha um link próprio para os clientes agendarem.
      </PageHeader>

      <ol className="mb-6 grid gap-3 md:grid-cols-3" aria-label="Etapas do cadastro">
        {steps.map((label, index) => {
          const done = stage > index
          const current = stage === index
          return (
            <li
              key={label}
              aria-current={current ? 'step' : undefined}
              className={cn('flex items-center gap-3 rounded-xl border bg-surface px-4 py-3.5 text-sm font-bold text-muted', current && 'border-brand text-ink ring-4 ring-brand/15', done && 'text-ok')}
            >
              <span className={cn('grid size-7 shrink-0 place-items-center rounded-full border border-line text-xs', current && 'border-brand bg-brand text-[#1c1810]', done && 'border-ok bg-ok text-white')}>{index + 1}</span>
              {label}
            </li>
          )
        })}
      </ol>

      {stage === 3 && (
        <StatusCard tone="ok" icon={<BadgeCheck />} title="Seu estabelecimento está ativo">
          {user.establishments!.map((item) => item.name).join(', ')}. Para cadastrar outra unidade, solicite uma nova liberação.
        </StatusCard>
      )}

      {status === 'PENDING' && (
        <StatusCard tone="wait" icon={<Clock3 />} title="Solicitação em análise">
          A resposta do administrador aparece nesta tela: volte aqui para acompanhar. Você informou:
          <blockquote className="mt-3 rounded-r-xl border-l-[3px] border-brand bg-[#f8f1df] px-4 py-3 text-sm text-[#4a463c]">{user.establishmentRequestNote}</blockquote>
        </StatusCard>
      )}

      {status === 'REJECTED' && (
        <StatusCard tone="no" icon={<XCircle />} title="Solicitação não aprovada">Você pode corrigir as informações e enviar de novo.</StatusCard>
      )}

      {(status === 'NONE' || status === 'REJECTED') && (
        <Card as="form" className="grid max-w-2xl gap-5" onSubmit={request}>
          <FormTitle step="Passo 1 de 3">Pedir liberação</FormTitle>
          <Field label="Qual é o seu estabelecimento?" hint={`${note.length}/300`}>
            <Textarea required minLength={3} maxLength={300} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nome da barbearia, cidade e como você atua (dono ou barbeiro)" />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" className="w-fit max-sm:w-full" loading={busy} disabled={note.trim().length < 3}><Send aria-hidden="true" /> Enviar solicitação</Button>
        </Card>
      )}

      {status === 'APPROVED' && (
        <Card as="form" className="grid max-w-2xl gap-5" onSubmit={create}>
          <FormTitle step="Passo 3 de 3" icon={<Store aria-hidden="true" />}>Dados do estabelecimento</FormTitle>
          <p className="rounded-r-xl border-l-[3px] border-brand bg-[#f8ecd2] px-4 py-3 text-sm text-[#594318]">Liberação aprovada. Preencha os dados básicos — horários, serviços e equipe você ajusta depois.</p>
          <Field label="Nome da barbearia">
            <Input required minLength={3} maxLength={80} value={name} onChange={(event) => { setName(event.target.value); if (!slugTouched) setSlug(slugify(event.target.value)) }} placeholder="Barbearia do Zé" />
          </Field>
          <Field label="Endereço do seu link" hint={<>Seus clientes agendam em <strong>{window.location.origin}/b/{slug || 'seu-link'}</strong></>}>
            <SlugInput required minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)) }} placeholder="barbearia-do-ze" />
          </Field>
          <Field label="Endereço (opcional)">
            <Input maxLength={160} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Rua, número · bairro" />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" className="w-fit max-sm:w-full" loading={busy} disabled={name.trim().length < 3 || slug.length < 3}><Store aria-hidden="true" /> Cadastrar estabelecimento</Button>
        </Card>
      )}
    </main>
  )
}

function SlugInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-stretch">
      <span className="grid place-items-center rounded-l-xl border border-r-0 border-[#d3ccba] bg-paper-deep px-3.5 font-bold text-muted">/b/</span>
      <Input {...props} className="rounded-l-none" />
    </div>
  )
}

function FormTitle({ children, step, icon }: { children: React.ReactNode; step: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <h2 className="flex items-center gap-2 font-serif text-2xl font-medium tracking-tight">{icon}{children}</h2>
      <Badge tone="warning" className="shrink-0 normal-case">{step}</Badge>
    </div>
  )
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="rounded-xl border border-[#e8b9ae] bg-[#fdf0ec] px-4 py-3 text-sm font-semibold text-[#7b2d20]">{children}</p>
}

const tones = { ok: 'bg-[#d9eee2] text-ok', wait: 'bg-[#f6e4b9] text-brand-deep', no: 'bg-[#f6dcd5] text-danger' }

function StatusCard({ tone, icon, title, children }: { tone: keyof typeof tones; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-5 flex max-w-2xl items-start gap-4" role="status" aria-live="polite">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-5', tones[tone])}>{icon}</span>
      <div className="text-muted">
        <h2 className="mb-1 font-serif text-xl font-medium text-ink">{title}</h2>
        {children}
      </div>
    </Card>
  )
}
