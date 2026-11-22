-- Executar uma vez na D1 aquipay-db (já aplicado na D1; não voltar a executar).
ALTER TABLE users ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;
-- Contas Google guardam hash/salt aleatórios (nunca servem para login por palavra-passe),
-- por isso password_hash/password_salt podem continuar NOT NULL.
CREATE TABLE IF NOT EXISTS rate_limits (k TEXT PRIMARY KEY, n INTEGER NOT NULL, exp INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_rate_limits_exp ON rate_limits(exp);
