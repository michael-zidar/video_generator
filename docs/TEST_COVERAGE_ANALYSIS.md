# Test Coverage Analysis & Improvement Proposal

## Executive Summary

**Current State: Zero Test Coverage**

This codebase has no test infrastructure configured and no test files. This is a significant gap for an application of this complexity, especially given the critical nature of features like video rendering, AI integration, and user data management.

---

## Project Overview

| Component | Technology | Files | Test Files |
|-----------|------------|-------|------------|
| Frontend | React 19 + TypeScript + Vite | 59 | 0 |
| Backend | Node.js + Express | 22 | 0 |
| **Total** | | **81** | **0** |

---

## Priority Areas for Testing

### 1. Backend Services (Critical Priority)

#### 1.1 AI Service (`server/src/services/ai.js`)

**Why it needs testing:**
- Complex JSON parsing from AI responses with fallback logic
- Multiple prompt engineering functions that could produce unexpected output
- External API integration with OpenAI/Gemini
- Layout type validation and schema handling

**Recommended tests:**
```
- Unit: JSON parsing with markdown code blocks
- Unit: Layout type validation (LAYOUT_TYPES)
- Unit: buildSlideContentDescription helper
- Integration: Mock OpenAI responses for generateOutline
- Integration: Mock responses for generateSlideContent
- Edge cases: Malformed AI responses, empty responses, timeout handling
```

**Estimated test count:** 15-20 tests

#### 1.2 Render Service (`server/src/services/render.js`)

**Why it needs testing:**
- Complex FFmpeg command construction
- HTML generation for slides with multiple layouts
- File system operations (read/write/cleanup)
- Quality preset handling
- Timeline item processing (intro/outro/interstitials)

**Recommended tests:**
```
- Unit: getTextColor (brightness calculation)
- Unit: escapeHtml (XSS prevention)
- Unit: renderSlideContent for all 8+ layouts
- Unit: generateSlideHTML output structure
- Unit: QUALITY_PRESETS validation
- Integration: renderSlideToImage with mock Puppeteer
- Integration: composeVideo FFmpeg command generation
- Edge cases: Missing audio files, invalid slide data, aspect ratio handling
```

**Estimated test count:** 25-30 tests

#### 1.3 Database Layer (`server/src/db.js`)

**Why it needs testing:**
- Critical data persistence layer
- Complex JOIN queries in routes
- Migration logic for schema updates
- Helper functions (get, all, run, insert)

**Recommended tests:**
```
- Unit: Database initialization
- Unit: Helper functions with test fixtures
- Integration: CRUD operations for each table
- Integration: Foreign key constraints
- Edge cases: Concurrent writes, database corruption recovery
```

**Estimated test count:** 15-20 tests

---

### 2. API Routes (High Priority)

#### 2.1 Slides Routes (`server/src/routes/slides.js`)

**Why it needs testing:**
- Authorization checks (user ownership verification)
- Position reordering logic
- JSON parsing of body/transition fields
- Input validation

**Recommended tests:**
```
- Unit: PUT /api/slides/:id - all field updates
- Unit: DELETE /api/slides/:id - position reordering
- Unit: POST /api/slides/:id/duplicate
- Unit: POST /api/slides/reorder
- Security: Ownership verification (access control)
- Edge cases: Invalid slide IDs, missing fields, concurrent updates
```

**Estimated test count:** 12-15 tests

#### 2.2 Other Critical Routes

| Route File | Priority | Key Test Areas |
|------------|----------|----------------|
| `ai.js` | High | AI generation endpoints, error handling |
| `courses.js` | High | CRUD, user isolation |
| `decks.js` | High | Deck management, lesson linking |
| `renders.js` | Critical | Render job creation, status tracking |
| `assets.js` | High | File upload/download, MIME validation |
| `auth.js` | Critical | Authentication middleware |
| `timeline-items.js` | Medium | Video timeline management |
| `voice-profiles.js` | Medium | TTS configuration |
| `notion.js` | Medium | External API integration |
| `export.js` | Medium | Export functionality |

**Estimated test count:** 60-80 tests across all routes

---

### 3. Frontend Testing (High Priority)

#### 3.1 State Management (`frontend/src/store/editor.ts`)

**Why it needs testing:**
- Core application state (slides, deck, timeline)
- Complex operations (reorderSlides, updateSlide)
- UI state synchronization

**Recommended tests:**
```
- Unit: Initial state values
- Unit: setSlides, addSlide, removeSlide
- Unit: updateSlide partial updates
- Unit: reorderSlides position calculation
- Unit: Timeline item operations
- Unit: Selection state management
```

**Estimated test count:** 20-25 tests

#### 3.2 Custom Hooks

| Hook | Priority | Test Focus |
|------|----------|------------|
| `useAudioRecorder` | High | MediaRecorder integration, state transitions |
| `useAudioPlayback` | High | Audio element control, time tracking |
| `useRenderProgress` | High | WebSocket connection, progress parsing |
| `use-toast` | Medium | Toast queue management |

**Estimated test count:** 15-20 tests

#### 3.3 Type Factories (`frontend/src/types/slide.ts`)

**Why it needs testing:**
- Element ID generation uniqueness
- Factory functions produce valid objects
- Default values are correctly applied

**Recommended tests:**
```
- Unit: generateElementId uniqueness
- Unit: createTextElement with/without overrides
- Unit: createImageElement with/without overrides
- Unit: createShapeElement with/without overrides
- Unit: Default values match interface requirements
```

**Estimated test count:** 10-12 tests

#### 3.4 API Client (`frontend/src/lib/api.ts`)

**Why it needs testing:**
- Token injection into requests
- Error handling and response parsing
- HTTP method implementations

**Estimated test count:** 8-10 tests

#### 3.5 React Components (Medium Priority)

| Component Area | Files | Key Test Focus |
|----------------|-------|----------------|
| Canvas | 5 | Element rendering, drag/drop |
| Timeline | 10 | Track rendering, playhead control |
| Pages | 6 | Route rendering, data loading |
| Dialogs | 3 | Form handling, validation |

**Estimated test count:** 40-50 tests

---

## Proposed Testing Infrastructure

### Backend Setup

```json
// server/package.json additions
{
  "devDependencies": {
    "vitest": "^3.0.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Recommended directory structure:**
```
server/
├── src/
│   ├── services/
│   ├── routes/
│   └── ...
└── tests/
    ├── setup.js           # Test database, mocks
    ├── services/
    │   ├── ai.test.js
    │   ├── render.test.js
    │   └── ...
    ├── routes/
    │   ├── slides.test.js
    │   ├── courses.test.js
    │   └── ...
    └── fixtures/
        ├── slides.json
        └── ...
```

### Frontend Setup

```json
// frontend/package.json additions
{
  "devDependencies": {
    "vitest": "^3.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jsdom": "^25.0.0",
    "msw": "^2.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Recommended directory structure:**
```
frontend/
├── src/
│   ├── components/
│   ├── store/
│   └── ...
└── tests/
    ├── setup.ts           # JSDOM, testing-library setup
    ├── mocks/
    │   └── handlers.ts    # MSW API mocks
    ├── store/
    │   └── editor.test.ts
    ├── hooks/
    │   └── useAudioRecorder.test.ts
    ├── components/
    │   └── Canvas/
    │       └── SlideCanvas.test.tsx
    └── fixtures/
        └── slides.ts
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Set up Vitest in both frontend and backend
- [ ] Create test database initialization for backend
- [ ] Set up MSW for frontend API mocking
- [ ] Write first tests for `db.js` helper functions
- [ ] Write first tests for `slide.ts` type factories

### Phase 2: Critical Backend Services (Week 2)
- [ ] AI service unit tests (JSON parsing, prompts)
- [ ] Render service unit tests (HTML generation, helpers)
- [ ] Add mocks for OpenAI and Gemini APIs

### Phase 3: API Routes (Week 3)
- [ ] Slides route tests (CRUD + authorization)
- [ ] Courses route tests
- [ ] Decks route tests
- [ ] Authentication middleware tests

### Phase 4: Frontend State & Hooks (Week 4)
- [ ] Editor store tests
- [ ] Auth store tests
- [ ] Custom hooks tests (audio, render progress)
- [ ] API client tests

### Phase 5: Component Testing (Week 5+)
- [ ] Canvas components
- [ ] Timeline components
- [ ] Page components
- [ ] Dialog components

---

## Specific Test Recommendations

### High-Value Unit Tests

These tests have high ROI as they test pure functions with clear inputs/outputs:

1. **`escapeHtml()`** - Prevents XSS vulnerabilities
2. **`getTextColor()`** - Color contrast logic for accessibility
3. **`renderSlideContent()`** - Slide HTML rendering for all layouts
4. **`generateElementId()`** - Uniqueness guarantee
5. **`buildSlideContentDescription()`** - AI prompt construction

### Critical Integration Tests

1. **Render pipeline**: Slide → HTML → PNG → Video
2. **AI generation**: Topic → Outline → Slides → Scripts
3. **User data isolation**: Ensure users can only access their own data
4. **File upload/download**: Asset management lifecycle
5. **WebSocket progress**: Real-time render status updates

### Security-Focused Tests

1. **Authorization bypass attempts** - Access other users' resources
2. **SQL injection** - Parameterized query validation
3. **XSS prevention** - HTML escaping in slide content
4. **Path traversal** - Asset storage/retrieval
5. **Rate limiting** - AI endpoint abuse prevention

---

## Metrics & Goals

| Metric | Current | Target (3 months) |
|--------|---------|-------------------|
| Line Coverage | 0% | 60% |
| Branch Coverage | 0% | 50% |
| Test Files | 0 | 30+ |
| Test Cases | 0 | 200+ |
| CI Pipeline | None | Green badge |

---

## Quick Wins

These tests can be written quickly and provide immediate value:

1. **`slide.ts` factory functions** (~30 min) - Pure functions, no mocking
2. **`db.js` helper functions** (~1 hour) - Core data layer
3. **`escapeHtml` and `getTextColor`** (~30 min) - Security and accessibility
4. **Editor store basic operations** (~1 hour) - State management foundation
5. **API client request formation** (~1 hour) - HTTP layer validation

---

## Conclusion

The lack of test coverage represents a significant technical debt that should be addressed systematically. Starting with the backend services (AI, rendering) and API routes will provide the most value, as these contain the most complex business logic and potential failure points.

The recommended approach prioritizes:
1. **Safety**: Authentication, authorization, and data isolation
2. **Reliability**: Core features like rendering and AI generation
3. **Maintainability**: State management and component logic

Implementing even Phase 1-2 would dramatically improve confidence in the codebase and enable safer refactoring and feature development.
