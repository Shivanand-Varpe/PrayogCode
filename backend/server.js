const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
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

    ws.on("message", async (message) => {
        try {
            const data = JSON.parse(message.toString());

            if (data.type !== "run") {
                return;
            }

            const result = await compileC(data.code);

            const process = require("child_process").spawn(
                result.executable,
                [],
                {
                    cwd: result.tempDir,
                    stdio: ["pipe", "pipe", "pipe"]
                }
            );

            process.stdout.on("data", (data) => {
                ws.send(JSON.stringify({
                    type: "stdout",
                    data: data.toString()
                }));
            });

            process.stderr.on("data", (data) => {
                ws.send(JSON.stringify({
                    type: "stderr",
                    data: data.toString()
                }));
            });

            process.on("close", (code) => {
                ws.send(JSON.stringify({
                    type: "exit",
                    code
                }));
            });

            ws.on("message", (inputMessage) => {
                try {
                    const inputData = JSON.parse(inputMessage.toString());

                    if (inputData.type === "input") {
                        process.stdin.write(inputData.data);
                    }
                } catch {
                    // Ignore invalid messages
                }
            });

        } catch (error) {
            ws.send(JSON.stringify({
                type: "error",
                data: error.message || "Compilation failed"
            }));
        }
    });

    ws.on("close", () => {
        console.log("Terminal disconnected");
    });
});

server.listen(PORT, () => {
    console.log(`PrayogCode server running at http://localhost:${PORT}`);
});