package com.vampeng.mypag.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
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
    void corsPreflightShouldAllowFrontendDevOrigin() throws Exception {
        mockMvc.perform(options("/api/bootstrap")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
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

        // 账户被删后会触发 ensureCurrentAccount 重新插入默认 5 个目录，不能断言全表 active 为 0
        Integer remainingUserDirs = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM directories WHERE is_deleted = 0 AND id IN (?, ?)",
                Integer.class, parentId, childId);
        String itemDirectoryId = jdbcTemplate.queryForObject(
                "SELECT directory_id FROM items WHERE id = 'item-1'", String.class);
        String trashedAt = jdbcTemplate.queryForObject(
                "SELECT trashed_at FROM items WHERE id = 'item-1'", String.class);

        assertThat(remainingUserDirs).isZero();
        assertThat(itemDirectoryId).isNull();
        assertThat(trashedAt).isNull();
    }

    @Test
    void deleteDirectoryMoveToParentShouldReassignItemsToParent() throws Exception {
        String l2Id = createDirectory("二级", null);
        String l3Id = createDirectory("三级", l2Id);

        jdbcTemplate.update("""
                INSERT INTO items (
                    id, account_id, directory_id, title, notes, progress,
                    priority, expected_at, completed_at, trashed_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """, "item-l3", "default-account", l3Id, "task-l3", null, "todo", null, null, null, null);

        mockMvc.perform(delete("/api/directories/{id}", l3Id)
                        .param("mode", "move_to_parent"))
                .andExpect(status().isNoContent());

        String itemDirectoryId = jdbcTemplate.queryForObject(
                "SELECT directory_id FROM items WHERE id = 'item-l3'", String.class);
        Integer l3StillActive = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM directories WHERE id = ? AND is_deleted = 0", Integer.class, l3Id);

        assertThat(itemDirectoryId).isEqualTo(l2Id);
        assertThat(l3StillActive).isZero();
    }

    @Test
    void deleteDirectoryViaPostBodyShouldWorkLikeDeleteQuery() throws Exception {
        String l2Id = createDirectory("二级B", null);
        String l3Id = createDirectory("三级B", l2Id);

        mockMvc.perform(post("/api/directories/{id}/delete", l3Id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"move_to_parent\"}"))
                .andExpect(status().isNoContent());

        Integer l3StillActive = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM directories WHERE id = ? AND is_deleted = 0", Integer.class, l3Id);
        assertThat(l3StillActive).isZero();
    }

    @Test
    void deleteDirectoryMoveToParentWhenNoParentShouldMoveItemsToInbox() throws Exception {
        String rootId = createDirectory("根", null);

        jdbcTemplate.update("""
                INSERT INTO items (
                    id, account_id, directory_id, title, notes, progress,
                    priority, expected_at, completed_at, trashed_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """, "item-root", "default-account", rootId, "task-root", null, "todo", null, null, null, null);

        mockMvc.perform(delete("/api/directories/{id}", rootId)
                        .param("mode", "move_to_parent"))
                .andExpect(status().isNoContent());

        String itemDirectoryId = jdbcTemplate.queryForObject(
                "SELECT directory_id FROM items WHERE id = 'item-root'", String.class);
        assertThat(itemDirectoryId).isNull();
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

    @Test
    void itemsApisShouldCreateGetPatchAndMoveDirectory() throws Exception {
        String workId = createDirectory("工作", null);
        String lifeId = createDirectory("生活", null);

        String itemId = createItem("和同事确认接口字段", workId, "doing", "high", "2026-03-20T10:00:00Z");

        mockMvc.perform(get("/api/items/{id}", itemId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(itemId))
                .andExpect(jsonPath("$.title").value("和同事确认接口字段"))
                .andExpect(jsonPath("$.directoryId").value(workId))
                .andExpect(jsonPath("$.progress").value("doing"))
                .andExpect(jsonPath("$.priority").value("high"));

        mockMvc.perform(patch("/api/items/{id}", itemId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "和同事确认接口字段（已更新）",
                                  "directoryId": "%s",
                                  "progress": "todo"
                                }
                                """.formatted(lifeId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(itemId))
                .andExpect(jsonPath("$.title").value("和同事确认接口字段（已更新）"))
                .andExpect(jsonPath("$.directoryId").value(lifeId))
                .andExpect(jsonPath("$.progress").value("todo"));
    }

    @Test
    void completeItemThenPatchToDoingShouldClearCompletedAt() throws Exception {
        String itemId = createItem("整理发布清单", null, "todo", "medium", null);

        mockMvc.perform(post("/api/items/{id}/complete", itemId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.progress").value("done"))
                .andExpect(jsonPath("$.completedAt").isNotEmpty());

        mockMvc.perform(patch("/api/items/{id}", itemId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "progress": "doing"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.progress").value("doing"))
                .andExpect(jsonPath("$.completedAt").isEmpty());
    }

    @Test
    void trashAndRestoreItemShouldToggleTrashedAt() throws Exception {
        String itemId = createItem("收纳物品", null, "todo", "low", null);

        mockMvc.perform(post("/api/items/{id}/trash", itemId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trashedAt").isNotEmpty());

        mockMvc.perform(post("/api/items/{id}/restore", itemId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trashedAt").isEmpty());
    }

    @Test
    void listItemsShouldSupportBasicFiltersAndExcludeTrashedByDefault() throws Exception {
        String workId = createDirectory("工作", null);
        String lifeId = createDirectory("生活", null);

        String workItemId = createItem("确认发布窗口", workId, "doing", "high", "2026-03-20T10:00:00Z");
        String lifeItemId = createItem("采购清单", lifeId, "todo", "low", "2026-03-22T10:00:00Z");
        String trashedId = createItem("临时事项", workId, "paused", "medium", null);

        mockMvc.perform(post("/api/items/{id}/trash", trashedId))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/items").param("q", "确认"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(workItemId));

        mockMvc.perform(get("/api/items").param("progress", "todo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(lifeItemId));

        mockMvc.perform(get("/api/items").param("priority", "high"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(workItemId));

        mockMvc.perform(get("/api/items").param("directoryId", workId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(workItemId));
    }

    @Test
    void inboxViewShouldReturnOnlyUnclassifiedAndNotTrashedItems() throws Exception {
        String workId = createDirectory("工作", null);
        String inboxItemId = createItem("收件箱事项", null, "todo", "medium", Instant.now().toString());
        createItem("目录事项", workId, "todo", "medium", Instant.now().toString());
        String trashedId = createItem("回收站事项", null, "todo", "medium", Instant.now().toString());

        mockMvc.perform(post("/api/items/{id}/trash", trashedId))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/views/inbox"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(inboxItemId));
    }

    @Test
    void todayViewShouldReturnOnlyItemsExpectedToday() throws Exception {
        Instant now = Instant.now();
        String todayItemId = createItem("今天要做", null, "doing", "high", now.toString());
        createItem("明天事项", null, "todo", "medium", now.plusSeconds(24 * 3600).toString());
        createItem("昨天事项", null, "todo", "medium", now.minusSeconds(24 * 3600).toString());

        mockMvc.perform(get("/api/views/today"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(todayItemId));
    }

    @Test
    void upcomingViewShouldUseSettingsRange() throws Exception {
        mockMvc.perform(patch("/api/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "recentRangeValue": 2,
                                  "recentRangeUnit": "day"
                                }
                                """))
                .andExpect(status().isOk());

        Instant now = Instant.now();
        String inRangeId = createItem("两天内事项", null, "todo", "medium", now.plusSeconds(24 * 3600).toString());
        createItem("两天外事项", null, "todo", "medium", now.plusSeconds(4 * 24 * 3600).toString());

        mockMvc.perform(get("/api/views/upcoming"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(inRangeId));
    }

    @Test
    void overdueViewShouldExcludeDoneItems() throws Exception {
        Instant now = Instant.now();
        String overdueTodoId = createItem("逾期待处理", null, "doing", "high", now.minusSeconds(24 * 3600).toString());
        createItem("逾期但已完成", null, "done", "medium", now.minusSeconds(24 * 3600).toString());
        createItem("未来事项", null, "todo", "medium", now.plusSeconds(24 * 3600).toString());

        mockMvc.perform(get("/api/views/overdue"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(overdueTodoId));
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

    private String createItem(
            String title,
            String directoryId,
            String progress,
            String priority,
            String expectedAt
    ) throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("title", title);
        if (directoryId != null) {
            payload.put("directoryId", directoryId);
        }
        if (progress != null) {
            payload.put("progress", progress);
        }
        if (priority != null) {
            payload.put("priority", priority);
        }
        if (expectedAt != null) {
            payload.put("expectedAt", expectedAt);
        }

        MvcResult result = mockMvc.perform(post("/api/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode node = objectMapper.readTree(result.getResponse().getContentAsString());
        return node.path("id").asText();
    }
}
