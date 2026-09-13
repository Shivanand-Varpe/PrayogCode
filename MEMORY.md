# PrayogCode — Codebase Memory

> **Last updated:** 2026-09-14
> **Project name:** PrayogCode ("Prayog" = Experiment in Hindi/Marathi)
> **Purpose:** An online C programming IDE/laboratory — write C code in a Monaco editor, compile and run it on a Node.js backend via GCC and `node-pty`, and interact with the running program through an interactive xterm.js web terminal.

---

## Architecture Overview

```
┌──────────────────────────┐        WebSocket (ws://localhost:3000)        ┌────────────────────────────┐
│       FRONTEND           │ ◄──────────────────────────────────────────► │         BACKEND            │
│  React + TypeScript      │   Messages: run, input, stdout, stderr,     │  Express + ws (WebSocket)  │
│  Vite dev server (:5173) │            error, exit                      │  Port 3000                 │
│  Monaco Editor           │                                              │  node-pty pseudo-terminal  │
│  xterm.js + FitAddon     │                                              │  GCC compiler              │
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
│   └── compiler.js             # Writes C source to temp dir, compiles with GCC, returns executable path
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
| Backend   | GCC                           | system    | Must be installed on PATH                          |
| Backend   | nodemon                       | 3.1.14    | Dev dependency for auto-restart                    |

---

## WebSocket Protocol

All messages are JSON. The WebSocket endpoint is `ws://localhost:3000`.

### Client → Server

| `type`   | Payload            | Description                                              |
|----------|--------------------|----------------------------------------------------------|
| `"run"`  | `{ code: string }` | Send C source code to compile and execute in pty         |
| `"input"`| `{ data: string }` | Send raw keystrokes/data directly from xterm `onData`    |

### Server → Client

| `type`     | Payload            | Description                                  |
|------------|--------------------|----------------------------------------------|
| `"stdout"` | `{ data: string }` | PTY stdout chunk (written to xterm)          |
| `"stderr"` | `{ data: string }` | Stderr chunk                                 |
| `"error"`  | `{ data: string }` | Compilation error (written to xterm)         |
| `"exit"`   | `{ code: number }` | Process exit code (written to xterm)         |

---

## Interactive Terminal Flow

1. User clicks **"▶ Run"**. Frontend sends `{ type: "run", code }`.
2. Backend runs `compileC(code)` with GCC.
3. On success, backend spawns the compiled executable inside a `node-pty` session (`xterm-color`, 100 cols x 30 rows).
4. `runningProcess.onData` sends stdout packets over WebSocket.
5. Frontend calls `term.write(message.data)` to render stdout, including ANSI colors, cursor positioning, and interactive prompts (e.g. `Enter two numbers: `).
6. As the user types in xterm, `term.onData` captures keystrokes and transmits `{ type: "input", data }` over WebSocket.
7. Frontend does **not** echo keystrokes locally; the backend PTY echoes them back automatically in stdout.
8. When the process finishes, backend emits `exit` event with code; frontend displays `Process exited with code X`.

---

## How to Run

```bash
# Backend (requires GCC on PATH)
cd backend
npm install
node server.js          # or: npx nodemon server.js

# Frontend
cd frontend
npm install
npm run dev             # Vite dev server at http://localhost:5173
```
