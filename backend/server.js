const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const {
    checkDockerAvailable,
    createTempWorkspace,
    cleanupTempWorkspace,
    compileInDocker,
    runInDocker
} = require("./dockerRunner");

const app = express();
const PORT = 3000;

// Global crash guards to ensure WebSocket server never dies unexpectedly
process.on("uncaughtException", (err) => {
    console.error("Unhandled process exception:", err.message);
});
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
});

// Security and Resource Limits
const MAX_SOURCE_SIZE = 100 * 1024;        // 100 KB
const MAX_OUTPUT_SIZE = 1 * 1024 * 1024;    // 1 MB
const MAX_INPUT_PAYLOAD = 64 * 1024;       // 64 KB

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "PrayogCode C Compiler Backend is running (Docker Sandbox)!"
    });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
    console.log("Terminal connected");

    let runningSession = null;
    let isCompiling = false;
    let currentTempDir = null;
    let timedOut = false;
    let stoppedByUser = false;
    let outputLimitHit = false;
    let totalOutputBytes = 0;
    let executionTimeout = null;
    let isKilling = false;

    function safeKillProcess() {
        if (!runningSession || isKilling) return;
        isKilling = true;
        const session = runningSession;
        try {
            session.kill();
        } catch (err) {
            console.log("Safe kill warning:", err.message);
        }
    }

    function resetTimeout() {
        if (executionTimeout) {
            clearTimeout(executionTimeout);
        }
        executionTimeout = setTimeout(() => {
            if (runningSession) {
                console.log("Execution timeout (60 seconds)");
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
                if (runningSession || isCompiling) {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: "error",
                            data: "A program is already running."
                        }));
                    }
                    return;
                }

                // Source code size restriction (100 KB)
                if (Buffer.byteLength(data.code || "", "utf8") > MAX_SOURCE_SIZE) {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: "error",
                            data: "Source code is too large. Maximum allowed size: 100 KB."
                        }));
                    }
                    return;
                }

                // Verify Docker is reachable before proceeding
                const isDockerReady = await checkDockerAvailable();
                if (!isDockerReady) {
                    console.error("Docker daemon unreachable");
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: "error",
                            data: "Docker execution is unavailable."
                        }));
                    }
                    return;
                }

                isCompiling = true;
                const tempDir = createTempWorkspace();
                currentTempDir = tempDir;

                try {
                    console.log("Compiling C program inside Docker...");
                    await compileInDocker(data.code, tempDir);

                    // Check if client disconnected during compilation
                    if (ws.readyState !== WebSocket.OPEN) {
                        isCompiling = false;
                        cleanupTempWorkspace(tempDir);
                        currentTempDir = null;
                        return;
                    }

                    console.log("Docker compilation successful. Starting container execution...");

                    // Reset execution state
                    timedOut = false;
                    stoppedByUser = false;
                    outputLimitHit = false;
                    totalOutputBytes = 0;
                    isKilling = false;

                    runningSession = runInDocker(tempDir);
                    isCompiling = false;

                    const handleOutput = (chunk) => {
                        if (outputLimitHit) return;

                        const chunkStr = chunk.toString("utf8");
                        // Filter out focus-reporting terminal modes
                        const cleanOutput = chunkStr.replace(/\x1b\[\?1004[hl]/g, "");
                        if (cleanOutput.length === 0) return;

                        const chunkBytes = Buffer.byteLength(cleanOutput, "utf8");

                        if (totalOutputBytes + chunkBytes >= MAX_OUTPUT_SIZE) {
                            outputLimitHit = true;

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
                    };

                    runningSession.proc.stdout.on("data", handleOutput);
                    runningSession.proc.stderr.on("data", handleOutput);

                    resetTimeout();

                    runningSession.proc.on("close", (exitCode) => {
                        if (executionTimeout) {
                            clearTimeout(executionTimeout);
                            executionTimeout = null;
                        }

                        console.log("Container process exited with code:", exitCode);

                        if (ws.readyState === WebSocket.OPEN) {
                            if (outputLimitHit) {
                                // Error already sent
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
                                    code: exitCode !== null ? exitCode : 0
                                }));
                            }
                        }

                        runningSession = null;
                        if (currentTempDir) {
                            cleanupTempWorkspace(currentTempDir);
                            currentTempDir = null;
                        }
                        isCompiling = false;
                        timedOut = false;
                        stoppedByUser = false;
                        outputLimitHit = false;
                        totalOutputBytes = 0;
                        isKilling = false;
                    });

                    runningSession.proc.on("error", (err) => {
                        console.error("Docker container spawn error:", err.message);
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: "error",
                                data: "Docker execution is unavailable: " + err.message
                            }));
                        }
                        if (currentTempDir) {
                            cleanupTempWorkspace(currentTempDir);
                            currentTempDir = null;
                        }
                        runningSession = null;
                        isCompiling = false;
                    });

                } catch (error) {
                    isCompiling = false;
                    console.log("Compilation or preparation failed:", error.message || error);

                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: "error",
                            data: error.message || "Compilation failed."
                        }));
                    }

                    if (currentTempDir) {
                        cleanupTempWorkspace(currentTempDir);
                        currentTempDir = null;
                    }
                }
            }

            if (data.type === "input") {
                if (typeof data.data !== "string") {
                    return;
                }

                // Input payload limit (64 KB)
                if (Buffer.byteLength(data.data, "utf8") > MAX_INPUT_PAYLOAD) {
                    console.log("Rejected oversized input message (>64 KB)");
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: "error",
                            data: "Input is too large. Maximum input size: 64 KB."
                        }));
                    }
                    return; // Keep session alive
                }

                if (runningSession) {
                    if (data.data === "\x1b[I" || data.data === "\x1b[O") {
                        return;
                    }

                    console.log("Input sent to container:", JSON.stringify(data.data));

                    runningSession.write(data.data);
                    resetTimeout();
                }
            }

            if (data.type === "stop") {
                if (runningSession) {
                    console.log("Stopping Docker container...");

                    stoppedByUser = true;
                    if (executionTimeout) {
                        clearTimeout(executionTimeout);
                        executionTimeout = null;
                    }

                    safeKillProcess();
                }
            }

        } catch (error) {
            console.log("Message processing error:", error.message);
        }
    });

    ws.on("close", () => {
        console.log("Terminal disconnected");

        if (executionTimeout) {
            clearTimeout(executionTimeout);
            executionTimeout = null;
        }

        safeKillProcess();
        runningSession = null;

        if (currentTempDir) {
            cleanupTempWorkspace(currentTempDir);
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
        `PrayogCode server running at http://localhost:${PORT} with Docker C Sandbox`
    );
});