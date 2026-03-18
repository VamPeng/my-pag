# Settings + Bootstrap + Directories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first production backend slice for settings/bootstrap/directories APIs on Spring Boot + SQLite.

**Architecture:** Single-account V1 baseline with JDBC repositories, service-layer rules, and REST endpoints. Startup runner applies SQL migration scripts and ensures DB path is bootable.

**Tech Stack:** Java 17, Spring Boot Web + JDBC, SQLite JDBC, JUnit 5 + MockMvc.

---

### Task 1: API Contracts (TDD)

**Files:**
- Test: `apps/server/src/test/java/com/vampeng/mypag/api/ApiIntegrationTest.java`

- [x] **Step 1: Write failing tests for settings/bootstrap/directories**
- [x] **Step 2: Run tests and confirm RED**
- [x] **Step 3: Implement minimal production code**
- [x] **Step 4: Run tests and confirm GREEN**

### Task 2: Directory Delete Strategies

**Files:**
- Modify: `apps/server/src/main/java/com/vampeng/mypag/directory/DirectoryService.java`
- Modify: `apps/server/src/main/java/com/vampeng/mypag/directory/DirectoryRepository.java`

- [x] **Step 1: Cover `move_to_inbox` and `delete_with_items` with tests**
- [x] **Step 2: Implement subtree-aware logic**
- [x] **Step 3: Verify with integration tests**

### Task 3: Full Verification

- [x] **Step 1: Run full backend tests**
Run: `GRADLE_USER_HOME=.gradle ./gradlew test`

- [x] **Step 2: Run frontend build**
Run: `npm run build`

- [ ] **Step 3: Commit feature branch changes**
