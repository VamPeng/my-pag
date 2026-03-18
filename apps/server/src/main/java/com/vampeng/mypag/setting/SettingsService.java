package com.vampeng.mypag.setting;

import java.util.Locale;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.vampeng.mypag.account.CurrentAccountService;

@Service
public class SettingsService {

    private static final Set<String> ALLOWED_UNITS = Set.of("day", "week");

    private final CurrentAccountService currentAccountService;
    private final SettingsRepository settingsRepository;

    public SettingsService(CurrentAccountService currentAccountService, SettingsRepository settingsRepository) {
        this.currentAccountService = currentAccountService;
        this.settingsRepository = settingsRepository;
    }

    @Transactional
    public SettingsResponse getCurrentSettings() {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        SettingsRepository.SettingsRecord record = settingsRepository.findByAccountId(accountId)
                .orElseGet(() -> settingsRepository.createDefault(accountId));
        return toResponse(record);
    }

    @Transactional
    public SettingsResponse updateCurrentSettings(SettingsPatchRequest request) {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        SettingsRepository.SettingsRecord current = settingsRepository.findByAccountId(accountId)
                .orElseGet(() -> settingsRepository.createDefault(accountId));

        int nextRangeValue = request.recentRangeValue() == null
                ? current.recentRangeValue()
                : request.recentRangeValue();

        String nextRangeUnit = request.recentRangeUnit() == null
                ? current.recentRangeUnit()
                : request.recentRangeUnit().toLowerCase(Locale.ROOT);

        validate(nextRangeValue, nextRangeUnit);

        SettingsRepository.SettingsRecord updated = settingsRepository.update(accountId, nextRangeValue, nextRangeUnit);
        return toResponse(updated);
    }

    private void validate(int recentRangeValue, String recentRangeUnit) {
        if (recentRangeValue <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "recentRangeValue must be > 0");
        }
        if (!ALLOWED_UNITS.contains(recentRangeUnit)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "recentRangeUnit must be one of day/week");
        }
    }

    private SettingsResponse toResponse(SettingsRepository.SettingsRecord record) {
        return new SettingsResponse(record.recentRangeValue(), record.recentRangeUnit());
    }

    public record SettingsPatchRequest(
            Integer recentRangeValue,
            String recentRangeUnit
    ) {
    }

    public record SettingsResponse(
            int recentRangeValue,
            String recentRangeUnit
    ) {
    }
}
