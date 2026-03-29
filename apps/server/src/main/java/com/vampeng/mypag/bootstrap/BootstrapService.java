package com.vampeng.mypag.bootstrap;

import java.util.List;

import org.springframework.stereotype.Service;

import com.vampeng.mypag.account.CurrentAccountService;
import com.vampeng.mypag.directory.DirectoryService;
import com.vampeng.mypag.setting.SettingsService;
import com.vampeng.mypag.view.ViewRepository;

@Service
public class BootstrapService {

    private final CurrentAccountService currentAccountService;
    private final SettingsService settingsService;
    private final DirectoryService directoryService;
    private final ViewRepository viewRepository;

    public BootstrapService(
            CurrentAccountService currentAccountService,
            SettingsService settingsService,
            DirectoryService directoryService,
            ViewRepository viewRepository
    ) {
        this.currentAccountService = currentAccountService;
        this.settingsService = settingsService;
        this.directoryService = directoryService;
        this.viewRepository = viewRepository;
    }

    public BootstrapResponse getBootstrap() {
        CurrentAccountService.Account account = currentAccountService.ensureCurrentAccount();
        SettingsService.SettingsResponse settings = settingsService.getCurrentSettings();
        List<DirectoryService.DirectoryNode> directories = directoryService.getTree();
        int unclassifiedCount = viewRepository.unclassifiedCount(account.id());
        return new BootstrapResponse(
                new AccountResponse(account.id(), account.name(), account.status()),
                settings,
                directories,
                unclassifiedCount
        );
    }

    public record BootstrapResponse(
            AccountResponse account,
            SettingsService.SettingsResponse settings,
            List<DirectoryService.DirectoryNode> directories,
            int unclassifiedCount
    ) {
    }

    public record AccountResponse(
            String id,
            String name,
            String status
    ) {
    }
}
