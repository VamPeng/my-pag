CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    directory_id TEXT,
    title TEXT NOT NULL,
    notes TEXT,
    progress TEXT NOT NULL,
    priority TEXT,
    expected_at TEXT,
    completed_at TEXT,
    trashed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (directory_id) REFERENCES directories(id)
);

CREATE INDEX IF NOT EXISTS idx_items_account_id ON items(account_id);
CREATE INDEX IF NOT EXISTS idx_items_directory_id ON items(directory_id);
CREATE INDEX IF NOT EXISTS idx_items_progress ON items(progress);
CREATE INDEX IF NOT EXISTS idx_items_expected_at ON items(expected_at);
