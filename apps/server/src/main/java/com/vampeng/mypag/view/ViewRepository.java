package com.vampeng.mypag.view;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ViewRepository {

    private final JdbcTemplate jdbcTemplate;

    public ViewRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public int unclassifiedCount(String accountId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM items
                WHERE account_id = ?
                  AND directory_id IS NULL
                  AND trashed_at IS NULL
                  AND progress != 'done'
                """,
                Integer.class,
                accountId
        );
        return count == null ? 0 : count;
    }

    public List<ViewItemRecord> unclassified(String accountId) {
        return jdbcTemplate.query(
                """
                SELECT id, account_id, directory_id, title, notes, progress,
                       priority, expected_at, completed_at, trashed_at, created_at, updated_at
                FROM items
                WHERE account_id = ?
                  AND directory_id IS NULL
                  AND trashed_at IS NULL
                ORDER BY created_at DESC
                """,
                this::mapRow,
                accountId
        );
    }

    public List<ViewItemRecord> inbox(String accountId) {
        return jdbcTemplate.query(
                """
                SELECT id, account_id, directory_id, title, notes, progress,
                       priority, expected_at, completed_at, trashed_at, created_at, updated_at
                FROM items
                WHERE account_id = ?
                  AND trashed_at IS NULL
                  AND directory_id IS NULL
                ORDER BY created_at DESC
                """,
                this::mapRow,
                accountId
        );
    }

    public List<ViewItemRecord> today(String accountId, String dayStart, String nextDayStart) {
        return jdbcTemplate.query(
                """
                SELECT id, account_id, directory_id, title, notes, progress,
                       priority, expected_at, completed_at, trashed_at, created_at, updated_at
                FROM items
                WHERE account_id = ?
                  AND trashed_at IS NULL
                  AND expected_at IS NOT NULL
                  AND datetime(expected_at) >= datetime(?)
                  AND datetime(expected_at) < datetime(?)
                ORDER BY datetime(expected_at) ASC, created_at ASC
                """,
                this::mapRow,
                accountId,
                dayStart,
                nextDayStart
        );
    }

    public List<ViewItemRecord> upcoming(String accountId, String now, String upperBound) {
        return jdbcTemplate.query(
                """
                SELECT id, account_id, directory_id, title, notes, progress,
                       priority, expected_at, completed_at, trashed_at, created_at, updated_at
                FROM items
                WHERE account_id = ?
                  AND trashed_at IS NULL
                  AND expected_at IS NOT NULL
                  AND datetime(expected_at) >= datetime(?)
                  AND datetime(expected_at) <= datetime(?)
                ORDER BY datetime(expected_at) ASC, created_at ASC
                """,
                this::mapRow,
                accountId,
                now,
                upperBound
        );
    }

    public List<ViewItemRecord> overdue(String accountId, String now) {
        return jdbcTemplate.query(
                """
                SELECT id, account_id, directory_id, title, notes, progress,
                       priority, expected_at, completed_at, trashed_at, created_at, updated_at
                FROM items
                WHERE account_id = ?
                  AND trashed_at IS NULL
                  AND expected_at IS NOT NULL
                  AND progress != 'done'
                  AND datetime(expected_at) < datetime(?)
                ORDER BY datetime(expected_at) ASC, created_at ASC
                """,
                this::mapRow,
                accountId,
                now
        );
    }

    private ViewItemRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new ViewItemRecord(
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

    public record ViewItemRecord(
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
