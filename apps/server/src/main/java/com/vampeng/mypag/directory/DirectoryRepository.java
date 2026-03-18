package com.vampeng.mypag.directory;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DirectoryRepository {

    private final JdbcTemplate jdbcTemplate;

    public DirectoryRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public DirectoryRecord create(String accountId, String parentId, String name, int sortOrder) {
        String id = UUID.randomUUID().toString();
        String now = Instant.now().toString();
        jdbcTemplate.update(
                """
                INSERT INTO directories (id, account_id, parent_id, name, sort_order, is_deleted, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?)
                """,
                id,
                accountId,
                parentId,
                name,
                sortOrder,
                now,
                now
        );

        return new DirectoryRecord(id, accountId, parentId, name, sortOrder);
    }

    public Optional<DirectoryRecord> findActiveById(String accountId, String id) {
        return jdbcTemplate.query(
                """
                SELECT id, account_id, parent_id, name, sort_order
                FROM directories
                WHERE account_id = ? AND id = ? AND is_deleted = 0
                """,
                (rs, rowNum) -> new DirectoryRecord(
                        rs.getString("id"),
                        rs.getString("account_id"),
                        rs.getString("parent_id"),
                        rs.getString("name"),
                        rs.getInt("sort_order")
                ),
                accountId,
                id
        ).stream().findFirst();
    }

    public List<DirectoryRecord> findAllActiveByAccountId(String accountId) {
        return jdbcTemplate.query(
                """
                SELECT id, account_id, parent_id, name, sort_order
                FROM directories
                WHERE account_id = ? AND is_deleted = 0
                ORDER BY sort_order ASC, created_at ASC
                """,
                (rs, rowNum) -> new DirectoryRecord(
                        rs.getString("id"),
                        rs.getString("account_id"),
                        rs.getString("parent_id"),
                        rs.getString("name"),
                        rs.getInt("sort_order")
                ),
                accountId
        );
    }

    public Optional<DirectoryRecord> rename(String accountId, String id, String name) {
        jdbcTemplate.update(
                """
                UPDATE directories
                SET name = ?, updated_at = ?
                WHERE account_id = ? AND id = ? AND is_deleted = 0
                """,
                name,
                Instant.now().toString(),
                accountId,
                id
        );
        return findActiveById(accountId, id);
    }

    public List<String> findActiveSubtreeIds(String accountId, String rootId) {
        return jdbcTemplate.query(
                """
                WITH RECURSIVE subtree(id) AS (
                    SELECT id
                    FROM directories
                    WHERE account_id = ? AND id = ? AND is_deleted = 0
                    UNION ALL
                    SELECT d.id
                    FROM directories d
                    JOIN subtree s ON d.parent_id = s.id
                    WHERE d.account_id = ? AND d.is_deleted = 0
                )
                SELECT id FROM subtree
                """,
                (rs, rowNum) -> rs.getString("id"),
                accountId,
                rootId,
                accountId
        );
    }

    public void softDelete(String accountId, List<String> directoryIds) {
        if (directoryIds.isEmpty()) {
            return;
        }
        String placeholders = directoryIds.stream().map(id -> "?").collect(Collectors.joining(","));
        String sql = """
                UPDATE directories
                SET is_deleted = 1, updated_at = ?
                WHERE account_id = ? AND id IN (%s)
                """.formatted(placeholders);

        Object[] args = new Object[2 + directoryIds.size()];
        args[0] = Instant.now().toString();
        args[1] = accountId;
        for (int i = 0; i < directoryIds.size(); i++) {
            args[i + 2] = directoryIds.get(i);
        }
        jdbcTemplate.update(sql, args);
    }

    public void moveItemsToInbox(String accountId, List<String> directoryIds) {
        if (directoryIds.isEmpty()) {
            return;
        }
        String placeholders = directoryIds.stream().map(id -> "?").collect(Collectors.joining(","));
        String sql = """
                UPDATE items
                SET directory_id = NULL, updated_at = ?
                WHERE account_id = ? AND directory_id IN (%s) AND trashed_at IS NULL
                """.formatted(placeholders);

        Object[] args = new Object[2 + directoryIds.size()];
        args[0] = Instant.now().toString();
        args[1] = accountId;
        for (int i = 0; i < directoryIds.size(); i++) {
            args[i + 2] = directoryIds.get(i);
        }
        jdbcTemplate.update(sql, args);
    }

    public void trashItems(String accountId, List<String> directoryIds) {
        if (directoryIds.isEmpty()) {
            return;
        }
        String placeholders = directoryIds.stream().map(id -> "?").collect(Collectors.joining(","));
        String now = Instant.now().toString();
        String sql = """
                UPDATE items
                SET trashed_at = ?, updated_at = ?
                WHERE account_id = ? AND directory_id IN (%s) AND trashed_at IS NULL
                """.formatted(placeholders);

        Object[] args = new Object[3 + directoryIds.size()];
        args[0] = now;
        args[1] = now;
        args[2] = accountId;
        for (int i = 0; i < directoryIds.size(); i++) {
            args[i + 3] = directoryIds.get(i);
        }
        jdbcTemplate.update(sql, args);
    }

    public record DirectoryRecord(
            String id,
            String accountId,
            String parentId,
            String name,
            int sortOrder
    ) {
    }
}
