-- Ciclo de vida de assinatura e catálogo de planos.
-- O valor de enum é adicionado nesta migration e usado somente na próxima,
-- porque o PostgreSQL não permite usar um valor novo na mesma transação.
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIALING';

CREATE TYPE "SaasPlan" AS ENUM ('STARTER', 'PRO', 'SCALE');
