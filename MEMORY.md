# PrayogCode — Codebase Memory

> **Last updated:** 2026-09-14
> **Project name:** PrayogCode ("Prayog" = Experiment in Hindi/Marathi)
> **Purpose:** An online C programming IDE/laboratory — write C code in a Monaco editor, compile and run it on a Node.js backend via GCC and `node-pty`, and interact with the running program through an interactive xterm.js web terminal.

---

## Architecture Overview

```
┌──────────────────────────┐        WebSocket (ws://localhost:3000)        ┌────────────────────────────┐
│       FRONTEND           │ ◄──────────────────────────────────────────► │         BACKEND            │
│  React + TypeScript      │   Messages: run, stop, input, stdout,       │  Express + ws (WebSocket)  │
│  Vite dev server (:5173) │             stderr, error, exit, stopped,   │  Port 3000                 │
│  Monaco Editor           │             timeout                         │  node-pty pseudo-terminal  │
│  xterm.js + FitAddon     │                                              │  wsl.exe + GCC             │
└──────────────────────────┘                                              └────────────────────────────┘
```

**Monorepo structure** with three top-level directories and no workspace/package manager orchestration (no root package.json).

---

## Directory & File Map

```
PrayogCode/
├── .gitignore                  # Ignores node_modules, .env, temp/, dist/, build/, compiled binaries
│
├── backend/                    # Node.js backend (CommonJS)
│   ├── package.json            # express 5, cors, ws, node-pty, uuid; devDep: nodemon
│   ├── server.js               # Express + WebSocket server (port 3000), manages pty process lifecycle
│   └── compiler.js             # Writes C source to temp dir, compiles with GCC in WSL, returns executable path
│
├── frontend/                   # React SPA (TypeScript, ESM)
│   ├── package.json            # react 19, @monaco-editor/react, @xterm/xterm, @xterm/addon-fit
│   ├── vite.config.ts          # Minimal — just @vitejs/plugin-react
│   ├── tsconfig.json           # Project references to tsconfig.app.json & tsconfig.node.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── eslint.config.js
│   ├── index.html              # Vite entry
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   └── src/
│       ├── main.tsx            # React root — renders <App /> in StrictMode
│       ├── App.tsx             # Main component — Monaco editor + interactive xterm.js terminal
│       ├── App.css             # Dark-theme layout: header, 60/40 grid (editor | xterm terminal)
│       ├── index.css           # Base styles
│       └── assets/
│           ├── hero.png
│           ├── react.svg
│           └── vite.svg
│
└── test-client/                # Standalone HTML test page (vanilla JS)
    └── index.html              # Bare-bones textarea + terminal that connects to ws://localhost:3000
```

---

## Tech Stack

| Layer     | Technology                    | Version   | Notes                                              |
|-----------|-------------------------------|-----------|----------------------------------------------------|
| Frontend  | React                         | 19.2.8    | Single `App` component                             |
| Frontend  | TypeScript                    | ~6.0.2    |                                                    |
| Frontend  | Vite                          | 8.3.0     | Dev server, HMR                                    |
| Frontend  | Monaco Editor                 | 4.7.0     | `@monaco-editor/react`, `vs-dark` theme            |
| Frontend  | xterm.js                      | ^6.0.0    | `@xterm/xterm` interactive terminal emulator       |
| Frontend  | xterm FitAddon                | ^0.11.0   | `@xterm/addon-fit` auto-fits terminal to panel     |
| Backend   | Node.js + Express             | 5.2.1     | CommonJS modules                                   |
| Backend   | ws                            | 8.21.3    | WebSocket server attached to HTTP server           |
| Backend   | node-pty                      | ^1.1.0    | Pseudo-terminal for interactive CLI I/O and echoes |
| Backend   | GCC                           | system    | In WSL (Ubuntu)                                    |
| Backend   | nodemon                       | 3.1.14    | Dev dependency for auto-restart                    |

---

## WebSocket Protocol

All messages are JSON. The WebSocket endpoint is `ws://localhost:3000`.

### Client → Server

| `type`   | Payload            | Description                                              |
|----------|--------------------|----------------------------------------------------------|
| `"run"`  | `{ code: string }` | Send C source code to compile and execute in pty         |
| `"stop"` | `{}`               | Terminate the currently running process                  |
| `"input"`| `{ data: string }` | Send raw keystrokes/data directly from xterm `onData`    |

### Server → Client

| `type`     | Payload            | Description                                    |
|------------|--------------------|------------------------------------------------|
| `"stdout"` | `{ data: string }` | PTY stdout chunk (written to xterm)            |
| `"stderr"` | `{ data: string }` | Stderr chunk                                   |
| `"error"`  | `{ data: string }` | Compilation error (written to xterm)           |
| `"exit"`   | `{ code: number }` | Process exit code (written to xterm)           |
| `"stopped"`| `{ data: string }` | Program terminated gracefully on Stop request  |
| `"timeout"`| `{ data: string }` | Execution limit exceeded (60s inactivity limit)|

---

## Interactive Terminal & Stdin Handling

1. User clicks **"▶ Run"**. Frontend sends `{ type: "run", code }`.
2. Backend runs `compileC(code)` with GCC in WSL.
3. On success, backend spawns the compiled executable inside a `node-pty` session (`wsl.exe -- <executable>`).
4. **Terminal sequence filtering**:
   - ConPTY / WSL emits `\x1b[?1004h` (focus tracking). Backend filters this out from `stdout` so xterm does not activate focus tracking.
   - Frontend and backend filter out any stray `\x1b[I` / `\x1b[O` focus events from `input` so they never corrupt stdin operations like `scanf()`, `getchar()`, or `fgets()`.
5. **Interactive Delay & Inactivity Timeout**:
   - The 60-second execution timer protects against infinite loops (`while(1)`).
   - Each time the user enters input, the inactivity timer resets, allowing arbitrary delays while a user thinks between inputs.
6. **Graceful Stop Handling**:
   - Clicking "Stop" sets a `stoppedByUser` flag and terminates the process.
   - The server sends `{ type: "stopped" }` instead of reporting raw Windows exit code `-1073741510` (`0xC000013A` / `STATUS_CONTROL_C_EXIT`).

---

## How to Run

```bash
# Backend (requires WSL + GCC on PATH)
cd backend
npm install
node server.js          # or: npx nodemon server.js

# Frontend
cd frontend
npm install
npm run dev             # Vite dev server at http://localhost:5173
```
