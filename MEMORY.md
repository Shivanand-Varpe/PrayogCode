# PrayogCode — Codebase Memory

> **Last updated:** 2026-10-18  
> **Project name:** PrayogCode ("Prayog" = Experiment in Hindi/Marathi)  
> **Purpose:** An online C programming laboratory — write C code in a Monaco editor, compile and run it in an isolated, hardened Docker Alpine Linux sandbox via `node-pty`, and interact with the running program in real time through an interactive xterm.js web terminal.

---

## Architecture Overview

```
┌────────────────────────────────┐        WebSocket (/ws or :3000)        ┌───────────────────────────────────┐
│           FRONTEND             │ ◄────────────────────────────────────► │             BACKEND               │
│  React 19 + TypeScript         │  Messages:                             │  Node.js + Express 5 + ws         │
│  Vite dev server (:5173)       │  Client -> Server: run, stop, input    │  Port 3000                        │
│  Monaco Editor (vs-dark)       │  Server -> Client: stdout, error,      │  node-pty (interactive PTY)       │
│  xterm.js + FitAddon           │                    exit, stopped,      │  dockerRunner.js                  │
│  convertEol: true              │                    timeout             │  (Never falls back to host/WSL)   │
└────────────────────────────────┘                                        └─────────────────┬─────────────────┘
                                                                                            │ Docker CLI / PTY
                                                                                            ▼
                                                                          ┌───────────────────────────────────┐
                                                                          │         DOCKER SANDBOX            │
                                                                          │  Image: prayogcode-c-runner       │
                                                                          │  Base: Alpine Linux 3.20          │
                                                                          │  Compiler: GCC + musl-dev         │
                                                                          │  Unbuffered: /etc/prayog/init.h   │
                                                                          │  Non-root: prayog (uid 1000)      │
                                                                          │  Network: --network none          │
                                                                          │  Rootfs: --read-only              │
                                                                          │  Tmpfs: /tmp (64MB)               │
                                                                          │  Cgroups: 1 CPU, 128MB, 64 PIDs   │
                                                                          │  Caps: --cap-drop ALL             │
                                                                          └───────────────────────────────────┘
```

**Monorepo structure** with three core folders: `frontend/`, `backend/`, and `execution/`.

---

## Directory & File Map

```
PrayogCode/
├── .gitignore                  # Ignores node_modules, temp/, dist/, build/, compiled binaries (*.exe, *.o, *.obj, *.out, test)
├── CNAME                       # Custom domain mapping
├── MEMORY.md                   # Central architectural & operational memory
│
├── backend/                    # Node.js backend (CommonJS)
│   ├── package.json            # express 5, cors, ws, node-pty; devDep: nodemon; scripts: start, dev, test
│   ├── server.js               # Express + WebSocket server (port 3000), session lifecycle, limits & timeouts
│   ├── dockerRunner.js         # Docker sandbox manager (compileInDocker with gcc, runInDocker with node-pty)
│   ├── test-docker-runner.js   # Unit test for Docker compiler and runner
│   ├── test-stage2-5.js        # Stage 2.5 test suite (WS protocol & limits)
│   ├── test-stage3-2.js        # Stage 3.2 test suite (Docker sandbox integration)
│   └── test-stage3-3.js        # Stage 3.3 test suite (Hardened Docker sandbox verification)
│
├── execution/                  # Docker container definition & sandbox assets
│   ├── Dockerfile              # Alpine 3.20 + GCC + musl-dev, unbuffered init.h, unprivileged prayog user
│   ├── README.md               # Detailed sandbox documentation and verification tests
│   └── test/                   # Standalone verification programs
│       ├── hello.c             # Basic output test
│       ├── input.c             # Interactive scanf test
│       └── loop.c              # Inactivity & timeout test
│
└── frontend/                   # React SPA (TypeScript, ESM)
    ├── package.json            # react 19, @monaco-editor/react, @xterm/xterm, @xterm/addon-fit, lucide-react
    ├── vite.config.ts          # Minimal Vite configuration with @vitejs/plugin-react
    ├── tsconfig.json           # Project references to tsconfig.app.json & tsconfig.node.json
    ├── tsconfig.app.json
    ├── tsconfig.node.json
    ├── eslint.config.js
    ├── index.html              # Vite entry
    ├── public/
    │   └── favicon.svg         # PrayogCode favicon
    └── src/
        ├── main.tsx            # React root — renders <App /> in StrictMode
        ├── App.tsx             # Main component — Monaco editor, xterm.js terminal, WebSocket lifecycle & auto-reconnect
        ├── App.css             # Modern dark-theme split layout (editor | terminal)
        └── index.css           # Global reset and typography
```

---

## Tech Stack

| Layer     | Technology                    | Version   | Notes                                                          |
|-----------|-------------------------------|-----------|----------------------------------------------------------------|
| Frontend  | React                         | 19.2.8    | Single `App` component with clean hooks & refs                 |
| Frontend  | TypeScript                    | ~6.0.2    | Strict typing                                                  |
| Frontend  | Vite                          | 8.3.0     | Dev server & production bundler                                |
| Frontend  | Monaco Editor                 | 4.7.0     | `@monaco-editor/react`, `vs-dark` theme                        |
| Frontend  | xterm.js                      | ^6.0.0    | `@xterm/xterm` with `convertEol: true` for clean line endings  |
| Frontend  | xterm FitAddon                | ^0.11.0   | `@xterm/addon-fit` auto-fits terminal to container container   |
| Backend   | Node.js + Express             | 5.2.1     | CommonJS modules, handles healthcheck and WebSocket server     |
| Backend   | ws                            | 8.21.3    | WebSocket server attached to HTTP server                       |
| Backend   | node-pty                      | ^1.1.0    | Pseudo-terminal session manager driving `docker run -i -t`     |
| Backend   | nodemon                       | 3.1.14    | Dev dependency for backend auto-restart                        |
| Sandbox   | Docker Engine                 | >= 24.0   | Isolated container execution (`prayogcode-c-runner:latest`)    |
| Sandbox   | Alpine Linux                  | 3.20      | Minimal base image (~157 MB total)                             |
| Sandbox   | GCC + musl libc               | 13.2.1    | Direct invocation (`gcc -O2 -Wall -Wextra`)                    |

---

## WebSocket Protocol

All messages are JSON strings. Endpoint: `ws://localhost:3000` (or `${protocol}//${window.location.host}/ws` in production).

### Client → Server

| `type`   | Payload            | Description                                              |
|----------|--------------------|----------------------------------------------------------|
| `"run"`  | `{ code: string }` | Send C source code to compile and execute in container   |
| `"stop"` | `{}`               | Terminate the currently running compilation or container |
| `"input"`| `{ data: string }` | Send raw keystrokes/data from xterm `onData`             |

### Server → Client

| `type`     | Payload            | Description                                              |
|------------|--------------------|----------------------------------------------------------|
| `"stdout"` | `{ data: string }` | PTY stdout chunk (written to xterm)                      |
| `"error"`  | `{ data: string }` | Compilation or server error (written to xterm)           |
| `"exit"`   | `{ code: number }` | Process exit code (written to xterm)                     |
| `"stopped"`| `{ data: string }` | Program terminated on user Stop request                  |
| `"timeout"`| `{ data: string }` | Execution limit exceeded (60s inactivity limit)          |

*(Note: `"stderr"` is deprecated and removed; runtime and compiler output is unified via PTY stdout or sent via `"error"`).*

---

## Security Controls & Sandboxing

PrayogCode enforces multi-layer isolation on all user-submitted code:

1. **Docker Hardened Sandbox**:
   - `prayogcode-c-runner:latest` built from `execution/Dockerfile` (Alpine 3.20).
   - **Non-root execution**: Runs under unprivileged user `prayog` (`uid=1000`, `gid=1000`).
   - **Network isolation**: `--network none` (outgoing/incoming network completely blocked).
   - **Read-only filesystem**: `--read-only` rootfs prevents modification of system binaries or libraries.
   - **Ephemeral tmpfs**: In-memory writable `/tmp` (`--tmpfs /tmp:rw,exec,nosuid,size=64m`).
   - **Source isolation**: Workspace mounted read-only (`-v ...:/workspace:ro`) during execution.
   - **Resource caps**:
     - `--cpus 1`: Maximum 1 CPU core.
     - `--memory 128m`: Maximum 128 MB RAM.
     - `--pids-limit 64`: Capped at 64 processes (prevents fork-bombs).
   - **Privilege & Capabilities**:
     - `--cap-drop ALL`: All Linux kernel capabilities dropped.
     - `--security-opt no-new-privileges:true`: Prevents privilege escalation.
   - **Direct binary invocation**: No shell wrapper (`sh -c`) when launching the compiled binary.
   - **Deterministic cleanup**: Unique container names (`prayog-cmp-*`, `prayog-run-*`) allow immediate force removal (`docker rm -f`) on stop/disconnect.

2. **Unbuffered Stdio Hook**:
   - Container includes `/etc/prayog/init.h` with a constructor function:
     ```c
     void __attribute__((constructor)) __init_unbuffered(void) {
         setvbuf(stdout, NULL, _IONBF, 0);
         setvbuf(stderr, NULL, _IONBF, 0);
     }
     ```
   - Compiled with `-include /etc/prayog/init.h`, ensuring interactive prompts (e.g. `printf("Enter name: ")`) flush immediately before `scanf()` without requiring manual `fflush(stdout)`.

3. **Resource & Abuse Limits**:
   - **Max Source Code Size**: 100 KB.
   - **Max Compilation Time**: 15 seconds.
   - **Max Execution Time**: 60 seconds (resets on user input to allow interactive thinking time).
   - **Max Stdout Volume**: 1 MB (prevents terminal flooding from infinite print loops).
   - **Max Stdin Payload**: 64 KB per message.

4. **Terminal Formatting & Lifecycle**:
   - `convertEol: true` in xterm.js ensures `\n` is rendered as `\r\n` without staircase formatting.
   - ConPTY / PTY focus tracking sequences (`\x1b[?1004h`, `\x1b[?1004l`, `\x1b[I`, `\x1b[O`) are filtered out to prevent stdin corruption.
   - Frontend auto-reconnects on tab resume (`visibilitychange`/`focus`) if connection dropped while idle, avoiding stuck "Connecting..." states.

---

## How to Run

### 1. Build the Docker Execution Image

```powershell
# From project root
docker build -t prayogcode-c-runner execution
```

### 2. Start the Backend

```powershell
cd backend
npm install
npm start          # Runs 'node server.js' (or 'npm run dev' for nodemon)
```

### 3. Start the Frontend

```powershell
cd frontend
npm install
npm run dev        # Vite dev server at http://localhost:5173
```

### 4. Running Backend Verification Tests

```powershell
# In backend directory (with backend server running on port 3000 & Docker active)
npm test           # Runs 'node test-stage3-3.js'
```
