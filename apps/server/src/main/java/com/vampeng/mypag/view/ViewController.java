package com.vampeng.mypag.view;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/views")
public class ViewController {

    private final ViewService viewService;

    public ViewController(ViewService viewService) {
        this.viewService = viewService;
    }

    @GetMapping("/unclassified")
    public List<ViewService.ViewItemResponse> unclassified() {
        return viewService.unclassified();
    }

    @GetMapping("/inbox")
    public List<ViewService.ViewItemResponse> inbox() {
        return viewService.inbox();
    }

    @GetMapping("/today")
    public List<ViewService.ViewItemResponse> today() {
        return viewService.today();
    }

    @GetMapping("/upcoming")
    public List<ViewService.ViewItemResponse> upcoming() {
        return viewService.upcoming();
    }

    @GetMapping("/overdue")
    public List<ViewService.ViewItemResponse> overdue() {
        return viewService.overdue();
    }
}
