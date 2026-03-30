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
            "/{path:^(?!api|health|actuator)[^\\.]*$}",
            "/{path:^(?!api|health|actuator)[^\\.]*$}/**"
    })
    public String forward() {
        return "forward:/index.html";
    }
}
