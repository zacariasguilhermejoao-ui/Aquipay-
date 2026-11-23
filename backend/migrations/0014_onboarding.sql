-- Regista a conclusão do guia de primeira utilização. Contas existentes não voltam a receber o guia.
ALTER TABLE users ADD COLUMN onboarding_completed_at TEXT;
UPDATE users SET onboarding_completed_at=created_at WHERE onboarding_completed_at IS NULL;
