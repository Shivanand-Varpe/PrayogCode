import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

function App() {
  const [code, setCode] = useState(`#include <stdio.h>

int main() {
    printf("Hello, PrayogCode!\\\\n");
    return 0;
}`);

  const [output, setOutput] = useState("Terminal ready...");
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3000");

    socket.onopen = () => {
      setOutput("Connected to PrayogCode compiler.\\n");
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "stdout") {
        setOutput((previous) => previous + message.data);
      }

      if (message.type === "stderr") {
        setOutput((previous) => previous + message.data);
      }

      if (message.type === "error") {
        setOutput((previous) => previous + "\\nERROR: " + message.data);
      }

      if (message.type === "exit") {
        setOutput(
          (previous) =>
            previous + `\\nProcess exited with code ${message.code}\\n`
        );
      }
    };

    socket.onerror = () => {
      setOutput("Could not connect to compiler backend.");
    };

    ws.current = socket;

    return () => {
      socket.close();
    };
  }, []);

  const runCode = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setOutput("Compiler backend is not connected.");
      return;
    }

    setOutput("Compiling...\\n");

    ws.current.send(
      JSON.stringify({
        type: "run",
        code,
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

        <button className="run-button" onClick={runCode}>
          ▶ Run
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

          <pre className="terminal-output">
            {output}
          </pre>
        </section>
      </main>
    </div>
  );
}

export default App;