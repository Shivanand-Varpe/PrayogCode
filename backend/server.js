const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const pty = require("node-pty");
const { compileC } = require("./compiler");

const app = express();
const PORT = 3000;

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
                            ws.send(JSON.stringify({
                                type: "stdout",
                                data: output
                            }));
                        }
                    });
                    const timeout = setTimeout(() => {
                        if (runningProcess) {
                            console.log("Execution timeout");

                            timedOut = true;

                            runningProcess.kill();
                        }
                    }, 5000);
                    runningProcess.onExit(({ exitCode }) => {
                        clearTimeout(timeout);

                        console.log("Process exited:", exitCode);

                        if (ws.readyState === WebSocket.OPEN) {
                            if (timedOut) {
                                ws.send(JSON.stringify({
                                    type: "timeout",
                                    data: "Time Limit Exceeded (5 seconds)"
                                }));
                            } else {
                                ws.send(JSON.stringify({
                                    type: "exit",
                                    code: exitCode
                                }));
                            }
                        }

                        runningProcess = null;
                        timedOut = false;
                    });

                } catch (error) {
                    console.log("Execution error:", error);

                    runningProcess = null;

                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: "error",
                            data: error.message || "Program could not start"
                        }));
                    }
                }
            }

            if (data.type === "input") {
                if (runningProcess) {
                    console.log(
                        "Input sent:",
                        JSON.stringify(data.data)
                    );

                    runningProcess.write(data.data);
                }
            }
            if (data.type === "stop") {
                if (runningProcess) {
                    console.log("Stopping C program...");

                    runningProcess.kill();
                    runningProcess = null;

                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: "stopped"
                        }));
                    }
                }
            }

        } catch (error) {
            console.log("Message error:", error.message);
        }
    });

    ws.on("close", () => {
        console.log("Terminal disconnected");

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