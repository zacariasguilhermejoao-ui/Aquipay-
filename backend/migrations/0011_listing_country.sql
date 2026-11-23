-- Guardar o país de origem de cada anúncio e permitir filtrar o feed por país.
ALTER TABLE listings ADD COLUMN country TEXT NOT NULL DEFAULT 'AO';
CREATE INDEX idx_listings_country_feed ON listings(country, status, created_at DESC);
