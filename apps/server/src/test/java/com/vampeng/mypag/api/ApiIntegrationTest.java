package com.vampeng.mypag.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {

    private static final Path DB_PATH = Path.of("/tmp", "my-pag-test-" + UUID.randomUUID() + ".db");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void datasourceConfig(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:sqlite:" + DB_PATH);
    }

    @AfterAll
    static void cleanup() throws Exception {
        Files.deleteIfExists(DB_PATH);
    }

    @BeforeEach
    void truncateData() {
        jdbcTemplate.execute("DELETE FROM items");
        jdbcTemplate.execute("DELETE FROM directories");
        jdbcTemplate.execute("DELETE FROM settings");
        jdbcTemplate.execute("DELETE FROM accounts");
    }

    @Test
    void settingsApisShouldReturnAndUpdateCurrentSettings() throws Exception {
        mockMvc.perform(get("/api/settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recentRangeValue").value(7))
                .andExpect(jsonPath("$.recentRangeUnit").value("day"));

        mockMvc.perform(patch("/api/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "recentRangeValue": 10,
                                  "recentRangeUnit": "day"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recentRangeValue").value(10))
                .andExpect(jsonPath("$.recentRangeUnit").value("day"));

        mockMvc.perform(get("/api/settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recentRangeValue").value(10))
                .andExpect(jsonPath("$.recentRangeUnit").value("day"));
    }

    @Test
    void directoriesApisShouldCreateRenameAndListTree() throws Exception {
        String parentId = createDirectory("工作", null);
        createDirectory("A 项目", parentId);

        mockMvc.perform(get("/api/directories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(parentId))
                .andExpect(jsonPath("$[0].name").value("工作"))
                .andExpect(jsonPath("$[0].children[0].name").value("A 项目"));

        mockMvc.perform(patch("/api/directories/{id}", parentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "工作区"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("工作区"));

        mockMvc.perform(get("/api/directories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("工作区"));
    }

    @Test
    void deleteDirectoryMoveToInboxShouldUnlinkItems() throws Exception {
        String parentId = createDirectory("工作", null);
        String childId = createDirectory("A 项目", parentId);

        jdbcTemplate.update("""
                INSERT INTO items (
                    id, account_id, directory_id, title, notes, progress,
                    priority, expected_at, completed_at, trashed_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """, "item-1", "default-account", childId, "task-1", null, "todo", null, null, null, null);

        mockMvc.perform(delete("/api/directories/{id}", parentId)
                        .param("mode", "move_to_inbox"))
                .andExpect(status().isNoContent());

        Integer activeDirectories = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM directories WHERE is_deleted = 0", Integer.class);
        String itemDirectoryId = jdbcTemplate.queryForObject(
                "SELECT directory_id FROM items WHERE id = 'item-1'", String.class);
        String trashedAt = jdbcTemplate.queryForObject(
                "SELECT trashed_at FROM items WHERE id = 'item-1'", String.class);

        assertThat(activeDirectories).isZero();
        assertThat(itemDirectoryId).isNull();
        assertThat(trashedAt).isNull();
    }

    @Test
    void deleteDirectoryWithItemsShouldTrashItems() throws Exception {
        String parentId = createDirectory("生活", null);
        String childId = createDirectory("家庭", parentId);

        jdbcTemplate.update("""
                INSERT INTO items (
                    id, account_id, directory_id, title, notes, progress,
                    priority, expected_at, completed_at, trashed_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """, "item-2", "default-account", childId, "task-2", null, "todo", null, null, null, null);

        mockMvc.perform(delete("/api/directories/{id}", parentId)
                        .param("mode", "delete_with_items"))
                .andExpect(status().isNoContent());

        String trashedAt = jdbcTemplate.queryForObject(
                "SELECT trashed_at FROM items WHERE id = 'item-2'", String.class);
        assertThat(trashedAt).isNotBlank();
    }

    @Test
    void bootstrapApiShouldReturnAccountSettingsAndDirectoryTree() throws Exception {
        String parentId = createDirectory("工作", null);
        createDirectory("B 项目", parentId);

        mockMvc.perform(get("/api/bootstrap"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.account.id").value("default-account"))
                .andExpect(jsonPath("$.settings.recentRangeValue").value(7))
                .andExpect(jsonPath("$.directories[0].name").value("工作"))
                .andExpect(jsonPath("$.directories[0].children[0].name").value("B 项目"));
    }

    private String createDirectory(String name, String parentId) throws Exception {
        String payload = parentId == null
                ? """
                {
                  "name": "%s"
                }
                """.formatted(name)
                : """
                {
                  "name": "%s",
                  "parentId": "%s"
                }
                """.formatted(name, parentId);

        MvcResult result = mockMvc.perform(post("/api/directories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode node = objectMapper.readTree(result.getResponse().getContentAsString());
        return node.path("id").asText();
    }
}
