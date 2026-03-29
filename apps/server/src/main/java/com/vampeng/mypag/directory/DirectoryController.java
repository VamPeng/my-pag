package com.vampeng.mypag.directory;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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

    @GetMapping("/{directoryId}/items")
    public List<DirectoryService.DirectoryItemResponse> getDirectoryItems(@PathVariable String directoryId) {
        return directoryService.getItems(directoryId);
    }

    @PutMapping("/{directoryId}/color")
    public DirectoryService.DirectoryNode updateColor(
            @PathVariable String directoryId,
            @RequestBody DirectoryService.UpdateColorRequest request
    ) {
        return directoryService.updateColor(directoryId, request);
    }

    @DeleteMapping("/{directoryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDirectory(
            @PathVariable String directoryId,
            @RequestParam(value = "mode", defaultValue = "move_to_inbox") String mode
    ) {
        directoryService.delete(directoryId, mode);
    }

    /**
     * 与 DELETE 等价，但用 JSON body 传 mode，避免部分环境下 DELETE + query 参数异常。
     */
    @PostMapping("/{directoryId}/delete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDirectoryWithBody(
            @PathVariable String directoryId,
            @RequestBody(required = false) Map<String, String> body
    ) {
        String mode = "move_to_inbox";
        if (body != null && body.get("mode") != null && !body.get("mode").isBlank()) {
            mode = body.get("mode").trim();
        }
        directoryService.delete(directoryId, mode);
    }
}
