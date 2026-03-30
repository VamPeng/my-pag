package com.vampeng.mypag.common;

import java.sql.Connection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Comparator;

import javax.sql.DataSource;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Component;

@Component
public class DbMigrationsRunner implements ApplicationRunner {

    private final DataSource dataSource;
    private final ResourcePatternResolver resourceResolver;
    private final String datasourceUrl;

    public DbMigrationsRunner(DataSource dataSource, @Value("${spring.datasource.url}") String datasourceUrl) {
        this.dataSource = dataSource;
        this.resourceResolver = new PathMatchingResourcePatternResolver();
        this.datasourceUrl = datasourceUrl;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        ensureParentDirectoryExistsForSqlite();
        Resource[] migrations = resourceResolver.getResources("classpath:db/migration/*.sql");
        Arrays.sort(migrations, Comparator.comparing(Resource::getFilename));

        try (Connection connection = dataSource.getConnection()) {
            ensureMigrationsTable(connection, migrations);
            for (Resource migration : migrations) {
                String filename = migration.getFilename();
                if (!isApplied(connection, filename)) {
                    ScriptUtils.executeSqlScript(connection, new EncodedResource(migration));
                    markApplied(connection, filename);
                }
            }
        }
    }

    private void ensureMigrationsTable(Connection connection, Resource[] migrations) throws Exception {
        connection.createStatement().execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
        );
        // Baseline: if schema_migrations is empty but the DB already has application tables,
        // mark all existing migration files as applied so they are not re-run.
        boolean migrationsEmpty = !connection.createStatement()
            .executeQuery("SELECT 1 FROM schema_migrations LIMIT 1").next();
        if (migrationsEmpty && tableExists(connection, "accounts")) {
            for (Resource migration : migrations) {
                markApplied(connection, migration.getFilename());
            }
        }
    }

    private boolean tableExists(Connection connection, String tableName) throws Exception {
        var rs = connection.createStatement().executeQuery(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='" + tableName.replace("'", "''") + "'"
        );
        return rs.next();
    }

    private boolean isApplied(Connection connection, String filename) throws Exception {
        var rs = connection.createStatement().executeQuery(
            "SELECT 1 FROM schema_migrations WHERE filename = '" + filename.replace("'", "''") + "'"
        );
        return rs.next();
    }

    private void markApplied(Connection connection, String filename) throws Exception {
        connection.createStatement().execute(
            "INSERT OR IGNORE INTO schema_migrations (filename, applied_at) VALUES ('" + filename.replace("'", "''") + "', '" + java.time.Instant.now() + "')"
        );
    }

    private void ensureParentDirectoryExistsForSqlite() throws Exception {
        if (!datasourceUrl.startsWith("jdbc:sqlite:")) {
            return;
        }
        String dbPathString = datasourceUrl.substring("jdbc:sqlite:".length());
        if (dbPathString.isBlank() || dbPathString.equals(":memory:")) {
            return;
        }

        Path dbPath = Path.of(dbPathString);
        Path parent = dbPath.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
    }
}
