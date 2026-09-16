import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./App.css";

type AppState = "IDLE" | "COMPILING" | "RUNNING" | "FINISHED" | "ERROR";

const DEFAULT_C_CODE = `#include <stdio.h>

int main() {
    int a, b;

    printf("Enter two numbers: ");
    scanf("%d %d", &a, &b);

    printf("Sum = %d\\n", a + b);

    return 0;
}`;

function App() {
  const [code, setCode] = useState(DEFAULT_C_CODE);
  const [appState, setAppState] = useState<AppState>("IDLE");
  const [connected, setConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [mobileTab, setMobileTab] = useState<"CODE" | "TERMINAL">("CODE");

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Initialize xterm and WebSocket
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 13,
      fontFamily: "'JetBrains Mono', Consolas, Menlo, Monaco, monospace",
      lineHeight: 1.45,
      theme: {
        background: "#101115",
        foreground: "#d4d4d8",
        cursor: "#38bdf8",
        cursorAccent: "#101115",
        selectionBackground: "rgba(0, 122, 204, 0.4)",
        black: "#16181d",
        red: "#f85149",
        green: "#3fb950",
        yellow: "#e3b341",
        blue: "#38bdf8",
        magenta: "#bc8cff",
        cyan: "#56d4dd",
        white: "#e6edf3",
        brightBlack: "#484f58",
        brightRed: "#ff7b72",
        brightGreen: "#56d364",
        brightYellow: "#e3b341",
        brightBlue: "#79c0ff",
        brightMagenta: "#d2a8ff",
        brightCyan: "#7ee787",
        brightWhite: "#ffffff",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    terminal.current = term;
    fitAddonRef.current = fitAddon;

    // Show initial Stitch empty state
    term.writeln("\x1b[90mRun your C program to see the output here.\x1b[0m");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    ws.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("Backend message:", message);

      if (message.type === "stdout") {
        // Once output is emitted, ensure state is RUNNING
        setAppState("RUNNING");
        setStatusMessage("Running");
        term.write(message.data);
      } else if (message.type === "stderr") {
        term.write(message.data);
      } else if (message.type === "exit") {
        term.writeln("");
        if (message.code === 0) {
          term.writeln(`\x1b[32mProcess exited with code ${message.code}\x1b[0m`);
          setAppState("FINISHED");
          setStatusMessage("Exit Code: 0");
        } else {
          term.writeln(`\x1b[31mProcess exited with code ${message.code}\x1b[0m`);
          setAppState("ERROR");
          setStatusMessage(`Exit Code: ${message.code}`);
        }
      } else if (message.type === "stopped") {
        term.writeln("");
        term.writeln(`\x1b[33m${message.data || "Program stopped."}\x1b[0m`);
        setAppState("FINISHED");
        setStatusMessage("Stopped");
      } else if (message.type === "timeout") {
        term.writeln("");
        term.writeln(`\x1b[31m${message.data || "Time Limit Exceeded (60 seconds)"}\x1b[0m`);
        setAppState("ERROR");
        setStatusMessage("Timeout");
      } else if (message.type === "error") {
        term.writeln("");
        term.writeln(`\x1b[31m${message.data}\x1b[0m`);
        setAppState("ERROR");
        setStatusMessage("Error");
      }
    };

    socket.onerror = () => {
      console.log("WebSocket error");
      setConnected(false);
      setAppState("ERROR");
      setStatusMessage("Disconnected");
      term.writeln("\x1b[31mCould not connect to compiler backend.\x1b[0m");
    };

    socket.onclose = () => {
      console.log("WebSocket closed");
      setConnected(false);
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "input",
            data: data,
          })
        );
      }
    });

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {
        // Ignore resize before container rendered
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      socket.close();
      term.dispose();
    };
  }, []);

  // Fit terminal on tab switch or visibility change
  useEffect(() => {
    if (mobileTab === "TERMINAL" && fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {
          // container might still be calculating
        }
      }, 50);
    }
  }, [mobileTab]);

  const runCode = useCallback(() => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      return;
    }

    if (terminal.current) {
      terminal.current.clear();
      terminal.current.writeln("\x1b[90mCompiling...\x1b[0m");
    }

    setAppState("COMPILING");
    setStatusMessage("Compiling...");

    // Auto-switch to terminal tab on mobile when running
    setMobileTab("TERMINAL");

    ws.current.send(
      JSON.stringify({
        type: "run",
        code: code,
      })
    );
  }, [code]);

  const stopCode = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: "stop",
        })
      );
    }
  }, []);

  const clearTerminal = useCallback(() => {
    if (terminal.current) {
      terminal.current.clear();
    }
  }, []);

  // Keyboard shortcut: Ctrl+Enter (or Cmd+Enter) to Run
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (connected && appState !== "COMPILING" && appState !== "RUNNING") {
          runCode();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [connected, appState, runCode]);

  const isRunDisabled = !connected || appState === "COMPILING" || appState === "RUNNING";
  const isStopDisabled = appState !== "RUNNING" && appState !== "COMPILING";

  return (
    <div className="app">
      {/* ================= TOP APP BAR ================= */}
      <header className="header">
        <div className="header-left">
          <div className="brand-badge">
            <div className="brand-icon">&gt;_</div>
            <span className="brand-title">PrayogCode</span>
          </div>

          <div className="header-divider" />

          <span className="header-subtext">C Programming Laboratory</span>
          <span className="c-tag">C</span>
        </div>

        <div className="header-right">
          <button
            className={`run-button ${appState === "COMPILING" ? "compiling" : appState === "RUNNING" ? "running" : ""}`}
            onClick={runCode}
            disabled={isRunDisabled}
            title="Compile and Execute C program (Ctrl+Enter)"
            aria-label="Run Code"
          >
            {appState === "COMPILING" ? (
              <>
                <div className="spinner" />
                <span>Compiling...</span>
              </>
            ) : appState === "RUNNING" ? (
              <>
                <div className="spinner" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>{connected ? "Run" : "Connecting..."}</span>
                <kbd className="kbd-shortcut">Ctrl+↵</kbd>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ================= MOBILE TAB SWITCHER ================= */}
      <div className="mobile-tab-bar">
        <button
          className={`mobile-tab-btn ${mobileTab === "CODE" ? "active" : ""}`}
          onClick={() => setMobileTab("CODE")}
        >
          <span className="material-symbols-outlined">code</span>
          <span>CODE</span>
        </button>
        <button
          className={`mobile-tab-btn ${mobileTab === "TERMINAL" ? "active" : ""}`}
          onClick={() => setMobileTab("TERMINAL")}
        >
          <span className="material-symbols-outlined">terminal</span>
          <span>TERMINAL</span>
        </button>
      </div>

      {/* ================= WORKSPACE ================= */}
      <main className="workspace">
        {/* LEFT PANEL: MONACO EDITOR */}
        <section className={`editor-panel ${mobileTab === "CODE" ? "mobile-active" : ""}`}>
          <div className="panel-header">
            <div className="editor-tab-item">
              <span className="c-icon-badge">C</span>
              <span>main.c</span>
            </div>
          </div>

          <div className="editor-breadcrumbs">
            <span>src</span>
            <span className="sep">&gt;</span>
            <span className="active">main.c</span>
          </div>

          <div className="editor-container">
            <Editor
              height="100%"
              defaultLanguage="c"
              value={code}
              onChange={(value) => setCode(value || "")}
              theme="vs-dark"
              options={{
                minimap: {
                  enabled: false,
                },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', Consolas, Menlo, monospace",
                lineNumbers: "on",
                renderLineHighlight: "all",
                automaticLayout: true,
                padding: {
                  top: 10,
                  bottom: 10,
                },
                scrollBeyondLastLine: false,
                tabSize: 4,
                cursorBlinking: "smooth",
                smoothScrolling: true,
              }}
            />
          </div>
        </section>

        {/* RIGHT PANEL: INTERACTIVE XTERM TERMINAL */}
        <section className={`terminal-panel ${mobileTab === "TERMINAL" ? "mobile-active" : ""}`}>
          <div className="panel-header">
            <div className="terminal-title-group">
              <div className="terminal-title-badge">
                <span className="material-symbols-outlined terminal-title-icon">terminal</span>
                <span>TERMINAL</span>
              </div>

              <div className={`terminal-status-pill ${appState.toLowerCase()}`}>
                <span className={`status-dot ${appState === "COMPILING" || appState === "RUNNING" ? "pulse" : ""}`} />
                <span>{statusMessage}</span>
              </div>
            </div>

            <div className="terminal-actions">
              <button
                className="action-btn clear-btn"
                onClick={clearTerminal}
                title="Clear Terminal Output"
                aria-label="Clear Terminal"
              >
                <span className="material-symbols-outlined">delete_sweep</span>
                <span>Clear</span>
              </button>

              <button
                className="action-btn stop-btn"
                onClick={stopCode}
                disabled={isStopDisabled}
                title="Stop Running Process"
                aria-label="Stop Execution"
              >
                <span className="material-symbols-outlined">stop</span>
                <span>Stop</span>
              </button>
            </div>
          </div>

          <div ref={terminalRef} className="terminal-container" />

          <div className="terminal-hint-strip">
            <span className="material-symbols-outlined" style={{ fontSize: "12px", color: "#38bdf8" }}>
              keyboard
            </span>
            <span>Interactive stdin ready</span>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;