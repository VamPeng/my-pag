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
            for (Resource migration : migrations) {
                ScriptUtils.executeSqlScript(connection, new EncodedResource(migration));
            }
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
