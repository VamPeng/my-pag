package com.vampeng.mypag.account;

import java.time.Instant;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CurrentAccountService {

    public static final String DEFAULT_ACCOUNT_ID = "default-account";
    private static final String DEFAULT_ACCOUNT_NAME = "Default Account";
    private static final String DEFAULT_ACCOUNT_STATUS = "active";

    private final JdbcTemplate jdbcTemplate;

    public CurrentAccountService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public Account ensureCurrentAccount() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM accounts WHERE id = ?",
                Integer.class,
                DEFAULT_ACCOUNT_ID
        );

        if (count == null || count == 0) {
            String now = Instant.now().toString();
            jdbcTemplate.update(
                    """
                    INSERT INTO accounts (id, name, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    DEFAULT_ACCOUNT_ID,
                    DEFAULT_ACCOUNT_NAME,
                    DEFAULT_ACCOUNT_STATUS,
                    now,
                    now
            );
        }

        return jdbcTemplate.queryForObject(
                """
                SELECT id, name, status
                FROM accounts
                WHERE id = ?
                """,
                (rs, rowNum) -> new Account(
                        rs.getString("id"),
                        rs.getString("name"),
                        rs.getString("status")
                ),
                DEFAULT_ACCOUNT_ID
        );
    }

    public record Account(
            String id,
            String name,
            String status
    ) {
    }
}
