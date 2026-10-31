import { z } from 'zod'

/** Regras espelham as da API (api/src/routes/*.ts): o servidor continua sendo a autoridade. */
export const passwordRule = z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.').max(128)

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Informe seu e-mail ou usuário.'),
  password: z.string().min(1, 'Informe sua senha.'),
})

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(80),
  email: z.string().trim().pipe(z.email('Informe um e-mail válido.')),
  password: passwordRule,
})

export const establishmentRequestSchema = z.object({
  note: z.string().trim().min(3, 'Conte qual é o seu estabelecimento.').max(300),
})

export const establishmentSchema = z.object({
  name: z.string().trim().min(3, 'O nome precisa ter ao menos 3 letras.').max(80),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use só letras minúsculas, números e hífens.').min(3, 'O link precisa ter ao menos 3 caracteres.').max(60),
  address: z.string().trim().max(160).optional(),
})

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.'),
  newPassword: passwordRule,
})
