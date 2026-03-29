package com.vampeng.mypag.common;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;

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
            boolean schemaTableIsNew = !tableExists(connection, "schema_migrations");

            try (Statement stmt = connection.createStatement()) {
                stmt.execute("""
                        CREATE TABLE IF NOT EXISTS schema_migrations (
                            filename TEXT PRIMARY KEY,
                            applied_at TEXT NOT NULL
                        )
                        """);
            }

            if (schemaTableIsNew && tableExists(connection, "accounts")) {
                // Existing database predates migration tracking — baseline all files as already applied.
                for (Resource migration : migrations) {
                    insertMigrationRecord(connection, migration.getFilename());
                }
            }

            Set<String> applied = loadAppliedMigrations(connection);

            for (Resource migration : migrations) {
                String filename = migration.getFilename();
                if (applied.contains(filename)) {
                    continue;
                }
                ScriptUtils.executeSqlScript(connection, new EncodedResource(migration));
                insertMigrationRecord(connection, filename);
            }
        }
    }

    private boolean tableExists(Connection connection, String tableName) throws Exception {
        try (Statement stmt = connection.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='" + tableName + "'")) {
            return rs.next() && rs.getInt(1) > 0;
        }
    }

    private Set<String> loadAppliedMigrations(Connection connection) throws Exception {
        Set<String> applied = new HashSet<>();
        try (Statement stmt = connection.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT filename FROM schema_migrations")) {
            while (rs.next()) {
                applied.add(rs.getString("filename"));
            }
        }
        return applied;
    }

    private void insertMigrationRecord(Connection connection, String filename) throws Exception {
        try (Statement stmt = connection.createStatement()) {
            stmt.execute("INSERT OR IGNORE INTO schema_migrations (filename, applied_at) VALUES ('"
                    + filename + "', datetime('now'))");
        }
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
