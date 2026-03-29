package com.vampeng.mypag.item;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.vampeng.mypag.account.CurrentAccountService;
import com.vampeng.mypag.directory.DirectoryRepository;
import com.vampeng.mypag.setting.SettingsService;

@Service
public class ItemService {

    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Shanghai");
    private static final Set<String> ALLOWED_PROGRESS = Set.of("todo", "doing", "done", "paused");
    private static final Set<String> ALLOWED_PRIORITY = Set.of("low", "medium", "high");
    private static final Set<String> ALLOWED_VIEWS = Set.of("today", "upcoming", "overdue");

    private final CurrentAccountService currentAccountService;
    private final DirectoryRepository directoryRepository;
    private final ItemRepository itemRepository;
    private final SettingsService settingsService;

    public ItemService(
            CurrentAccountService currentAccountService,
            DirectoryRepository directoryRepository,
            ItemRepository itemRepository,
            SettingsService settingsService
    ) {
        this.currentAccountService = currentAccountService;
        this.directoryRepository = directoryRepository;
        this.itemRepository = itemRepository;
        this.settingsService = settingsService;
    }

    @Transactional
    public ItemResponse create(CreateItemRequest request) {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        String title = normalizeTitle(request.title());
        String notes = normalizeText(request.notes());
        String directoryId = normalizeDirectoryId(accountId, request.directoryId());
        String progress = normalizeProgress(request.progress(), "todo");
        String priority = normalizePriority(request.priority());
        String expectedAt = normalizeExpectedAt(request.expectedAt());
        String completedAt = progress.equals("done") ? Instant.now().toString() : null;

        return toResponse(itemRepository.create(
                accountId,
                title,
                notes,
                directoryId,
                progress,
                priority,
                expectedAt,
                completedAt
        ));
    }

    @Transactional(readOnly = true)
    public ItemResponse getById(String itemId) {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        return itemRepository.findById(accountId, itemId)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "item not found"));
    }

    @Transactional(readOnly = true)
    public List<ItemResponse> list(ListItemsQuery query) {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        String progress = query.progress() == null ? null : normalizeProgress(query.progress(), null);
        String priority = query.priority() == null ? null : normalizePriority(query.priority());

        // Directory filter: "unclassified" is a magic value meaning directory_id IS NULL
        boolean unclassifiedOnly = "unclassified".equals(query.directoryId());
        List<String> directoryIds = null;
        if (!unclassifiedOnly && query.directoryId() != null && !query.directoryId().isBlank()) {
            String dirId = query.directoryId().trim();
            if (directoryRepository.findActiveById(accountId, dirId).isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "directory not found");
            }
            directoryIds = directoryRepository.findActiveSubtreeIds(accountId, dirId);
        }

        // Time filter: compute range based on view type
        String viewType = null;
        String rangeStart = null;
        String rangeEnd = null;
        if (query.view() != null && ALLOWED_VIEWS.contains(query.view())) {
            viewType = query.view();
            if ("today".equals(viewType)) {
                LocalDate today = LocalDate.now(APP_ZONE);
                rangeStart = today.atStartOfDay(APP_ZONE).toInstant().toString();
                rangeEnd = today.plusDays(1).atStartOfDay(APP_ZONE).toInstant().toString();
            } else if ("upcoming".equals(viewType)) {
                SettingsService.SettingsResponse settings = settingsService.getCurrentSettings();
                // 从「今天 0 点」起算近期窗口，包含今日整日；上界为起算点 + 设置的天/周时长
                LocalDate today = LocalDate.now(APP_ZONE);
                Instant windowStart = today.atStartOfDay(APP_ZONE).toInstant();
                rangeStart = windowStart.toString();
                rangeEnd = windowStart.plusSeconds(toSeconds(settings.recentRangeValue(), settings.recentRangeUnit())).toString();
            } else if ("overdue".equals(viewType)) {
                // 早于「今天」0 点的计划日才算逾期，与 today（今日整日窗口）互斥
                LocalDate today = LocalDate.now(APP_ZONE);
                rangeStart = today.atStartOfDay(APP_ZONE).toInstant().toString();
            }
        }

        return itemRepository.list(accountId, new ItemRepository.ListFilter(
                query.q(),
                progress,
                priority,
                directoryIds,
                unclassifiedOnly,
                viewType,
                rangeStart,
                rangeEnd
        )).stream().map(this::toResponse).toList();
    }

    private long toSeconds(int value, String unit) {
        return switch (unit) {
            case "week" -> value * 7L * 24 * 3600;
            case "day" -> value * 24L * 3600;
            default -> throw new IllegalStateException("unsupported recentRangeUnit: " + unit);
        };
    }

    @Transactional
    public ItemResponse patch(String itemId, PatchItemRequest request) {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        ItemRepository.ItemRecord current = itemRepository.findById(accountId, itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "item not found"));

        String nextTitle = request.title() == null ? current.title() : normalizeTitle(request.title());
        String nextNotes = request.notes() == null ? current.notes() : normalizeText(request.notes());
        String nextDirectoryId = request.directoryId() == null
                ? current.directoryId()
                : normalizeDirectoryId(accountId, request.directoryId());
        String nextProgress = request.progress() == null
                ? current.progress()
                : normalizeProgress(request.progress(), current.progress());
        String nextPriority = request.priority() == null
                ? current.priority()
                : normalizePriority(request.priority());
        String nextExpectedAt = request.expectedAt() == null
                ? current.expectedAt()
                : normalizeExpectedAt(request.expectedAt());

        String nextCompletedAt = nextProgress.equals("done")
                ? (current.completedAt() == null ? Instant.now().toString() : current.completedAt())
                : null;

        return itemRepository.update(
                        accountId,
                        itemId,
                        nextTitle,
                        nextNotes,
                        nextDirectoryId,
                        nextProgress,
                        nextPriority,
                        nextExpectedAt,
                        nextCompletedAt,
                        current.trashedAt()
                )
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "item not found"));
    }

    @Transactional
    public ItemResponse complete(String itemId) {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        ItemRepository.ItemRecord current = itemRepository.findById(accountId, itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "item not found"));

        return itemRepository.update(
                        accountId,
                        itemId,
                        current.title(),
                        current.notes(),
                        current.directoryId(),
                        "done",
                        current.priority(),
                        current.expectedAt(),
                        Instant.now().toString(),
                        current.trashedAt()
                )
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "item not found"));
    }

    @Transactional
    public ItemResponse trash(String itemId) {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        ItemRepository.ItemRecord current = itemRepository.findById(accountId, itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "item not found"));

        return itemRepository.update(
                        accountId,
                        itemId,
                        current.title(),
                        current.notes(),
                        current.directoryId(),
                        current.progress(),
                        current.priority(),
                        current.expectedAt(),
                        current.completedAt(),
                        Instant.now().toString()
                )
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "item not found"));
    }

    @Transactional
    public ItemResponse restore(String itemId) {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        ItemRepository.ItemRecord current = itemRepository.findById(accountId, itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "item not found"));

        return itemRepository.update(
                        accountId,
                        itemId,
                        current.title(),
                        current.notes(),
                        current.directoryId(),
                        current.progress(),
                        current.priority(),
                        current.expectedAt(),
                        current.completedAt(),
                        null
                )
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "item not found"));
    }

    private String normalizeTitle(String title) {
        if (title == null || title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title is required");
        }
        return title.trim();
    }

    private String normalizeText(String text) {
        return text == null ? null : text.trim();
    }

    private String normalizeDirectoryId(String accountId, String directoryId) {
        if (directoryId == null || directoryId.isBlank()) {
            return null;
        }

        String normalized = directoryId.trim();
        if (directoryRepository.findActiveById(accountId, normalized).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "directory not found");
        }
        return normalized;
    }

    private String normalizeProgress(String progress, String defaultValue) {
        if (progress == null || progress.isBlank()) {
            return defaultValue;
        }

        String normalized = progress.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_PROGRESS.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid progress");
        }
        return normalized;
    }

    private String normalizePriority(String priority) {
        if (priority == null || priority.isBlank()) {
            return null;
        }

        String normalized = priority.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_PRIORITY.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid priority");
        }
        return normalized;
    }

    private String normalizeExpectedAt(String expectedAt) {
        if (expectedAt == null || expectedAt.isBlank()) {
            return null;
        }

        try {
            return Instant.parse(expectedAt.trim()).toString();
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid expectedAt");
        }
    }

    private ItemResponse toResponse(ItemRepository.ItemRecord record) {
        return new ItemResponse(
                record.id(),
                record.directoryId(),
                record.title(),
                record.notes(),
                record.progress(),
                record.priority(),
                record.expectedAt(),
                record.completedAt(),
                record.trashedAt(),
                record.createdAt(),
                record.updatedAt()
        );
    }

    public record CreateItemRequest(
            String title,
            String notes,
            String directoryId,
            String progress,
            String priority,
            String expectedAt
    ) {
    }

    public record PatchItemRequest(
            String title,
            String notes,
            String directoryId,
            String progress,
            String priority,
            String expectedAt
    ) {
    }

    public record ListItemsQuery(
            String q,
            String progress,
            String priority,
            String directoryId,
            String view
    ) {
    }

    public record ItemResponse(
            String id,
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
