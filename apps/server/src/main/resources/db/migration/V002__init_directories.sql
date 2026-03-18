CREATE TABLE IF NOT EXISTS directories (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_directories_account_id ON directories(account_id);
CREATE INDEX IF NOT EXISTS idx_directories_parent_id ON directories(parent_id);
