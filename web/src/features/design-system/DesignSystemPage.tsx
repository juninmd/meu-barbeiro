import { BadgeCheck, Bell, CalendarDays, Plus, Scissors, Search, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Calendar } from '../../components/ui/Calendar'
import { Card, PageHeader } from '../../components/ui/Card'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { Tooltip } from '../../components/ui/Tooltip'
import { cn } from '../../lib/cn'

// Classes completas (não montadas por string) para o Tailwind enxergá-las no build.
const swatches: Array<{ title: string; items: Array<{ token: string; className: string }> }> = [
  { title: 'Osso — neutros quentes', items: [
    { token: 'bone-50', className: 'bg-bone-50' }, { token: 'bone-100', className: 'bg-bone-100' }, { token: 'bone-200', className: 'bg-bone-200' },
    { token: 'bone-300', className: 'bg-bone-300' }, { token: 'bone-400', className: 'bg-bone-400' }, { token: 'bone-500', className: 'bg-bone-500' },
    { token: 'bone-600', className: 'bg-bone-600' }, { token: 'bone-700', className: 'bg-bone-700' }, { token: 'bone-800', className: 'bg-bone-800' }, { token: 'bone-900', className: 'bg-bone-900' },
  ] },
  { title: 'Âmbar — marca', items: [
    { token: 'amber-50', className: 'bg-amber-50' }, { token: 'amber-100', className: 'bg-amber-100' }, { token: 'amber-200', className: 'bg-amber-200' },
    { token: 'amber-300', className: 'bg-amber-300' }, { token: 'amber-400', className: 'bg-amber-400' }, { token: 'amber-500', className: 'bg-amber-500' },
    { token: 'amber-600', className: 'bg-amber-600' }, { token: 'amber-700', className: 'bg-amber-700' }, { token: 'amber-800', className: 'bg-amber-800' },
  ] },
  { title: 'Estados', items: [
    { token: 'success-600', className: 'bg-success-600' }, { token: 'danger-600', className: 'bg-danger-600' }, { token: 'info-600', className: 'bg-info-600' },
    { token: 'success-50', className: 'bg-success-50' }, { token: 'danger-50', className: 'bg-danger-50' }, { token: 'info-50', className: 'bg-info-50' },
  ] },
]
// Rótulo branco só onde passa AA (>= 4.5:1); no resto, grafite fixo (não o token `ink`, que clareia no tema escuro).
const dark = new Set(['bone-600', 'bone-700', 'bone-800', 'bone-900', 'amber-700', 'amber-800', 'success-600', 'danger-600', 'info-600'])

function Section({ id, title, children, description }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <div>
        <h2 id={id} className="font-serif text-3xl font-medium tracking-tight">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export function DesignSystemPage() {
  const [tab, setTab] = useState('um')
  const [dialog, setDialog] = useState(false)
  const [day, setDay] = useState<Date | undefined>(new Date())

  return (
    <main className="page-wrap section-page" data-section="design-system">
      <PageHeader eyebrow="Design system" title="Navalha.">
        Fundamentos, componentes e padrões do Meu Barbeiro. Tailwind v4 com tokens em <code className="rounded bg-paper-deep px-1.5 py-0.5 text-sm">@theme</code>, Radix para acessibilidade e Fraunces + Inter na tipografia.
      </PageHeader>

      <div className="grid gap-14">
        <Section id="ds-cores" title="Cor" description="Neutros quentes para superfícies e texto, âmbar para ação e marca. A cor da marca muda por barbearia (variável --amber).">
          <div className="grid gap-5">
            {swatches.map((group) => (
              <div key={group.title}>
                <p className="mb-2 text-xs font-extrabold tracking-wider text-muted uppercase">{group.title}</p>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
                  {group.items.map((item) => (
                    <div key={item.token} className={cn('grid h-20 content-end rounded-xl border border-black/5 p-2 text-[.68rem] font-bold', item.className, dark.has(item.token) ? 'text-white' : 'text-[#15140f]')}>{item.token}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="ds-tipografia" title="Tipografia" description="Fraunces para títulos (calor e tradição de barbearia), Inter para interface e números.">
          <Card className="grid gap-4">
            <p className="font-serif text-6xl leading-none tracking-tight">Corte e barba.</p>
            <p className="font-serif text-4xl leading-tight tracking-tight">Seu melhor corte começa antes da cadeira.</p>
            <p className="font-serif text-2xl">Agenda e disponibilidade</p>
            <p className="max-w-prose leading-relaxed text-ink/80">Texto de apoio em Inter 16px, entrelinha confortável. Agendamentos sem conversa perdida, horários sob controle e uma experiência à altura do seu trabalho.</p>
            <p className="text-[.72rem] font-extrabold tracking-[.18em] text-brand-deep uppercase">Eyebrow · rótulo de seção</p>
            <p className="text-3xl font-semibold tabular-nums">R$ 1.284,50 <span className="text-sm font-medium text-muted">números tabulares</span></p>
          </Card>
        </Section>

        <Section id="ds-botoes" title="Botões" description="Quatro variantes, três tamanhos, estado de carregamento. Alvo mínimo de toque de 44px.">
          <Card className="grid gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button><Scissors aria-hidden="true" /> Agendar horário</Button>
              <Button variant="dark">Confirmar</Button>
              <Button variant="ghost">Cancelar</Button>
              <Button variant="danger"><Trash2 aria-hidden="true" /> Excluir</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Pequeno</Button>
              <Button size="md">Médio</Button>
              <Button size="lg">Grande</Button>
              <Button loading>Salvando…</Button>
              <Button disabled>Desabilitado</Button>
            </div>
          </Card>
        </Section>

        <Section id="ds-campos" title="Campos" description="Rótulo sempre visível, dica e erro ligados por aria-describedby, foco com anel âmbar.">
          <Card className="grid gap-5 md:grid-cols-2">
            <Field label="E-mail" hint="Usado para entrar e receber avisos."><Input icon={<Search />} placeholder="voce@email.com" /></Field>
            <Field label="Senha" error="A senha deve ter pelo menos 8 caracteres."><Input type="password" defaultValue="123" /></Field>
            <Field label="Observações" className="md:col-span-2"><Textarea placeholder="Preferências, alergias, recados para o barbeiro…" /></Field>
            <div className="md:col-span-2">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="max-w-sm"><TabsTrigger value="um">Entrar</TabsTrigger><TabsTrigger value="dois">Criar conta</TabsTrigger></TabsList>
                <TabsContent value="um" className="mt-3 text-sm text-muted">Conteúdo da aba "Entrar".</TabsContent>
                <TabsContent value="dois" className="mt-3 text-sm text-muted">Conteúdo da aba "Criar conta".</TabsContent>
              </Tabs>
            </div>
          </Card>
        </Section>

        <Section id="ds-feedback" title="Feedback" description="Badges de estado, avisos (sonner), diálogos (Radix Dialog), dicas (Radix Tooltip) e carregamento.">
          <Card className="grid gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">Confirmado</Badge><Badge tone="warning">Em análise</Badge><Badge tone="danger">Cancelado</Badge><Badge>Concluído</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" onClick={() => toast.success('Horário confirmado para sexta, 14h.')}><BadgeCheck aria-hidden="true" /> Aviso de sucesso</Button>
              <Button variant="ghost" onClick={() => toast.error('Este horário acabou de ser reservado.')}>Aviso de erro</Button>
              <Button variant="ghost" onClick={() => setDialog(true)}>Abrir diálogo</Button>
              <Tooltip label="Lembretes via Telegram"><Button variant="ghost" size="sm" aria-label="Lembretes"><Bell aria-hidden="true" /></Button></Tooltip>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
            </div>
          </Card>
        </Section>

        <Section id="ds-superficies" title="Superfícies" description="Cartões, estatísticas e avatares com raio generoso e sombra suave em camadas.">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="grid gap-2">
              <Avatar name="Marina Costa" size="lg" />
              <h3 className="font-serif text-2xl">Marina Costa</h3>
              <p className="text-sm text-muted">Corte + barba · sexta, 14:00</p>
              <Badge tone="success" className="w-fit">Confirmado</Badge>
            </Card>
            <article className="grid gap-0.5 rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <span className="mb-2 grid size-10 place-items-center rounded-xl bg-linear-to-br from-amber-100 to-amber-200 text-brand-deep"><Sparkles className="size-5" aria-hidden="true" /></span>
              <strong className="font-serif text-4xl leading-none font-medium tabular-nums">128</strong>
              <span className="text-[.78rem] font-bold text-muted">Cortes no mês</span>
            </article>
            <div className="grid gap-2 rounded-2xl bg-linear-to-br from-bone-900 to-bone-800 p-6 text-chrome-ink shadow-lg">
              <p className="text-[.72rem] font-extrabold tracking-[.18em] text-amber-300 uppercase">Destaque</p>
              <p className="font-serif text-2xl">Cartão fidelidade</p>
              <p className="text-sm text-muted/40">Faltam 3 visitas para o próximo prêmio.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm font-semibold sm:grid-cols-4">
            {[['shadow-xs', 'xs'], ['shadow-sm', 'sm'], ['shadow-md', 'md'], ['shadow-lg', 'lg']].map(([cls, label]) => (
              <div key={label} className={cn('grid h-20 place-items-center rounded-2xl bg-surface', cls)}>sombra {label}</div>
            ))}
          </div>
        </Section>

        <Section id="ds-calendario" title="Calendário" description="react-day-picker em pt-BR, células de 44px para toque; dias em que a barbearia não abre aparecem riscados.">
          <Card className="max-w-md">
            <p className="mb-3 flex items-center gap-2 font-serif text-lg first-letter:uppercase"><CalendarDays className="size-5 text-brand-deep" aria-hidden="true" /><span className="first-letter:uppercase">{day ? day.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Escolha um dia'}</span></p>
            <Calendar mode="single" selected={day} onSelect={setDay} modifiers={{ closed: { dayOfWeek: [0, 1] } }} modifiersClassNames={{ closed: '[&>button]:text-muted [&>button]:line-through' }} />
          </Card>
        </Section>

        <Section id="ds-acoes" title="Padrões de ação">
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-2xl">Reserve sua cadeira.</h3>
              <p className="text-muted">Três escolhas rápidas: serviço, dia e horário.</p>
            </div>
            <Button size="lg"><Plus aria-hidden="true" /> Novo agendamento</Button>
          </Card>
        </Section>
      </div>

      {dialog && (
        <ConfirmDialog
          eyebrow="Confirmar cancelamento"
          title="Cancelar este horário?"
          description="Você receberá R$ 63,75 de volta. A barbearia ficará com R$ 21,25 porque o cancelamento está dentro da janela configurada."
          cancelLabel="Manter horário"
          confirmLabel="Sim, cancelar"
          onCancel={() => setDialog(false)}
          onConfirm={() => { setDialog(false); toast.success('Horário cancelado.') }}
        />
      )}
    </main>
  )
}
