const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const pty = require("node-pty");
const fs = require("fs");
const { compileC } = require("./compiler");

const app = express();
const PORT = 3000;

// Global crash guards to ensure WebSocket server never dies unexpectedly
process.on("uncaughtException", (err) => {
    console.error("Unhandled process exception:", err.message);
});
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
});

// Stage 2.5 Security and Resource Limits
const MAX_SOURCE_SIZE = 100 * 1024;        // 100 KB
const MAX_OUTPUT_SIZE = 1 * 1024 * 1024;    // 1 MB
const MAX_INPUT_PAYLOAD = 64 * 1024;       // 64 KB

function cleanupTempFolder(tempDir) {
    if (!tempDir) return;

    try {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, {
                recursive: true,
                force: true
            });
            console.log("Temporary files cleaned up:", tempDir);
        }
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
    let isCompiling = false;
    let currentTempDir = null;
    let timedOut = false;
    let stoppedByUser = false;
    let outputLimitHit = false;
    let totalOutputBytes = 0;
    let executionTimeout = null;
    let isKilling = false;

    function safeKillProcess() {
        if (!runningProcess || isKilling) return;
        isKilling = true;
        const proc = runningProcess;
        try {
            proc.kill();
        } catch (err) {
            console.log("Safe kill error:", err.message);
        }
    }

    function resetTimeout() {
        if (executionTimeout) {
            clearTimeout(executionTimeout);
        }
        executionTimeout = setTimeout(() => {
            if (runningProcess) {
                console.log("Execution timeout");
                timedOut = true;
                safeKillProcess();
            }
        }, 60000);
    }

    ws.on("message", async (message) => {
        try {
            const data = JSON.parse(message.toString());

            console.log("Received:", data.type);

            if (data.type === "run") {
                // Prevent duplicate runs while process is active or compiling
                if (runningProcess || isCompiling) {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: "error",
                            data: "A program is already running."
                        }));
                    }
                    return;
                }

                // Stage 2.5.1: Source code size restriction (100 KB)
                if (Buffer.byteLength(data.code || "", "utf8") > MAX_SOURCE_SIZE) {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: "error",
                            data: "Source code is too large. Maximum allowed size: 100 KB."
                        }));
                    }
                    return;
                }

                isCompiling = true;

                try {
                    console.log("Compiling C program...");

                    const result = await compileC(data.code);

                    // Check if client disconnected while compiling
                    if (ws.readyState !== WebSocket.OPEN) {
                        isCompiling = false;
                        cleanupTempFolder(result.tempDir);
                        return;
                    }

                    console.log("Compilation successful");
                    console.log("Starting WSL program:", result.executable);

                    currentTempDir = result.tempDir;
                    const wslExecutable = result.executable;

                    // Reset execution state
                    timedOut = false;
                    stoppedByUser = false;
                    outputLimitHit = false;
                    totalOutputBytes = 0;
                    isKilling = false;

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

                    isCompiling = false;
                    console.log("C program started inside WSL");

                    // Stage 2.5.2: Output size limit accounting (1 MB max)
                    runningProcess.onData((output) => {
                        // If output limit already triggered, drop subsequent chunks immediately
                        if (outputLimitHit) {
                            return;
                        }

                        // Filter out focus-reporting terminal modes from ConPTY
                        const cleanOutput = output.replace(/\x1b\[\?1004[hl]/g, "");
                        if (cleanOutput.length === 0) {
                            return;
                        }

                        const chunkBytes = Buffer.byteLength(cleanOutput, "utf8");

                        if (totalOutputBytes + chunkBytes >= MAX_OUTPUT_SIZE) {
                            outputLimitHit = true;

                            // Send partial chunk up to 1 MB limit if space remains
                            const remaining = MAX_OUTPUT_SIZE - totalOutputBytes;
                            if (remaining > 0 && ws.readyState === WebSocket.OPEN) {
                                const buf = Buffer.from(cleanOutput, "utf8");
                                ws.send(JSON.stringify({
                                    type: "stdout",
                                    data: buf.subarray(0, remaining).toString("utf8")
                                }));
                            }

                            totalOutputBytes = MAX_OUTPUT_SIZE;

                            if (executionTimeout) {
                                clearTimeout(executionTimeout);
                                executionTimeout = null;
                            }

                            console.log("Output limit exceeded (1 MB)");

                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({
                                    type: "error",
                                    data: "Output limit exceeded. Maximum output: 1 MB."
                                }));
                            }

                            safeKillProcess();
                            return;
                        }

                        totalOutputBytes += chunkBytes;

                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: "stdout",
                                data: cleanOutput
                            }));
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
                            if (outputLimitHit) {
                                // Output limit already sent its error notification
                            } else if (stoppedByUser) {
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
                        if (currentTempDir) {
                            cleanupTempFolder(currentTempDir);
                            currentTempDir = null;
                        }
                        isCompiling = false;
                        timedOut = false;
                        stoppedByUser = false;
                        outputLimitHit = false;
                        totalOutputBytes = 0;
                        isKilling = false;
                    });

                } catch (error) {
                    isCompiling = false;
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
                if (typeof data.data !== "string") {
                    return;
                }

                // Stage 2.5.3: Input payload limit (64 KB)
                if (Buffer.byteLength(data.data, "utf8") > MAX_INPUT_PAYLOAD) {
                    console.log("Rejected oversized input message (>64 KB)");
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: "error",
                            data: "Input is too large. Maximum input size: 64 KB."
                        }));
                    }
                    return; // Do NOT kill the process; keep interactive session alive
                }

                if (runningProcess) {
                    // Ignore focus reporting escape sequences (\u001b[I, \u001b[O)
                    if (data.data === "\x1b[I" || data.data === "\x1b[O") {
                        return;
                    }

                    console.log(
                        "Input sent:",
                        JSON.stringify(data.data)
                    );

                    try {
                        runningProcess.write(data.data);
                    } catch (err) {
                        console.log("Input write error:", err.message);
                    }

                    // Reset inactivity timeout when user enters input
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

                    safeKillProcess();
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

        safeKillProcess();
        runningProcess = null;

        if (currentTempDir) {
            cleanupTempFolder(currentTempDir);
            currentTempDir = null;
        }

        isCompiling = false;
        timedOut = false;
        stoppedByUser = false;
        outputLimitHit = false;
        totalOutputBytes = 0;
        isKilling = false;
    });
});

server.listen(PORT, () => {
    console.log(
        `PrayogCode server running at http://localhost:${PORT}`
    );
});