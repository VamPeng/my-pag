package com.vampeng.mypag.setting;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class SettingsRepository {

    private final JdbcTemplate jdbcTemplate;

    public SettingsRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<SettingsRecord> findByAccountId(String accountId) {
        return jdbcTemplate.query(
                """
                SELECT account_id, recent_range_value, recent_range_unit
                FROM settings
                WHERE account_id = ?
                """,
                (rs, rowNum) -> new SettingsRecord(
                        rs.getString("account_id"),
                        rs.getInt("recent_range_value"),
                        rs.getString("recent_range_unit")
                ),
                accountId
        ).stream().findFirst();
    }

    public SettingsRecord createDefault(String accountId) {
        String now = Instant.now().toString();
        jdbcTemplate.update(
                """
                INSERT INTO settings (id, account_id, recent_range_value, recent_range_unit, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID().toString(),
                accountId,
                7,
                "day",
                now,
                now
        );
        return new SettingsRecord(accountId, 7, "day");
    }

    public SettingsRecord update(String accountId, int recentRangeValue, String recentRangeUnit) {
        jdbcTemplate.update(
                """
                UPDATE settings
                SET recent_range_value = ?,
                    recent_range_unit = ?,
                    updated_at = ?
                WHERE account_id = ?
                """,
                recentRangeValue,
                recentRangeUnit,
                Instant.now().toString(),
                accountId
        );

        return new SettingsRecord(accountId, recentRangeValue, recentRangeUnit);
    }

    public record SettingsRecord(
            String accountId,
            int recentRangeValue,
            String recentRangeUnit
    ) {
    }
}
