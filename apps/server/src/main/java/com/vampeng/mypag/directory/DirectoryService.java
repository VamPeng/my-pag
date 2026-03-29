package com.vampeng.mypag.directory;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.vampeng.mypag.account.CurrentAccountService;

@Service
public class DirectoryService {

    private final CurrentAccountService currentAccountService;
    private final DirectoryRepository directoryRepository;

    public DirectoryService(CurrentAccountService currentAccountService, DirectoryRepository directoryRepository) {
        this.currentAccountService = currentAccountService;
        this.directoryRepository = directoryRepository;
    }

    @Transactional(readOnly = true)
    public List<DirectoryNode> getTree() {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        List<DirectoryRepository.DirectoryRecord> records = directoryRepository.findAllActiveByAccountId(accountId);
        return buildTree(accountId, records);
    }

    @Transactional
    public DirectoryNode create(CreateDirectoryRequest request) {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        validateName(request.name());

        if (request.parentId() != null && directoryRepository.findActiveById(accountId, request.parentId()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "parent directory not found");
        }

        int sortOrder = request.sortOrder() == null ? 0 : request.sortOrder();
        DirectoryRepository.DirectoryRecord created = directoryRepository.create(
                accountId,
                request.parentId(),
                request.name().trim(),
                sortOrder,
                request.color()
        );
        return toNode(created, List.of(), 0);
    }

    @Transactional
    public DirectoryNode rename(String directoryId, RenameDirectoryRequest request) {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        validateName(request.name());

        return directoryRepository.rename(accountId, directoryId, request.name().trim())
                .map(record -> toNode(record, List.of(), directoryRepository.countActiveItems(accountId, record.id())))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "directory not found"));
    }

    @Transactional(readOnly = true)
    public List<DirectoryItemResponse> getItems(String directoryId) {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        List<String> subtreeIds = directoryRepository.findActiveSubtreeIds(accountId, directoryId);
        if (subtreeIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "directory not found");
        }
        return directoryRepository.findItemsBySubtree(accountId, subtreeIds).stream()
                .map(r -> new DirectoryItemResponse(
                        r.id(), r.directoryId(), r.title(), r.notes(), r.progress(),
                        r.priority(), r.expectedAt(), r.completedAt(), r.trashedAt(),
                        r.createdAt(), r.updatedAt()))
                .toList();
    }

    @Transactional
    public DirectoryNode updateColor(String directoryId, UpdateColorRequest request) {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        return directoryRepository.updateColor(accountId, directoryId, request.color())
                .map(record -> toNode(record, List.of(), directoryRepository.countActiveItems(accountId, record.id())))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "directory not found"));
    }

    @Transactional
    public void delete(String directoryId, String mode) {
        String accountId = currentAccountService.ensureCurrentAccount().id();
        DeleteMode deleteMode = DeleteMode.from(mode);

        directoryRepository.findActiveById(accountId, directoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "directory not found"));

        List<String> subtreeIds = directoryRepository.findActiveSubtreeIds(accountId, directoryId);

        if (deleteMode == DeleteMode.MOVE_TO_INBOX) {
            directoryRepository.moveItemsToInbox(accountId, subtreeIds);
        } else {
            directoryRepository.trashItems(accountId, subtreeIds);
        }
        directoryRepository.softDelete(accountId, subtreeIds);
    }

    private void validateName(String name) {
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name is required");
        }
    }

    private List<DirectoryNode> buildTree(String accountId, List<DirectoryRepository.DirectoryRecord> records) {
        Map<String, MutableNode> nodes = new LinkedHashMap<>();
        for (DirectoryRepository.DirectoryRecord record : records) {
            nodes.put(record.id(), new MutableNode(record.id(), record.parentId(), record.name(), record.sortOrder(), record.color()));
        }

        List<MutableNode> roots = new ArrayList<>();
        for (MutableNode node : nodes.values()) {
            if (node.parentId() == null || !nodes.containsKey(node.parentId())) {
                roots.add(node);
                continue;
            }
            nodes.get(node.parentId()).children().add(node);
        }

        sortNodes(roots);
        return roots.stream().map(node -> toNode(accountId, node, 0)).toList();
    }

    private void sortNodes(List<MutableNode> nodes) {
        nodes.sort(Comparator
                .comparingInt(MutableNode::sortOrder)
                .thenComparing(MutableNode::name, String::compareTo));
        for (MutableNode node : nodes) {
            sortNodes(node.children());
        }
    }

    private DirectoryNode toNode(String accountId, MutableNode node, int level) {
        int activeCount = directoryRepository.countActiveItems(accountId, node.id());
        return new DirectoryNode(
                node.id(),
                node.parentId(),
                node.name(),
                node.sortOrder(),
                node.color(),
                activeCount,
                level,
                node.children().stream().map(child -> toNode(accountId, child, level + 1)).toList()
        );
    }

    private DirectoryNode toNode(DirectoryRepository.DirectoryRecord record, List<DirectoryNode> children, int activeCount) {
        return new DirectoryNode(
                record.id(),
                record.parentId(),
                record.name(),
                record.sortOrder(),
                record.color(),
                activeCount,
                0,
                children
        );
    }

    public enum DeleteMode {
        MOVE_TO_INBOX("move_to_inbox"),
        DELETE_WITH_ITEMS("delete_with_items");

        private final String value;

        DeleteMode(String value) {
            this.value = value;
        }

        public static DeleteMode from(String modeValue) {
            for (DeleteMode mode : values()) {
                if (Objects.equals(mode.value, modeValue)) {
                    return mode;
                }
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid delete mode");
        }
    }

    public record CreateDirectoryRequest(
            String name,
            String parentId,
            Integer sortOrder,
            String color
    ) {
    }

    public record RenameDirectoryRequest(
            String name
    ) {
    }

    public record UpdateColorRequest(
            String color
    ) {
    }

    public record DirectoryItemResponse(
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

    public record DirectoryNode(
            String id,
            String parentId,
            String name,
            int sortOrder,
            String color,
            int activeCount,
            int level,
            List<DirectoryNode> children
    ) {
    }

    private record MutableNode(
            String id,
            String parentId,
            String name,
            int sortOrder,
            String color,
            List<MutableNode> children
    ) {
        private MutableNode(String id, String parentId, String name, int sortOrder, String color) {
            this(id, parentId, name, sortOrder, color, new ArrayList<>());
        }
    }
}
