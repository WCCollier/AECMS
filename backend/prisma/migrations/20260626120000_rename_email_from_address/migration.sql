-- Rename ISM key: email.from_address → email.system_from
-- Copies the existing value to the new key; old row is left in place (harmless orphan).
-- A follow-up cleanup can DELETE the old row after confirming the live deployment is stable.
INSERT INTO site_settings (id, key, value, updated_at)
SELECT gen_random_uuid(), 'email.system_from', value, NOW()
FROM site_settings
WHERE key = 'email.from_address'
ON CONFLICT (key) DO NOTHING;
