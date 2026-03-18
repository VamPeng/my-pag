CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    recent_range_value INTEGER NOT NULL DEFAULT 7,
    recent_range_unit TEXT NOT NULL DEFAULT 'day',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_account_id ON settings(account_id);
