import Editor from "@monaco-editor/react";
import { useState } from "react";

function App() {
  const [code, setCode] = useState(`#include <stdio.h>

int main() {
    printf("Hello, PrayogCode!\\\\n");
    return 0;
}`);

  const [output, setOutput] = useState("Terminal ready...");

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>PrayogCode</h1>
          <span>C Programming Laboratory</span>
        </div>

        <button className="run-button">
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