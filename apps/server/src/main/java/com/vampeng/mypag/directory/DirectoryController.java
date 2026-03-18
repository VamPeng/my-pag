package com.vampeng.mypag.directory;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/directories")
public class DirectoryController {

    private final DirectoryService directoryService;

    public DirectoryController(DirectoryService directoryService) {
        this.directoryService = directoryService;
    }

    @GetMapping
    public List<DirectoryService.DirectoryNode> getDirectories() {
        return directoryService.getTree();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DirectoryService.DirectoryNode createDirectory(@RequestBody DirectoryService.CreateDirectoryRequest request) {
        return directoryService.create(request);
    }

    @PatchMapping("/{directoryId}")
    public DirectoryService.DirectoryNode renameDirectory(
            @PathVariable String directoryId,
            @RequestBody DirectoryService.RenameDirectoryRequest request
    ) {
        return directoryService.rename(directoryId, request);
    }

    @DeleteMapping("/{directoryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDirectory(@PathVariable String directoryId, @RequestParam("mode") String mode) {
        directoryService.delete(directoryId, mode);
    }
}
