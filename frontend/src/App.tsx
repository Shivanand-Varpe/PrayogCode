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

  const ws = useRef<WebSocket | null>(null);
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: "#0b0d12",
        foreground: "#e5e7eb",
        cursor: "#22c55e",
      },
      fontSize: 14,
      fontFamily: "Consolas, monospace",
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    if (terminalContainerRef.current) {
      term.open(terminalContainerRef.current);
      try {
        fitAddon.fit();
      } catch {
        // Container might not be measured yet
      }
    }

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    term.write("Connecting to PrayogCode compiler...\r\n");

    const onDataDisposable = term.onData((data) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({
            type: "input",
            data: data,
          })
        );
      }
    });

    const safeFit = () => {
      try {
        fitAddon.fit();
      } catch {
        // Ignore resize calculation errors when element is detached or hidden
      }
    };

    window.addEventListener("resize", safeFit);

    const resizeObserver = new ResizeObserver(() => {
      safeFit();
    });

    if (terminalContainerRef.current) {
      resizeObserver.observe(terminalContainerRef.current);
    }

    requestAnimationFrame(safeFit);

    const socket = new WebSocket("ws://localhost:3000");
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      term.write("Connected to PrayogCode compiler.\r\n");
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case "stdout":
            term.write(message.data);
            break;
          case "stderr":
            term.write(message.data);
            break;
          case "error":
            term.write("\r\n" + (message.data || "Compilation failed") + "\r\n");
            break;
          case "exit":
            term.write(`\r\nProcess exited with code ${message.code}\r\n`);
            break;
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    socket.onerror = () => {
      setConnected(false);
      term.write("\r\nCould not connect to compiler backend.\r\n");
    };

    socket.onclose = () => {
      setConnected(false);
      term.write("\r\nWebSocket disconnected.\r\n");
    };

    return () => {
      window.removeEventListener("resize", safeFit);
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      socket.close();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  const runCode = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      terminalRef.current?.write("\r\nCompiler is not connected.\r\n");
      return;
    }

    terminalRef.current?.clear();
    terminalRef.current?.write("Compiling...\r\n");

    ws.current.send(
      JSON.stringify({
        type: "run",
        code: code,
      })
    );
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
            <span>main.c</span>
            <span>C</span>
          </div>

          <Editor
            height="calc(100vh - 110px)"
            defaultLanguage="c"
            value={code}
            onChange={(value) => setCode(value || "")}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 15,
              automaticLayout: true,
            }}
          />
        </section>

        <section className="terminal-panel">
          <div className="panel-title">
            <span>Terminal</span>
          </div>

          <div ref={terminalContainerRef} className="terminal-container" />
        </section>
      </main>
    </div>
  );
}

export default App;