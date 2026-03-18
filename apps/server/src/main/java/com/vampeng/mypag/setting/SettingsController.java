package com.vampeng.mypag.setting;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public SettingsService.SettingsResponse getSettings() {
        return settingsService.getCurrentSettings();
    }

    @PatchMapping
    public SettingsService.SettingsResponse patchSettings(@RequestBody SettingsService.SettingsPatchRequest request) {
        return settingsService.updateCurrentSettings(request);
    }
}
