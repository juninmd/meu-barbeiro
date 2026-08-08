# AMBIENTE SEM BANCO DE DADOS — leia antes de tudo

Não há Postgres disponível nesta execução, e **não** suba Docker. Isso muda como
a migração é criada, e só isso.

## Como gerar a migração sem banco

`prisma migrate dev` exige conexão e vai falhar. Use o caminho offline, que
compara o histórico de migrações com o schema e escreve o SQL:

```
cd api
pnpm exec prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url "postgresql://x:x@localhost:5432/x" \
  --script > prisma/migrations/<timestamp>_<nome>/migration.sql
```

Se o `--shadow-database-url` também exigir conexão, gere com
`--from-empty`/`--to-schema-datamodel` apenas para conferir a forma do SQL e
escreva o arquivo de migração à mão, contendo somente o **delta** desta tarefa.

Regras obrigatórias:

1. **O timestamp do diretório precisa ser maior que o da última migração
   existente.** O Prisma aplica por ordem de nome, não por ordem de criação.
   Já existe um caso neste repositório em que isso saiu errado; não repita.
2. A migração contém **apenas** o delta desta tarefa. Não regenere o schema
   inteiro nem inclua tabela que outra migração já cria.
3. Rode `pnpm exec prisma validate` e `pnpm exec prisma generate` — os dois
   funcionam sem banco e provam que o schema está coerente e que o client
   compila com os modelos novos.
4. No resumo final, diga **explicitamente** que a migração não foi aplicada em
   banco nenhum e que precisa ser validada antes de ir para produção. Não
   escreva que "a migração passou" se ela nunca rodou.

## Testes

Os testes que dependem de banco não podem ser exigidos aqui. Escreva a lógica de
forma testável **sem** banco: regra pura em `api/src/lib/`, com o acesso a dados
injetado, e teste a regra. Isso vale para cálculo de janela, valor retido,
estimativa de espera, consumo de visita e seleção de quem notificar.

Se algum teste existente precisar de banco e falhar por isso, **não o desative**:
diga no resumo qual é e por quê.

## Critério de aceite nesta execução

```
cd api && pnpm exec prisma validate
cd api && pnpm exec prisma generate
cd api && pnpm exec tsc --noEmit
cd api && pnpm test
cd web && pnpm exec tsc --noEmit
cd web && pnpm lint
cd web && pnpm test
cd web && pnpm build
```

Substitui o critério de aceite escrito na tarefa abaixo, no que diz respeito a
banco. Todo o resto da tarefa continua valendo integralmente.

---

