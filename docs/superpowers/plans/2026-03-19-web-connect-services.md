# Web API Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect current web UI to real backend APIs so users can load bootstrap data, switch smart views, create items, and update selected item fields.

**Architecture:** Keep the existing single-page three-column layout and replace static samples with API-driven state. Add typed API client helpers and wire app-level state transitions for bootstrap fetch, view-based list loading, quick-create, complete, and detail save.

**Tech Stack:** React + TypeScript + Vite, existing REST backend.

---

### Task 1: API and Type Layer

**Files:**
- Modify: `apps/web/src/types/item.ts`
- Modify: `apps/web/src/services/api.ts`

- [x] **Step 1: Add backend-aligned item/bootstrap/settings/directory/view types**
- [x] **Step 2: Add typed API methods (`getBootstrap`, `getViewItems`, `createItem`, `patchItem`, `completeItem`)**
- [x] **Step 3: Run `npm run build` and verify no type errors**

### Task 2: App Wiring

**Files:**
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/styles/global.css`

- [x] **Step 1: Replace static mock data with API-driven state loading**
- [x] **Step 2: Wire smart-view switching to `/api/views/*`**
- [x] **Step 3: Wire quick-create input to `POST /api/items`**
- [x] **Step 4: Wire detail save to `PATCH /api/items/{id}` and list one-click complete**
- [x] **Step 5: Keep mobile/desktop layout intact while adding interactive states**

### Task 3: Verification and Commit

- [x] **Step 1: Run frontend build**
Run: `npm run build`
Expected: build success

- [x] **Step 2: Run backend tests regression check**
Run: `GRADLE_USER_HOME=/Users/yuhuipeng/Desktop/pro/webP/my-pag/apps/server/.gradle ./gradlew test`
Expected: `BUILD SUCCESSFUL`

- [x] **Step 3: Mark checkboxes and commit**
```bash
git add apps/web docs/superpowers/plans/2026-03-19-web-connect-services.md
git commit -m "feat: connect web app to backend services"
```
