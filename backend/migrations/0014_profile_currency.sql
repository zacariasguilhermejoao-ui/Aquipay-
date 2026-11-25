-- Preferências de país e moeda do utilizador.
ALTER TABLE profiles ADD COLUMN country TEXT NOT NULL DEFAULT 'AO';
ALTER TABLE profiles ADD COLUMN currency TEXT NOT NULL DEFAULT 'AOA';
