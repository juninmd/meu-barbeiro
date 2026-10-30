import { KeyRound, Mail, ShieldCheck, Store, UserRound } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar } from '../../components/ui/Avatar'
import { Button, buttonStyles } from '../../components/ui/Button'
import { Card, PageHeader } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'
import { errorMessage, repository } from '../../lib/repository'
import { passwordChangeSchema } from '../../lib/schemas'
import type { User } from '../../types'

const roleLabel = (user: User) => user.platformAdmin ? 'Administrador da plataforma'
  : user.role === 'CUSTOMER' ? 'Cliente' : 'Barbeiro / gestão'

export function AccountPage({ user }: { user: User }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<{ currentPassword: string; newPassword: string }>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  })

  const submit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await repository.changePassword(currentPassword, newPassword)
      reset()
      toast.success('Senha atualizada.')
    } catch (caught) {
      toast.error(errorMessage(caught, 'Não foi possível trocar a senha.'))
    }
  })

  const rows = [
    { icon: <UserRound />, label: 'Perfil', value: roleLabel(user) },
    { icon: <Mail />, label: user.email ? 'E-mail' : 'Usuário', value: user.email || user.username },
    ...(user.establishments ?? []).map((item) => ({ icon: <Store />, label: 'Estabelecimento', value: item.name })),
  ]

  return (
    <main className="page-wrap section-page">
      <PageHeader eyebrow="Minha conta" title="Seus dados e segurança.">Um único acesso para todas as suas funções na plataforma.</PageHeader>
      <div className="grid max-w-4xl items-start gap-4 md:grid-cols-2">
        <Card as="section" className="grid content-start gap-4" aria-labelledby="account-id">
          <Avatar name={user.name} size="lg" />
          <h2 id="account-id" className="font-serif text-3xl font-medium tracking-tight">{user.name}</h2>
          <dl>
            {rows.map((row) => (
              <div key={`${row.label}-${row.value}`} className="flex justify-between gap-4 border-t border-line py-3">
                <dt className="flex items-center gap-2 text-sm text-muted [&_svg]:size-4" aria-label={row.label}>{row.icon}{row.label}</dt>
                <dd className="text-right text-sm font-bold break-words">{row.value}</dd>
              </div>
            ))}
          </dl>
          {user.platformAdmin ? (
            <p className="flex items-center gap-2 rounded-r-xl border-l-[3px] border-brand bg-[#f8ecd2] px-4 py-3 text-sm text-[#594318]"><ShieldCheck className="size-4 shrink-0" aria-hidden="true" /> Você aprova quem pode cadastrar estabelecimentos.</p>
          ) : user.role === 'CUSTOMER' && (
            <Link className={buttonStyles({ variant: 'ghost' })} to="/cliente/negocio"><Store aria-hidden="true" /> Sou barbeiro: cadastrar meu estabelecimento</Link>
          )}
        </Card>

        <Card as="form" className="grid gap-5" onSubmit={submit} noValidate>
          <h2 className="flex items-center gap-2 font-serif text-2xl font-medium tracking-tight"><KeyRound className="size-5" aria-hidden="true" /> Trocar senha</h2>
          <Field label="Senha atual" error={errors.currentPassword?.message}><Input type="password" autoComplete="current-password" {...register('currentPassword')} /></Field>
          <Field label="Nova senha" hint="Mínimo de 8 caracteres." error={errors.newPassword?.message}><Input type="password" autoComplete="new-password" maxLength={128} {...register('newPassword')} /></Field>
          <Button type="submit" variant="dark" className="w-fit max-sm:w-full" loading={isSubmitting}>Atualizar senha</Button>
        </Card>
      </div>
    </main>
  )
}
