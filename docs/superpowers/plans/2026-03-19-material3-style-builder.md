# Material 3 Style Builder Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a consistent Material 3 visual system to the current web app using Material Theme Builder outputs, while keeping existing feature behaviors unchanged.

**Architecture:** Import Material Theme Builder generated design tokens (color, typography, shape) as the single theme source, then map them into app-level CSS variables and component-level usage. Keep data flow/API logic intact and scope changes to presentation-layer files first.

**Tech Stack:** Material Theme Builder outputs, React + TypeScript + Vite, existing CSS-based UI.

---

### Task 1: Theme Token Pipeline

**Files:**
- Create: `apps/web/src/styles/material3-tokens.css`
- Modify: `apps/web/src/styles/global.css`
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: Export Material Theme Builder token set (light/dark if provided)**
- [ ] **Step 2: Convert/export tokens into CSS custom properties file**
- [ ] **Step 3: Load token file before app styles and replace hardcoded palette values with semantic variables**
- [ ] **Step 4: Run `npm run build` to verify token integration is type/build-safe**

### Task 2: Material 3 Surface and Component Mapping

**Files:**
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/styles/global.css`

- [ ] **Step 1: Map shell/sidebar/content/detail to Material 3 surface roles (`surface`, `surface-container`, `on-surface`)**
- [ ] **Step 2: Map navigation, buttons, cards, inputs to Material 3 role tokens (`primary`, `secondary-container`, `outline`, etc.)**
- [ ] **Step 3: Align typography scale (headline/title/body/label) with Material 3 naming and sizing**
- [ ] **Step 4: Keep accessibility contrast and interaction states (hover/active/focus) compliant**

### Task 3: Theming Runtime Strategy

**Files:**
- Modify: `apps/web/src/app/App.tsx`
- Optional Create: `apps/web/src/services/theme.ts`

- [ ] **Step 1: Decide initial strategy: light-only V1 or light+dark toggle (recommended: light-only first, dark prepared)**
- [ ] **Step 2: If toggle enabled, implement token-scope switch (class/data-attribute) without API coupling**
- [ ] **Step 3: Persist user choice only if explicitly required by product scope**

### Task 4: Verification and Delivery

- [ ] **Step 1: Run frontend build**
Run: `npm run build`
Expected: build success

- [ ] **Step 2: Run backend regression check (no behavior drift)**
Run: `GRADLE_USER_HOME=/Users/yuhuipeng/Desktop/pro/webP/my-pag/apps/server/.gradle ./gradlew test`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Manual UI smoke check**
Check: smart view switch, quick create, complete action, detail save all remain functional under new theme

- [ ] **Step 4: Commit**
```bash
git add apps/web docs/superpowers/plans/2026-03-19-material3-style-builder.md
git commit -m "plan: add material3 style builder integration roadmap"
```
