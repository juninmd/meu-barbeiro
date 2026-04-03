# Meu Barbeiro - Gerenciador Inteligente ✂️

Sistema completo de agendamento para barbearias.

## 🚀 Tecnologias

- **Backend:** Node.js + Express + TypeScript + Prisma (PostgreSQL)
- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4
- **Bot:** Telegram (Telegraf)

## 📁 Estrutura

- `api/`: Backend e integração com Telegram.
- `web/`: Frontend React com Tailwind v4.

## 🛠️ Como rodar

### Requisitos
- pnpm

### Instalação
```bash
# Na raiz
pnpm install
```

### Rodando o Backend
```bash
cd api
# Configure o .env com DATABASE_URL
pnpm prisma:generate
pnpm dev
```

### Rodando o Frontend
```bash
cd web
pnpm dev
```

## 📝 Regras de Negócio
- Escolha de serviços (Cabelo, Barba, Sobrancelha...)
- Tempo médio por serviço
- Gestão de barbeiros (solo ou time)
- Agendamento via Web e Telegram
