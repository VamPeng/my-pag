# Repository Guidance

## Project Purpose

This repository is for building a personal task and item management product.

The product goal is to replace text-document-based tracking with a more structured system that supports:

- quick capture
- hierarchical organization
- time-based views
- progress-based tracking

The product is currently centered on personal use, but the project should keep room for future open sourcing or broader public use.

## Current Phase

The repository is currently in the requirements definition phase.

Work priority order:

1. refine requirements
2. confirm product structure and interaction model
3. confirm technical approach
4. implement the product

Do not expand into implementation-first work when requirements are still unresolved unless explicitly requested.

## Source Of Truth

The active requirements source of truth is:

- `docs/requirements-v0.1.0/README.md`
- the chapter files under `docs/requirements-v0.1.0/`

When requirement details are discussed, update the relevant chapter file directly instead of creating scattered notes.

## Product Direction

Current direction for V1:

- single-page product structure
- desktop-first three-column layout
- tree-based directory navigation
- smart views for time-based access
- shared field model for both lightweight items and standard tasks
- one unified progress field instead of separate status and progress fields

## V1 Boundaries

The current V1 intentionally excludes:

- collaboration features
- shared views or member permissions
- subtask support
- task dependency or relation modeling
- cloud-sync-first assumptions unless later confirmed by technical decisions

If new ideas appear during discussion, treat them as later-iteration candidates unless they are explicitly accepted into V1 requirements.

## Working Rules

- Prefer updating existing requirement chapters over creating new temporary files.
- Keep requirement decisions concrete and scoped to V1 unless discussing future evolution explicitly.
- When implementation starts, align code and technical choices with the current requirements directory.
- If a technical decision conflicts with the current requirements, update the requirement docs first or explicitly record the conflict.

## Document Sync Rule

`AGENTS.md` and `CLAUDE.md` must stay identical in intent and content.

Whenever one of these files is updated, the other file must be updated in the same change so they remain synchronized.

Do not let the two files drift.
