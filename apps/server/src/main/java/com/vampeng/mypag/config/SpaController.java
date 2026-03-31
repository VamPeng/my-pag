package com.vampeng.mypag.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Forwards all non-API routes to index.html so the SPA can handle client-side routing.
 */
@Controller
public class SpaController {

    @RequestMapping(value = {
            "/",
            "/{path:^(?!api|health|actuator|assets)[^\\.]*$}",
            "/{path:^(?!api|health|actuator|assets)[^\\.]*$}/{tail:^(?!.*\\.).*$}"
    })
    public String forward() {
        return "forward:/index.html";
    }
}
