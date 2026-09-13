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
                    console.log("Starting:", result.executable);

                    const command = process.env.ComSpec || "cmd.exe";

                    runningProcess = pty.spawn(
                        command,
                        ["/c", result.executable],
                        {
                            name: "xterm-color",
                            cols: 100,
                            rows: 30,
                            cwd: result.tempDir,
                            env: process.env
                        }
                    );

                    console.log("C program started");

                    runningProcess.onData((output) => {
                        console.log("PROGRAM OUTPUT:", JSON.stringify(output));

                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: "stdout",
                                data: output
                            }));
                        }
                    });

                    runningProcess.onExit(({ exitCode }) => {
                        console.log("Process exited:", exitCode);

                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: "exit",
                                code: exitCode
                            }));
                        }

                        runningProcess = null;
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
                    console.log("Input sent:", JSON.stringify(data.data));
                    runningProcess.write(data.data);
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
    console.log(`PrayogCode server running at http://localhost:${PORT}`);
});