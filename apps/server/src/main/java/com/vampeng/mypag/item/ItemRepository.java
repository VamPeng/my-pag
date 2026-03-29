package com.vampeng.mypag.item;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ItemRepository {

    private final JdbcTemplate jdbcTemplate;

    public ItemRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public ItemRecord create(
            String accountId,
            String title,
            String notes,
            String directoryId,
            String progress,
            String priority,
            String expectedAt,
            String completedAt
    ) {
        String id = UUID.randomUUID().toString();
        String now = Instant.now().toString();

        jdbcTemplate.update(
                """
                INSERT INTO items (
                    id, account_id, directory_id, title, notes, progress,
                    priority, expected_at, completed_at, trashed_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
                """,
                id,
                accountId,
                directoryId,
                title,
                notes,
                progress,
                priority,
                expectedAt,
                completedAt,
                now,
                now
        );

        return findById(accountId, id)
                .orElseThrow(() -> new IllegalStateException("created item not found"));
    }

    public Optional<ItemRecord> findById(String accountId, String id) {
        return jdbcTemplate.query(
                """
                SELECT id, account_id, directory_id, title, notes, progress,
                       priority, expected_at, completed_at, trashed_at, created_at, updated_at
                FROM items
                WHERE account_id = ? AND id = ?
                """,
                this::mapRow,
                accountId,
                id
        ).stream().findFirst();
    }

    public List<ItemRecord> list(String accountId, ListFilter filter) {
        StringBuilder sql = new StringBuilder("""
                SELECT id, account_id, directory_id, title, notes, progress,
                       priority, expected_at, completed_at, trashed_at, created_at, updated_at
                FROM items
                WHERE account_id = ? AND trashed_at IS NULL
                """);

        List<Object> args = new ArrayList<>();
        args.add(accountId);

        if (filter.q() != null && !filter.q().isBlank()) {
            sql.append(" AND LOWER(title) LIKE LOWER(?)");
            args.add("%" + filter.q().trim() + "%");
        }
        if (filter.progress() != null) {
            sql.append(" AND progress = ?");
            args.add(filter.progress());
        }
        if (filter.priority() != null) {
            sql.append(" AND priority = ?");
            args.add(filter.priority());
        }

        // Directory filter: unclassified / subtree / no filter
        if (filter.unclassifiedOnly()) {
            sql.append(" AND directory_id IS NULL");
        } else if (filter.directoryIds() != null && !filter.directoryIds().isEmpty()) {
            String placeholders = filter.directoryIds().stream().map(id -> "?").collect(java.util.stream.Collectors.joining(","));
            sql.append(" AND directory_id IN (").append(placeholders).append(")");
            args.addAll(filter.directoryIds());
        }

        // Time filter based on view type
        if ("today".equals(filter.viewType())) {
            sql.append(" AND expected_at IS NOT NULL");
            sql.append(" AND datetime(expected_at) >= datetime(?)");
            sql.append(" AND datetime(expected_at) < datetime(?)");
            args.add(filter.rangeStart());
            args.add(filter.rangeEnd());
        } else if ("upcoming".equals(filter.viewType())) {
            sql.append(" AND expected_at IS NOT NULL");
            sql.append(" AND datetime(expected_at) >= datetime(?)");
            sql.append(" AND datetime(expected_at) <= datetime(?)");
            args.add(filter.rangeStart());
            args.add(filter.rangeEnd());
        } else if ("overdue".equals(filter.viewType())) {
            sql.append(" AND expected_at IS NOT NULL");
            sql.append(" AND progress != 'done'");
            sql.append(" AND datetime(expected_at) < datetime(?)");
            args.add(filter.rangeStart());
        }

        // Time-filtered views: sort by expected_at; others: sort by created_at
        if (filter.viewType() != null) {
            sql.append(" ORDER BY datetime(expected_at) ASC, created_at ASC");
        } else {
            sql.append(" ORDER BY created_at DESC");
        }

        return jdbcTemplate.query(sql.toString(), this::mapRow, args.toArray());
    }

    public Optional<ItemRecord> update(
            String accountId,
            String id,
            String title,
            String notes,
            String directoryId,
            String progress,
            String priority,
            String expectedAt,
            String completedAt,
            String trashedAt
    ) {
        jdbcTemplate.update(
                """
                UPDATE items
                SET title = ?,
                    notes = ?,
                    directory_id = ?,
                    progress = ?,
                    priority = ?,
                    expected_at = ?,
                    completed_at = ?,
                    trashed_at = ?,
                    updated_at = ?
                WHERE account_id = ? AND id = ?
                """,
                title,
                notes,
                directoryId,
                progress,
                priority,
                expectedAt,
                completedAt,
                trashedAt,
                Instant.now().toString(),
                accountId,
                id
        );

        return findById(accountId, id);
    }

    public int countUnclassifiedActive(String accountId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM items
                WHERE account_id = ? AND directory_id IS NULL
                  AND trashed_at IS NULL AND progress != 'done'
                """,
                Integer.class,
                accountId
        );
        return count == null ? 0 : count;
    }

    private ItemRecord mapRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new ItemRecord(
                rs.getString("id"),
                rs.getString("account_id"),
                rs.getString("directory_id"),
                rs.getString("title"),
                rs.getString("notes"),
                rs.getString("progress"),
                rs.getString("priority"),
                rs.getString("expected_at"),
                rs.getString("completed_at"),
                rs.getString("trashed_at"),
                rs.getString("created_at"),
                rs.getString("updated_at")
        );
    }

    public record ListFilter(
            String q,
            String progress,
            String priority,
            // Directory filter: exactly one of unclassifiedOnly=true OR directoryIds non-null, or neither
            List<String> directoryIds,
            boolean unclassifiedOnly,
            // Time filter
            String viewType,      // "today" | "upcoming" | "overdue" | null
            String rangeStart,    // today: day start; upcoming: now; overdue: now
            String rangeEnd       // today: next day start; upcoming: upper bound; overdue: unused
    ) {
    }

    public record ItemRecord(
            String id,
            String accountId,
            String directoryId,
            String title,
            String notes,
            String progress,
            String priority,
            String expectedAt,
            String completedAt,
            String trashedAt,
            String createdAt,
            String updatedAt
    ) {
    }
}
