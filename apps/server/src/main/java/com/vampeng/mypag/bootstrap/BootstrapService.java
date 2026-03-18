package com.vampeng.mypag.bootstrap;

import java.util.List;

import org.springframework.stereotype.Service;

import com.vampeng.mypag.account.CurrentAccountService;
import com.vampeng.mypag.directory.DirectoryService;
import com.vampeng.mypag.setting.SettingsService;

@Service
public class BootstrapService {

    private final CurrentAccountService currentAccountService;
    private final SettingsService settingsService;
    private final DirectoryService directoryService;

    public BootstrapService(
            CurrentAccountService currentAccountService,
            SettingsService settingsService,
            DirectoryService directoryService
    ) {
        this.currentAccountService = currentAccountService;
        this.settingsService = settingsService;
        this.directoryService = directoryService;
    }

    public BootstrapResponse getBootstrap() {
        CurrentAccountService.Account account = currentAccountService.ensureCurrentAccount();
        SettingsService.SettingsResponse settings = settingsService.getCurrentSettings();
        List<DirectoryService.DirectoryNode> directories = directoryService.getTree();
        return new BootstrapResponse(
                new AccountResponse(account.id(), account.name(), account.status()),
                settings,
                directories
        );
    }

    public record BootstrapResponse(
            AccountResponse account,
            SettingsService.SettingsResponse settings,
            List<DirectoryService.DirectoryNode> directories
    ) {
    }

    public record AccountResponse(
            String id,
            String name,
            String status
    ) {
    }
}
