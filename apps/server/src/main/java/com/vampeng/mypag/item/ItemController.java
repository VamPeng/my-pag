package com.vampeng.mypag.item;

import java.util.List;

import org.springframework.http.HttpStatus;
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
@RequestMapping("/api/items")
public class ItemController {

    private final ItemService itemService;

    public ItemController(ItemService itemService) {
        this.itemService = itemService;
    }

    @GetMapping
    public List<ItemService.ItemResponse> listItems(
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "progress", required = false) String progress,
            @RequestParam(value = "priority", required = false) String priority,
            @RequestParam(value = "directoryId", required = false) String directoryId
    ) {
        return itemService.list(new ItemService.ListItemsQuery(q, progress, priority, directoryId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ItemService.ItemResponse createItem(@RequestBody ItemService.CreateItemRequest request) {
        return itemService.create(request);
    }

    @GetMapping("/{itemId}")
    public ItemService.ItemResponse getItem(@PathVariable String itemId) {
        return itemService.getById(itemId);
    }

    @PatchMapping("/{itemId}")
    public ItemService.ItemResponse patchItem(
            @PathVariable String itemId,
            @RequestBody ItemService.PatchItemRequest request
    ) {
        return itemService.patch(itemId, request);
    }

    @PostMapping("/{itemId}/complete")
    public ItemService.ItemResponse completeItem(@PathVariable String itemId) {
        return itemService.complete(itemId);
    }

    @PostMapping("/{itemId}/trash")
    public ItemService.ItemResponse trashItem(@PathVariable String itemId) {
        return itemService.trash(itemId);
    }

    @PostMapping("/{itemId}/restore")
    public ItemService.ItemResponse restoreItem(@PathVariable String itemId) {
        return itemService.restore(itemId);
    }
}
