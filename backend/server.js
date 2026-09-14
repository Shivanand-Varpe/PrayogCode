const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const pty = require("node-pty");
const fs = require("fs");
const { compileC } = require("./compiler");

const app = express();
const PORT = 3000;

function cleanupTempFolder(tempDir) {
    if (!tempDir) return;

    try {
        fs.rmSync(tempDir, {
            recursive: true,
            force: true
        });

        console.log("Temporary files cleaned up");
    } catch (error) {
        console.log("Cleanup error:", error.message);
    }
}

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "PrayogCode C Compiler Backend is running!"
    });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
    console.log("Terminal connected");

    let runningProcess = null;
    let timedOut = false;
    let stoppedByUser = false;
    let executionTimeout = null;

    function resetTimeout() {
        if (executionTimeout) {
            clearTimeout(executionTimeout);
        }
        executionTimeout = setTimeout(() => {
            if (runningProcess) {
                console.log("Execution timeout");
                timedOut = true;
                runningProcess.kill();
            }
        }, 60000);
    }

    ws.on("message", async (message) => {
        try {
            const data = JSON.parse(message.toString());

            console.log("Received:", data.type);

            if (data.type === "run") {
                if (runningProcess) {
                    ws.send(JSON.stringify({
                        type: "error",
                        data: "A program is already running."
                    }));
                    return;
                }

                try {
                    console.log("Compiling C program...");

                    const result = await compileC(data.code);

                    console.log("Compilation successful");
                    console.log("Starting WSL program:", result.executable);

                    const wslExecutable = result.executable;

                    timedOut = false;
                    stoppedByUser = false;

                    runningProcess = pty.spawn(
                        "wsl.exe",
                        ["--", wslExecutable],
                        {
                            name: "xterm-color",
                            cols: 100,
                            rows: 30,
                            cwd: result.tempDir,
                            env: process.env
                        }
                    );

                    console.log("C program started inside WSL");

                    runningProcess.onData((output) => {
                        console.log(
                            "PROGRAM OUTPUT:",
                            JSON.stringify(output)
                        );

                        if (ws.readyState === WebSocket.OPEN) {
                            // Filter out focus-reporting terminal modes from ConPTY
                            const cleanOutput = output.replace(/\x1b\[\?1004[hl]/g, "");
                            if (cleanOutput.length > 0) {
                                ws.send(JSON.stringify({
                                    type: "stdout",
                                    data: cleanOutput
                                }));
                            }
                        }
                    });

                    resetTimeout();

                    runningProcess.onExit(({ exitCode }) => {
                        if (executionTimeout) {
                            clearTimeout(executionTimeout);
                            executionTimeout = null;
                        }

                        console.log("Process exited:", exitCode);

                        if (ws.readyState === WebSocket.OPEN) {
                            if (stoppedByUser) {
                                ws.send(JSON.stringify({
                                    type: "stopped",
                                    data: "Program stopped."
                                }));
                            } else if (timedOut) {
                                ws.send(JSON.stringify({
                                    type: "timeout",
                                    data: "Time Limit Exceeded (60 seconds)"
                                }));
                            } else {
                                ws.send(JSON.stringify({
                                    type: "exit",
                                    code: exitCode
                                }));
                            }
                        }

                        runningProcess = null;
                        cleanupTempFolder(result.tempDir);
                        timedOut = false;
                        stoppedByUser = false;
                    });

                } catch (error) {
                    console.log("Compilation failed");

                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: "error",
                            data: error.message || "Compilation failed."
                        }));
                    }
                }
            }

            if (data.type === "input") {
                if (runningProcess && typeof data.data === "string") {
                    // Ignore focus reporting escape sequences (\u001b[I, \u001b[O)
                    if (data.data === "\x1b[I" || data.data === "\x1b[O") {
                        return;
                    }

                    console.log(
                        "Input sent:",
                        JSON.stringify(data.data)
                    );

                    runningProcess.write(data.data);

                    // Reset inactivity timeout when user enters input so user can have arbitrary delays
                    resetTimeout();
                }
            }

            if (data.type === "stop") {
                if (runningProcess) {
                    console.log("Stopping C program...");

                    stoppedByUser = true;
                    if (executionTimeout) {
                        clearTimeout(executionTimeout);
                        executionTimeout = null;
                    }

                    try {
                        runningProcess.kill();
                    } catch (error) {
                        console.log(
                            "Process termination error:",
                            error.message
                        );
                    }
                }
            }

        } catch (error) {
            console.log("Message error:", error.message);
        }
    });

    ws.on("close", () => {
        console.log("Terminal disconnected");

        if (executionTimeout) {
            clearTimeout(executionTimeout);
            executionTimeout = null;
        }

        if (runningProcess) {
            runningProcess.kill();
            runningProcess = null;
        }
    });
});

server.listen(PORT, () => {
    console.log(
        `PrayogCode server running at http://localhost:${PORT}`
    );
});