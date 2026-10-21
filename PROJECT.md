# Project: PrayogCode Marketing & Product Landing Website

## Architecture
- **Paradigm**: Zero-Build Modular Vanilla Web Architecture (Semantic HTML5, CSS3 Custom Properties & Glassmorphism, Vanilla ES5/ES6 Scripts with `defer` executing under `window.PrayogCode`).
- **Protocols Supported**: Dual-protocol verified: `file:///C:/PrayogCode-Website/index.html` (zero build step, direct double-click) AND `http://localhost:<port>` (`npx serve`, local static server).
- **Physics Engine**: Closed-form analytical spring solver ($1.0$ critically damped, $0.80$ tactile drawer/sheet snap, $0.85$ card drag momentum).
- **Typography**: Apple Optical System Font Stack (`-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, "Segoe UI", Roboto`) with negative tracking for large display headers and positive tracking for badges.
- **Glass Materials**: Apple Dark Mode Translucent Glass panels (`rgba(30, 30, 30, 0.7)` with `backdrop-filter: blur(24px) saturate(190%)` and 1px border reflection; fallback to solid `#161822` under `prefers-reduced-transparency`).
- **Accessibility**: Full `@media (prefers-reduced-motion: reduce)` disabling transforms with instant opacity fallbacks, and `@media (prefers-reduced-transparency: reduce)` disabling blurs.

## Code Layout
Target Directory: `C:\PrayogCode-Website\`
- `index.html` — Master semantic document containing all 7 sections, navigation, hero, interactive lab simulation, features, how it works, tech stack, FAQ, about blurb, and footer.
- `css/`
  - `tokens.css` — Apple design tokens, colors (dark `#090a0f`, deep slate `#11141f`, accents `#38bdf8`, `#3fb950`, `#a855f7`), typography scales, optical tracking, glass variables.
  - `layout.css` — Reset, container, responsive grid (375px mobile to 1440px+ desktop), sticky navigation bar with blur mask.
  - `components.css` — Hero mockup, split editor/terminal sandbox, feature cards, step cards, tech cards, FAQ `<details>` accordion, buttons, badges, footer.
  - `animations.css` — Apple spring animation keyframes, scroll reveal states, reduced-motion overrides, reduced-transparency overrides.
- `js/`
  - `spring.js` — Analytical physics engine (undamped, critically damped, overdamped spring solver, velocity handoff, momentum projection).
  - `tactile.js` — Tactile interaction controller (instant `pointerdown` response, pointer capture, rolling velocity buffer, rubber-banding math).
  - `scroll.js` — `IntersectionObserver`-based scroll reveal engine with hardware-accelerated transforms (60fps in Chrome, Edge, and Firefox).
  - `interactive-lab.js` — Live simulation of Monaco editor + xterm.js interactive terminal with preloaded C programs (Scanf input, Factorial, Fibonacci, Matrix Multiply), Run button, and realistic output.
  - `faq.js` — Native `<details name="prayog-faq">` exclusive accordion controller with smooth spring toggle.
  - `app.js` — Main bootstrap coordinator namespaced under `window.PrayogCode`.
- `assets/`
  - Inline/local SVGs for icons (Monaco, terminal, Docker, GCC, lightning, shields, checkmarks, Apple-style chevron, GitHub).
- `test/`
  - `verify-offline.js` — Static audit verifying zero external network dependencies/CDNs/fonts.
  - `verify-dom.js` — Headless Chrome/DOM structural test verifying all 7 sections, 4 features, 5 FAQs, and accessibility attributes.
  - `verify-physics.js` — Unit tests for analytical spring equations and rubber-banding math.
  - `test-runner.js` — Master test runner for E2E test suite.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Sticky Apple Glass Nav | Translucent navigation bar with brand badge `>_ PrayogCode`, nav links, and CTA | M1 | Survey |
| 2 | Optical Typography & Dark Scheme | SF Pro system font stack, clamp font sizes, optical tracking (-0.03em to +0.025em), WCAG AA contrast | M1 | Survey |
| 3 | Responsive Shell Layout | Mobile-first 375px to 1440px+ container system, fluid gutters, zero layout shift | M1 | Survey |
| 4 | Glassmorphism Material System | `backdrop-filter: blur(24px) saturate(190%)` panels with 1px border reflection | M1 | Survey |
| 5 | Accessibility Foundation | `prefers-reduced-motion` and `prefers-reduced-transparency` media query support | M1 | Survey |
| 6 | Hero Section Layout | Above-the-fold at 1440px, bold display headline, concise tagline, primary CTA & secondary link | M2 | Survey |
| 7 | Monaco Split UI Mockup | VS Code-style editor interface with syntax highlighting, line numbers, status bar | M2 | Survey |
| 8 | Interactive Terminal Simulation | Realistic xterm.js style terminal with prompt, input execution, exit code 0 | M2 | Survey |
| 9 | Multi-Snippet Code Switcher | Interactive selector: Interactive `scanf` input, Factorial recursion, Fibonacci, Matrix Multiply | M2 | Survey |
| 10 | Real-Time Run Execution | Instant tactile Run button, compile spinner/status, realistic output streaming | M2 | Survey |
| 11 | Features Section Cards | 4 key capabilities: Monaco Editor, Real-Time PTY Terminal, Hardened Docker Sandbox, Zero Setup | M3 | Survey |
| 12 | How It Works 4-Step Walkthrough | Visual steps: Write Code -> Click Run -> Compile in Sandbox -> See Output in Terminal | M3 | Survey |
| 13 | Tech Stack / Under the Hood | Developer architecture cards: React 19, Monaco, xterm.js, Node.js+Express, Docker Alpine, GCC 13 | M3 | Survey |
| 14 | Technical FAQ Accordion | 5+ comprehensive FAQs (Free?, Safe?, C standard?, scanf input?, Why C only?) with native `<details>` | M3 | Survey |
| 15 | About / Story Section | "Prayog" meaning experiment in Hindi/Marathi, mission for accessible systems programming | M3 | Survey |
| 16 | Footer Section | GitHub repo link, contact/email, copyright notice, and tagline | M3 | Survey |
| 17 | Analytical Spring Engine | Closed-form $\zeta=1.0, 0.8, 0.85$ physics solver with interruptibility and momentum projection | M4 | Survey |
| 18 | Tactile Pointerdown Controller | Instantaneous depression response, `setPointerCapture`, rolling velocity buffer, rubber-banding | M4 | Survey |
| 19 | 60fps Scroll Reveal Engine | Hardware-accelerated `IntersectionObserver` reveals with velocity inheritance and smooth entrance | M4 | Survey |
| 20 | Dual-Protocol & Zero-Network Offline Guarantee | 100% offline functionality, runs on `file://` and `http://` with 0 console errors | M5 | Survey |
| 21 | E2E Test Suite & Test Runner | Automated test harness executing Tiers 1-4 tests, DOM audits, and offline validation | E2E-Track | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Test infra, Tier 1 Feature tests, Tier 2 Boundary tests, Tier 3 Cross-feature tests, Tier 4 Real-world tests, `TEST_READY.md` | none | DONE (TEST_READY.md published, 235/235 tests pass) |
| 1 | M1: Design System & Shell | `index.html` shell, `css/tokens.css`, `css/layout.css`, `css/components.css`, `css/animations.css`, typography, glass tokens, responsive grid | none | DONE (Gate Iteration 2 PASS: Clean Audit, 100% Tests) |
| 2 | M2: Hero & Interactive Sandbox | Hero section above the fold, Monaco/Terminal split UI, `js/interactive-lab.js`, multi-snippet switcher, compile/run simulation | M1 | DONE (Implemented in index.html & js/interactive-lab.js) |
| 3 | M3: Core Content Sections | Features cards, How It Works 4 steps, Under the Hood tech cards, FAQ `<details>` accordion, About blurb, Footer | M1 | DONE (Implemented across index.html & CSS modules) |
| 4 | M4: Apple Motion & Tactile Craft | `js/spring.js`, `js/tactile.js`, `js/scroll.js`, `js/faq.js`, `js/app.js`, sticky header blur mask, rubber-band bounds, accessibility | M2, M3 | DONE (Implemented in js/ modules & animations.css) |
| 5 | M5: E2E Verification & Hardening | Full integration, verify all Tier 1–4 tests pass 100%, Tier 5 adversarial coverage hardening, headless Chrome audit | M4, E2E | DONE (235/235 Master Tests, 20/20 Challenger 1, 32/32 Challenger 2) |

## Interface Contracts
### `index.html` ↔ CSS Modules
- `#nav-header`: sticky top navigation with `.apple-glass-panel` and dynamic scroll mask.
- `#hero`: Hero section with `.hero-container`, `.hero-title`, `.hero-cta-group`, `.hero-mockup`.
- `#features`: Grid of 4 `.feature-card` elements with icons, titles, and technical descriptions.
- `#how-it-works`: 4 `.step-card` items connected with visual progression markers.
- `#tech-stack`: Architecture grid with `.tech-badge` and detailed security/specs cards.
- `#faq`: Container with `<details name="prayog-faq" class="faq-item">` elements.
- `#about`: Story card explaining "Prayog" and project philosophy.
- `#footer`: Semantic `<footer>` with links, contact, and copyright.

### Window Namespace Contract: `window.PrayogCode`
- `window.PrayogCode.Spring`: `{ createSpring(options), solve(t), projectMomentum(v, decel) }`
- `window.PrayogCode.Tactile`: `{ attach(element, options), calculateRubberband(overshoot, dimension, c) }`
- `window.PrayogCode.Scroll`: `{ initScrollReveals(selector, options) }`
- `window.PrayogCode.Lab`: `{ initLab(containerId, options), switchSnippet(id), runCode() }`
- `window.PrayogCode.FAQ`: `{ initFAQ(containerId) }`
- `window.PrayogCode.App`: `{ init() }` — Coordinates module bootstrapping on `DOMContentLoaded`.

### Protocol & File System Guarantee
- All paths referenced in `index.html` are strictly relative (`./css/...`, `./js/...`, `./assets/...`).
- No external HTTP/HTTPS CDN URLs in any HTML, CSS, or JS file.
- All scripts use `<script defer src="...">` to ensure non-blocking execution and 100% compatibility with Chrome/Edge/Firefox under `file:///`.
