# Checklist de deploy (uso oficial)

Tudo abaixo está no repositório, exceto os valores secretos, que só existem no ambiente.

1. **Secrets da API** (K3s/ArgoCD): `DATABASE_URL`, `SESSION_SECRET` (32+ caracteres), `TOKEN_ENCRYPTION_KEY`
   (`openssl rand -base64 32`), `FRONTEND_URL`, `API_PUBLIC_URL`, credenciais Mercado Pago, `NODE_ENV=production`.
2. **Administrador da plataforma:** `ADMIN_PASSWORD` (mín. 12 caracteres). `ADMIN_USERNAME` (padrão `admin`) e
   `ADMIN_EMAIL` são opcionais. Sem a senha e sem administrador no banco, a API **recusa iniciar** com mensagem clara.
   Para trocar a senha, altere o Secret e reinicie.
3. **Migrations:** a imagem executa `prisma migrate deploy` ao iniciar. Não há passo manual.
4. **Nunca** use `ENABLE_DEV_LOGIN`, o seed (`src/seed.ts`) nem `admin`/`admin` em produção: o seed se recusa a rodar com
   `NODE_ENV=production` e o login de desenvolvimento é ignorado.
5. **Verificação pós-deploy:** `GET /health` → `{"status":"ok"}`; entre com o administrador; em *Liberações* aprove uma conta
   de teste e confirme que ela consegue cadastrar o estabelecimento.
