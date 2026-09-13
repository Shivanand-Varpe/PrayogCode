import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

function App() {
  const [code, setCode] = useState(`#include <stdio.h>

int main() {
    int a, b;

    printf("Enter two numbers: ");
    scanf("%d %d", &a, &b);

    printf("Sum = %d\\n", a + b);

    return 0;
}`);

  const [connected, setConnected] = useState(false);

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const terminal = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "Consolas, monospace",
      theme: {
        background: "#0b0d12",
      },
    });

    const fitAddon = new FitAddon();

    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    terminal.current = term;

    const socket = new WebSocket("ws://localhost:3000");

    ws.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connected");

      setConnected(true);

      term.writeln("Connected to PrayogCode compiler.");
      term.writeln("");
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      console.log("Backend message:", message);

      if (message.type === "stdout") {
        term.write(message.data);
      }

      if (message.type === "stderr") {
        term.write(message.data);
      }

      if (message.type === "error") {
        term.writeln("");
        term.writeln("ERROR: " + message.data);
      }

      if (message.type === "exit") {
        term.writeln("");
        term.writeln(
          `Process exited with code ${message.code}`
        );
      }
    };

    socket.onerror = () => {
      console.log("WebSocket error");

      setConnected(false);

      term.writeln("");
      term.writeln("Could not connect to compiler backend.");
    };

    socket.onclose = () => {
      console.log("WebSocket closed");
      setConnected(false);
    };

    term.onData((data) => {
      if (
        socket.readyState === WebSocket.OPEN
      ) {
        socket.send(
          JSON.stringify({
            type: "input",
            data: data,
          })
        );
      }
    });

    const handleResize = () => {
      fitAddon.fit();
    };

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );

      socket.close();
      term.dispose();
    };
  }, []);

  const runCode = () => {
    if (
      !ws.current ||
      ws.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    if (terminal.current) {
      terminal.current.clear();
      terminal.current.writeln("Compiling...");
    }

    ws.current.send(
      JSON.stringify({
        type: "run",
        code: code,
      })
    );
  };
  const stopCode = () => {
    if (
      ws.current &&
      ws.current.readyState === WebSocket.OPEN
    ) {
      ws.current.send(
        JSON.stringify({
          type: "stop",
        })
      );
    }
  };

  const clearTerminal = () => {
    if (terminal.current) {
      terminal.current.clear();
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>PrayogCode</h1>
          <span>C Programming Laboratory</span>
        </div>

        <button
          className="run-button"
          onClick={runCode}
          disabled={!connected}
        >
          {connected ? "▶ Run" : "Connecting..."}
        </button>
      </header>

      <main className="workspace">
        <section className="editor-panel">
          <div className="panel-title">
            <span>Terminal</span>

            <div className="terminal-actions">
              <button
                className="clear-button"
                onClick={clearTerminal}
              >
                Clear
              </button>

              <button
                className="stop-button"
                onClick={stopCode}
              >
                Stop
              </button>
            </div>
          </div>

          <Editor
            height="calc(100vh - 110px)"
            defaultLanguage="c"
            value={code}
            onChange={(value) =>
              setCode(value || "")
            }
            theme="vs-dark"
            options={{
              minimap: {
                enabled: false,
              },
              fontSize: 15,
              automaticLayout: true,
            }}
          />
        </section>

        <section className="terminal-panel">
          <div className="panel-title">
            <span>Terminal</span>
          </div>

          <div
            ref={terminalRef}
            className="terminal"
          />
        </section>
      </main>
    </div>
  );
}

export default App;