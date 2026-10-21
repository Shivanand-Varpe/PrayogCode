# PrayogCode E2E Test Infrastructure Specification

**Document Version**: 2.0.0  
**Target Repository**: `C:\PrayogCode-Website`  
**Test Suite Directory**: `C:\PrayogCode-Website\test\`  
**Architect**: `test_writer_e2e_gen2`  
**Date**: 2026-10-21  
**Source Specifications**: `c:\PrayogCode\PROJECT.md`, `c:\PrayogCode\.agents\teamwork\ORIGINAL_REQUEST.md`, Explorer Surveys 1–3  

---

## 1. Test Philosophy & Core Principles

The PrayogCode website is an Apple-grade, zero-build, modular marketing and product landing page for an online C programming laboratory. The test suite guarantees that every aesthetic, functional, architectural, and accessibility contract specified in the project scope is rigorously validated without relying on mocks, facades, or superficial pass-throughs.

### 1.1 Opaque-Box, Requirement-Driven Testing
- **Specification-First**: Test expectations are derived strictly from `PROJECT.md`, `ORIGINAL_REQUEST.md`, and the `apple-design` skill specification.
- **Observable Outcomes**: Tests inspect user-facing DOM structures, rendered typography scales, computed glassmorphic properties, physics calculations, responsive styles, and simulated interactive state transitions.
- **No Facade Testing**: Every test exercises real code logic, regex patterns against disk assets, AST/DOM traversals, or analytical mathematical solutions. A test never blindly returns `true` or assumes success.

### 1.2 Progressive Testability & Independence
- **Isolated Execution**: Every test file and test case is completely self-contained, initializes its own environment state, and can be executed individually or as part of the unified test runner.
- **Graceful Fallbacks & Dual-Protocol Support**: Tests verify behavior under both `file:///` and `http://` protocols, ensuring zero CORS violations and zero console errors.
- **Zero External Tooling Dependency**: The entire suite runs on standard Node.js (`v24+`) using zero external `node_modules`. No external installation (`npm install`) is required to run the test suite.

### 1.3 Adversarial Verification
The suite actively challenges the implementation through:
1. **Encoding & Escaping Integrity**: Verifies correct rendering and escaping of C code, syntax symbols (`<stdio.h>`, `&a`, `\n`), Hindi/Marathi typography (`प्रयोग`), and SVG markup.
2. **Boundary & Viewport Stress**: Tests responsive breakpoints at 375px (iPhone SE), 768px (iPad Mini), 1024px (iPad Pro), and 1440px+ (MacBook / iMac displays).
3. **Network Zero-State**: Enforces complete absence of external CDN links, Google Fonts, or remote asset URLs.
4. **Motion & Accessibility Overrides**: Programmatically tests that `@media (prefers-reduced-motion: reduce)` disables transforms and resets durations, while `@media (prefers-reduced-transparency: reduce)` replaces glassmorphism with high-contrast solids.
5. **Harmonic Physics Accuracy**: Empirically validates that the closed-form spring solver satisfies the differential equations for critically damped ($\zeta=1.0$), under-damped ($\zeta=0.8, 0.85$), and over-damped ($\zeta>1.0$) systems, including momentum projection and hyperbolic rubber-banding.

---

## 2. Feature Inventory Coverage Matrix

The suite covers all 20 features defined in `PROJECT.md` across 4 test tiers:

| # | Feature Key | Feature Name | Tier 1 (Features) | Tier 2 (Boundaries) | Tier 3 (Interactions) | Tier 4 (Scenarios) |
|---|-------------|--------------|:-----------------:|:-------------------:|:---------------------:|:-------------------:|
| F1 | `sticky-nav` | Sticky Apple Glass Nav | 5 tests | 5 tests | 2 tests | 2 tests |
| F2 | `typography` | Optical Typography & Dark Scheme | 5 tests | 5 tests | 2 tests | 2 tests |
| F3 | `shell-layout` | Responsive Shell Layout | 5 tests | 5 tests | 2 tests | 2 tests |
| F4 | `glassmorphism` | Glassmorphism Material System | 5 tests | 5 tests | 2 tests | 2 tests |
| F5 | `accessibility` | Accessibility Foundation | 5 tests | 5 tests | 3 tests | 3 tests |
| F6 | `hero-section` | Hero Section Layout | 5 tests | 5 tests | 2 tests | 2 tests |
| F7 | `monaco-mockup` | Monaco Split UI Mockup | 5 tests | 5 tests | 2 tests | 2 tests |
| F8 | `terminal-sim` | Interactive Terminal Simulation | 5 tests | 5 tests | 3 tests | 2 tests |
| F9 | `code-switcher` | Multi-Snippet Code Switcher | 5 tests | 5 tests | 2 tests | 2 tests |
| F10 | `run-execution` | Real-Time Run Execution | 5 tests | 5 tests | 3 tests | 2 tests |
| F11 | `features-cards` | Features Section Cards (4 Pillars) | 5 tests | 5 tests | 1 test | 1 test |
| F12 | `how-it-works` | How It Works 4-Step Walkthrough | 5 tests | 5 tests | 1 test | 1 test |
| F13 | `tech-stack` | Tech Stack / Under the Hood | 5 tests | 5 tests | 1 test | 1 test |
| F14 | `faq-accordion` | Technical FAQ `<details>` Accordion | 5 tests | 5 tests | 2 tests | 2 tests |
| F15 | `about-story` | About / Story Section ("Prayog") | 5 tests | 5 tests | 1 test | 1 test |
| F16 | `footer-section` | Footer Section & Links | 5 tests | 5 tests | 1 test | 1 test |
| F17 | `spring-engine` | Analytical Spring Physics Engine | 5 tests | 5 tests | 2 tests | 1 test |
| F18 | `tactile-ctrl` | Tactile Pointerdown Controller | 5 tests | 5 tests | 2 tests | 1 test |
| F19 | `scroll-reveal` | 60fps Scroll Reveal Engine | 5 tests | 5 tests | 2 tests | 1 test |
| F20 | `offline-dual` | Dual-Protocol & Zero-Network Offline | 5 tests | 5 tests | 2 tests | 2 tests |
| **Total** | | | **100 tests** | **100 tests** | **35 tests** | **30 tests** |

**Grand Total**: **>= 265 test assertions** structured across four distinct verification tiers.

---

## 3. Four-Tier Test Architecture

### 3.1 Tier 1: Feature Coverage (>= 100 Tests)
Verifies structural existence, semantic tags, textual content, DOM element IDs, required section tags, and architectural integrity for each of the 20 features:
- **`tier1-features/test-f01-f05-foundation.js`**:
  - `F1`: `#nav-header`, brand badge `>_ PrayogCode`, nav links (`#features`, `#how-it-works`, `#tech-stack`, `#faq`, `#about`), primary CTA button.
  - `F2`: Font stack containing `-apple-system, BlinkMacSystemFont, "SF Pro Display"`, optical letter-spacing rules, deep dark base background `#08090d` / `#07090e`.
  - `F3`: Container max-width, fluid responsive padding, zero margin bleed.
  - `F4`: `.apple-glass-panel` rules, `backdrop-filter: blur(24px) saturate(190%)`, border highlight, no nested blur rules.
  - `F5`: Semantic header, main, section, footer tags, ARIA attributes, skip link or accessible targets.
- **`tier1-features/test-f06-f10-hero-sandbox.js`**:
  - `F6`: `#hero` container, display headline, tagline, primary CTA, secondary CTA.
  - `F7`: Monaco editor mockup chrome, traffic lights (`.dot-red`, `.dot-yellow`, `.dot-green`), file tab `main.c`, line numbers, syntax highlight classes (`.token-kw`, `.token-fn`, `.token-str`).
  - `F8`: xterm.js terminal mockup, terminal header, prompt line, simulated command, green exit code indicator.
  - `F9`: Multi-snippet selector controls for 4 C programs: `scanf` interactive input, Factorial recursion, Fibonacci sequence, Matrix multiplication.
  - `F10`: Interactive Run button (`#btn-run` or `.btn-run`), compile status badge, terminal output streaming simulation container.
- **`tier1-features/test-f11-f16-content-sections.js`**:
  - `F11`: `#features` section with 4 core capability cards: Monaco Editor, Real-Time PTY Terminal, Hardened Docker Sandbox, Zero Setup.
  - `F12`: `#how-it-works` 4-step walkthrough: Write Code -> Click Run -> Sandboxed Compilation -> Interactive Terminal Output.
  - `F13`: `#tech-stack` section featuring React 19, Monaco Editor, xterm.js, Node.js + Express, Docker Alpine, GCC 13.
  - `F14`: `#faq` accordion with 5+ `<details name="prayog-faq">` questions: Free status, Sandbox security, C standards, scanf interactivity, C specialization.
  - `F15`: `#about` section detailing the linguistic meaning of "Prayog" (प्रयोग = experiment in Hindi/Marathi) and mission.
  - `F16`: `<footer>` with GitHub repo link, contact email, copyright notice `© 2026 PrayogCode`, and tagline.
- **`tier1-features/test-f17-f20-physics-offline.js`**:
  - `F17`: `window.PrayogCode.SpringSolver` class presence, `solve(dt)`, critically damped $\zeta=1.0$, snappy $\zeta=0.8$.
  - `F18`: `window.PrayogCode.Tactile` module, `projectMomentum`, `calculateRubberband`, `VelocityTracker`, pointerdown depression.
  - `F19`: `window.PrayogCode.ScrollEngine` module, `IntersectionObserver` registration, `.is-revealed` class toggle.
  - `F20`: Relative paths (`./css/`, `./js/`, `./assets/`), `<script defer>`, zero external URLs.

### 3.2 Tier 2: Boundary & Corner Cases (>= 100 Tests)
Exercises edge cases, extreme inputs, layout breakpoints, and stress conditions:
- **`tier2-boundaries/test-responsive-viewports.js`**:
  - 375px mobile viewport: single-column flex/grid flow, no horizontal overflow, font-size clamp downscaling.
  - 768px tablet viewport: 2-column card layouts, wrapped header navigation or responsive toggle.
  - 1440px desktop viewport: full hero mockup above the fold (height <= 900px), multi-column grids.
- **`tier2-boundaries/test-typography-longtext.js`**:
  - Extreme text injection resilience (titles with 500 characters, code snippets with 100+ lines, long FAQ answers).
  - Preserved whitespace and word-break rules (`word-break: break-word`, `overflow-wrap: anywhere`).
  - Font scaling bounds (minimum font size >= 11px, display size <= 72px).
- **`tier2-boundaries/test-offline-security.js`**:
  - Zero external HTTP/HTTPS protocols in `index.html`, CSS stylesheets, and JS files.
  - Zero external fonts (Google Fonts, Typekit, CDN fonts).
  - Verification of self-hosted SVGs and system-native font stacks.
  - Safe inline SVG encoding without dangerous `eval` or `onload` vectors.
- **`tier2-boundaries/test-inputs-stress.js`**:
  - Rapid repeated clicks on Run button (debouncing & preventing concurrent duplicate execution animations).
  - Rapid toggling of FAQ details items (interrupting spring height transitions).
  - Snippet switching during active code execution simulation.
  - Boundary calculations for rubber-banding with extreme overshoot values ($\Delta = 10,000px$).
  - Closed-form spring stability under high $dt$ ($dt > 64ms$) and high initial velocity ($v_0 = 100,000px/s$).

### 3.3 Tier 3: Cross-Feature Interactions (>= 20 Tests)
Validates interplay between disparate modules and environmental states:
- **`tier3-interactions/test-interactions.js`**:
  - `prefers-reduced-motion` + Glassmorphism: Verifies that when motion is reduced, glass surfaces remain styled but transforms are nullified.
  - `prefers-reduced-transparency` + Dynamic Header Blur: Header transitions to solid `#161822` without `backdrop-filter`.
  - Navigation Anchor Click + Sticky Header: Target sections account for sticky nav height offset (`scroll-margin-top: 80px`).
  - Code Snippet Selector + Terminal Output: Changing snippet resets terminal state, loads matching code into Monaco view, and resets status indicator to "Ready".
  - Run Button + Terminal Stream: Pressing Run triggers status "Compiling...", streams GCC compile message, launches Docker Alpine sandbox, and streams realistic output.
  - FAQ Accordion + Exclusive Name Grouping: Expanding one FAQ item auto-closes others via native `<details name="prayog-faq">` or JavaScript coordinator.
  - Direct Manipulation Split Divider + Spring Snap: Releasing draggable divider snaps back to standard 50/50 split via spring solver.

### 3.4 Tier 4: Real-World Scenarios (>= 10 Scenarios)
Simulates end-to-end user journeys through the marketing site:
- **`tier4-scenarios/test-user-journeys.js`**:
  1. *Scenario 1: First-Time Visitor Journey* (Arrives at hero, reads headline, clicks primary CTA to launch editor).
  2. *Scenario 2: Curious Student Walkthrough* (Explores How It Works 4-step flow, switches code snippets, tests interactive scanf simulation).
  3. *Scenario 3: Senior Systems Engineer Audit* (Scrolls to Tech Stack, reviews Docker sandbox flags `--network none --read-only --cap-drop ALL`, inspects limits 100KB/15s/60s).
  4. *Scenario 4: Accessibility User with Reduced Motion* (Loads site with `prefers-reduced-motion: reduce`, navigates all sections, confirms zero transforms and instant opacity fades).
  5. *Scenario 5: Low-Vision User with High Contrast & Reduced Transparency* (Loads site with `prefers-reduced-transparency`, verifies solid high-contrast backgrounds and WCAG AA compliance).
  6. *Scenario 6: Mobile Touch User on 375px Device* (Navigates hero, taps CTA with instant `pointerdown` feedback, views stacked code/terminal split).
  7. *Scenario 7: Offline Air-Gapped Classroom User* (Loads `file:///C:/PrayogCode-Website/index.html` without internet connection, all assets, SVGs, typography, and interactive simulator function with 0 console errors).
  8. *Scenario 8: Educator Reviewing FAQs* (Expands each of the 5 FAQs, verifies comprehensive answers on safety, free status, compiler flags, and input handling).
  9. *Scenario 9: Open-Source Contributor Journey* (Follows footer GitHub repository link, reads About "Prayog" story, inspects operational status indicator).
  10. *Scenario 10: Performance & Core Web Vitals Auditor* (Measures DOM element counts, verifies zero layout shifts, verifies CSS hardware acceleration on `transform` and `opacity` only).

---

## 4. Test Runner Architecture

The test runner is built in pure Node.js (`C:\PrayogCode-Website\test\test-runner.js`) with an ergonomic, zero-dependency testing micro-harness.

### 4.1 Directory Structure
```
C:\PrayogCode-Website\test\
├── test-runner.js                         # Master CLI test runner
├── helpers/
│   ├── harness.js                         # Lightweight BDD suite/test harness (describe, test, expect)
│   ├── dom-parser.js                      # HTML5 tokenizer & querySelector DOM inspector
│   ├── css-parser.js                      # CSS parser for media queries, rules, tokens & properties
│   ├── physics-verifier.js                # Spring solver verification and numerical accuracy checks
│   ├── offline-auditor.js                 # Network link scanner (regex & AST)
│   └── headless-verifier.js               # Headless Chrome execution wrapper
├── tier1-features/
│   ├── test-f01-f05-foundation.js         # Nav, Typography, Layout, Glass, Accessibility
│   ├── test-f06-f10-hero-sandbox.js       # Hero, Monaco, Terminal, Snippets, Run Button
│   ├── test-f11-f16-content-sections.js   # Features, Steps, Tech, FAQ, About, Footer
│   └── test-f17-f20-physics-offline.js    # Spring, Tactile, Scroll, Offline Dual-Protocol
├── tier2-boundaries/
│   ├── test-responsive-viewports.js       # 375px, 768px, 1024px, 1440px layout breakpoints
│   ├── test-typography-longtext.js        # Overflow, optical tracking, clamp boundaries
│   ├── test-offline-security.js           # Zero CDN, zero remote font, secure SVGs
│   └── test-inputs-stress.js              # Rapid clicks, extreme physics inputs, debouncing
├── tier3-interactions/
│   └── test-interactions.js               # 20+ cross-feature integration tests
└── tier4-scenarios/
    └── test-user-journeys.js              # 10 comprehensive user scenario simulations
```

### 4.2 Runner Mechanics & Output Reporting
Execution command:
```powershell
node C:\PrayogCode-Website\test\test-runner.js
```

The runner:
1. Dynamically discovers and loads all test files across Tiers 1 through 4.
2. Executes tests asynchronously with precise high-resolution timing (`performance.now()`).
3. Streams formatted ANSI color progress:
   - Green checkmarks (`✔`) for passing tests.
   - Red crosses (`✖`) with contextual stack traces and expectation diffs for failures.
4. Outputs a structured summary table breaking down:
   - Tier 1: Feature Coverage (Total, Passed, Failed)
   - Tier 2: Boundary & Corner Cases (Total, Passed, Failed)
   - Tier 3: Cross-Feature Interactions (Total, Passed, Failed)
   - Tier 4: Real-World Scenarios (Total, Passed, Failed)
   - Total Suite Statistics and Execution Time.
5. Exit code contract:
   - `0` if 100% of tests pass.
   - `1` if any test fails.

---

## 5. Quality Thresholds & Acceptance Criteria

| Metric | Required Threshold | Verification Tool |
|---|:---:|---|
| **Tier 1 Tests** | $\ge 100$ tests | `test-runner.js` |
| **Tier 2 Tests** | $\ge 100$ tests | `test-runner.js` |
| **Tier 3 Tests** | $\ge 20$ tests | `test-runner.js` |
| **Tier 4 Scenarios** | $\ge 10$ scenarios | `test-runner.js` |
| **Total Test Count** | $\ge 230$ tests (Matrix provides $\ge 265$) | `test-runner.js` |
| **Suite Pass Rate** | $100\%$ | Exit code 0 |
| **External Network URLs** | $0$ (zero remote scripts/fonts/styles) | `test-offline-security.js` |
| **Console Errors** | $0$ errors on `file://` and `http://` | `headless-verifier.js` |
| **Execution Performance** | Full suite completes in $< 10$ seconds | Runner benchmark |
| **Dependencies** | $0$ external `npm` packages | Node.js standard runtime |
