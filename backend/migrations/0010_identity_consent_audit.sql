-- Store explicit consent for each identity verification session.
ALTER TABLE identity_verifications ADD COLUMN consent_at TEXT;
ALTER TABLE identity_verifications ADD COLUMN consent_version TEXT;
