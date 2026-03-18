package com.vampeng.mypag.view;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.vampeng.mypag.account.CurrentAccountService;
import com.vampeng.mypag.setting.SettingsService;

@Service
public class ViewService {

    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Shanghai");

    private final CurrentAccountService currentAccountService;
    private final SettingsService settingsService;
    private final ViewRepository viewRepository;

    public ViewService(
            CurrentAccountService currentAccountService,
            SettingsService settingsService,
            ViewRepository viewRepository
    ) {
        this.currentAccountService = currentAccountService;
        this.settingsService = settingsService;
        this.viewRepository = viewRepository;
    }

    @Transactional(readOnly = true)
    public List<ViewItemResponse> inbox() {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        return viewRepository.inbox(accountId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ViewItemResponse> today() {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        LocalDate today = LocalDate.now(APP_ZONE);
        Instant dayStart = today.atStartOfDay(APP_ZONE).toInstant();
        Instant nextDayStart = today.plusDays(1).atStartOfDay(APP_ZONE).toInstant();

        return viewRepository.today(accountId, dayStart.toString(), nextDayStart.toString())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ViewItemResponse> upcoming() {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        SettingsService.SettingsResponse settings = settingsService.getCurrentSettings();
        Instant now = Instant.now();
        Instant upperBound = now.plusSeconds(toSeconds(settings.recentRangeValue(), settings.recentRangeUnit()));

        return viewRepository.upcoming(accountId, now.toString(), upperBound.toString())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ViewItemResponse> overdue() {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        return viewRepository.overdue(accountId, Instant.now().toString())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private long toSeconds(int value, String unit) {
        return switch (unit) {
            case "week" -> value * 7L * 24 * 3600;
            case "day" -> value * 24L * 3600;
            default -> throw new IllegalStateException("unsupported recentRangeUnit: " + unit);
        };
    }

    private ViewItemResponse toResponse(ViewRepository.ViewItemRecord record) {
        return new ViewItemResponse(
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

    public record ViewItemResponse(
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
