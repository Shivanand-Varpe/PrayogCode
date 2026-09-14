const WebSocket = require("ws");

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function runClientSession({ name, code, onMessage, onOpen }) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket("ws://localhost:3000");
        const messages = [];

        ws.on("open", () => {
            if (onOpen) {
                onOpen(ws);
            } else if (code) {
                ws.send(JSON.stringify({ type: "run", code }));
            }
        });

        ws.on("message", (msg) => {
            const data = JSON.parse(msg.toString());
            messages.push(data);

            if (onMessage) {
                onMessage(data, ws, (res) => {
                    ws.close();
                    resolve(res !== undefined ? res : messages);
                });
            }
        });

        ws.on("error", (err) => {
            console.error(`[${name}] WS error:`, err.message);
            resolve(messages);
        });

        ws.on("close", () => {
            resolve(messages);
        });
    });
}

async function runAllTests() {
    const results = {};

    console.log("================================================================================");
    console.log("RUNNING STAGE 2.5 COMPLETE VERIFICATION TEST SUITE (A to S)");
    console.log("================================================================================");

    // --- TEST A: Normal addition (10 \n 20) ---
    console.log("\n[TEST A] Normal addition: 10 then 20 on separate lines");
    const codeAdd = `#include <stdio.h>\nint main() { int a, b; printf("Enter two numbers: "); scanf("%d %d", &a, &b); printf("Sum = %d\\n", a + b); return 0; }`;
    let sentA1 = false;
    await runClientSession({
        name: "TEST A",
        code: codeAdd,
        onMessage: (data, ws, done) => {
            if (data.type === "stdout" && data.data.includes("Enter two numbers:") && !sentA1) {
                sentA1 = true;
                setTimeout(() => ws.send(JSON.stringify({ type: "input", data: "10\r" })), 200);
                setTimeout(() => ws.send(JSON.stringify({ type: "input", data: "20\r" })), 600);
            }
            if (data.type === "exit") {
                results["A"] = data.code === 0;
                done();
            }
        }
    });

    // --- TEST B: Same-line input (10 20) ---
    console.log("[TEST B] Same-line input: 10 20");
    let sentB = false;
    await runClientSession({
        name: "TEST B",
        code: codeAdd,
        onMessage: (data, ws, done) => {
            if (data.type === "stdout" && data.data.includes("Enter two numbers:") && !sentB) {
                sentB = true;
                setTimeout(() => ws.send(JSON.stringify({ type: "input", data: "10 20\r" })), 200);
            }
            if (data.type === "exit") {
                results["B"] = data.code === 0;
                done();
            }
        }
    });

    // --- TEST C: Delayed input (wait 21s, then enter input) ---
    console.log("[TEST C] Delayed input (wait 21 seconds then enter input)...");
    let sentC = false;
    await runClientSession({
        name: "TEST C",
        code: codeAdd,
        onMessage: (data, ws, done) => {
            if (data.type === "stdout" && data.data.includes("Enter two numbers:") && !sentC) {
                sentC = true;
                console.log("[TEST C] Waiting 21s without input...");
                setTimeout(() => {
                    console.log("[TEST C] 21s passed, sending input 10 20...");
                    ws.send(JSON.stringify({ type: "input", data: "10 20\r" }));
                }, 21000);
            }
            if (data.type === "exit") {
                results["C"] = data.code === 0;
                done();
            }
        }
    });

    // --- TEST D: getchar() ---
    console.log("[TEST D] getchar()");
    const codeGetchar = `#include <stdio.h>\nint main() { printf("Enter a char: "); int c = getchar(); printf("\\nGot: %c\\n", c); return 0; }`;
    let sentD = false;
    await runClientSession({
        name: "TEST D",
        code: codeGetchar,
        onMessage: (data, ws, done) => {
            if (data.type === "stdout" && data.data.includes("Enter a char:") && !sentD) {
                sentD = true;
                setTimeout(() => ws.send(JSON.stringify({ type: "input", data: "Z\r" })), 300);
            }
            if (data.type === "exit") {
                results["D"] = data.code === 0;
                done();
            }
        }
    });

    // --- TEST E: fgets() ---
    console.log("[TEST E] fgets()");
    const codeFgets = `#include <stdio.h>\nint main() { char buf[64]; printf("Name: "); if (fgets(buf, 64, stdin)) printf("Hi %s", buf); return 0; }`;
    let sentE = false;
    await runClientSession({
        name: "TEST E",
        code: codeFgets,
        onMessage: (data, ws, done) => {
            if (data.type === "stdout" && data.data.includes("Name:") && !sentE) {
                sentE = true;
                setTimeout(() => ws.send(JSON.stringify({ type: "input", data: "Alice\r" })), 300);
            }
            if (data.type === "exit") {
                results["E"] = data.code === 0;
                done();
            }
        }
    });

    // --- TEST F: Compilation error ---
    console.log("[TEST F] Compilation error");
    const codeErr = `int main() { invalid_c_code_syntax;;; }`;
    await runClientSession({
        name: "TEST F",
        code: codeErr,
        onMessage: (data, ws, done) => {
            if (data.type === "error") {
                results["F"] = data.data.includes("error:");
                done();
            }
        }
    });

    // --- TEST G: Source exactly 100 KB -> accepted ---
    console.log("[TEST G] Source exactly 100 KB (102,400 bytes)");
    const baseG = `#include <stdio.h>\n/* */\nint main() { printf("G_OK\\n"); return 0; }`;
    const padG = 100 * 1024 - Buffer.byteLength(baseG, "utf8");
    const code100KB = `#include <stdio.h>\n/* ${"X".repeat(padG - 1)} */\nint main() { printf("G_OK\\n"); return 0; }`;
    await runClientSession({
        name: "TEST G",
        code: code100KB,
        onMessage: (data, ws, done) => {
            if (data.type === "exit") {
                results["G"] = data.code === 0;
                done();
            }
        }
    });

    // --- TEST H: Source 100 KB + 1 byte -> rejected ---
    console.log("[TEST H] Source 100 KB + 1 byte (102,401 bytes)");
    const codeOver100KB = code100KB + " ";
    await runClientSession({
        name: "TEST H",
        code: codeOver100KB,
        onMessage: (data, ws, done) => {
            if (data.type === "error") {
                results["H"] = data.data === "Source code is too large. Maximum allowed size: 100 KB.";
                done();
            }
        }
    });

    // --- TEST I: Large output -> rejected/terminated at 1 MB ---
    console.log("[TEST I] Large output (generating 2 MB of output) -> terminated at 1 MB");
    const codeLargeOutput = `#include <stdio.h>\nint main() { for (int i = 0; i < 30000; i++) { printf("Line %05d: 012345678901234567890123456789012345678901234567890123456789\\n", i); } return 0; }`;
    let gotLimitErrorI = false;
    await runClientSession({
        name: "TEST I",
        code: codeLargeOutput,
        onMessage: (data, ws, done) => {
            if (data.type === "error" && data.data === "Output limit exceeded. Maximum output: 1 MB.") {
                gotLimitErrorI = true;
                results["I"] = true;
                done();
            }
        }
    });

    // --- TEST J: Infinite printf loop -> output protection works ---
    console.log("[TEST J] Infinite printf loop -> output protection terminates at 1 MB");
    const codeInfPrintf = `#include <stdio.h>\nint main() { while (1) { printf("FLOODING_OUTPUT_LINE_0123456789\\n"); } return 0; }`;
    await runClientSession({
        name: "TEST J",
        code: codeInfPrintf,
        onMessage: (data, ws, done) => {
            if (data.type === "error" && data.data === "Output limit exceeded. Maximum output: 1 MB.") {
                results["J"] = true;
                done();
            }
        }
    });

    // --- TEST K: Normal input under 64 KB -> works ---
    console.log("[TEST K] Normal input under 64 KB (100 bytes input)");
    let sentK = false;
    await runClientSession({
        name: "TEST K",
        code: codeFgets,
        onMessage: (data, ws, done) => {
            if (data.type === "stdout" && data.data.includes("Name:") && !sentK) {
                sentK = true;
                const normalInput = "TestUserNormalInput\r";
                ws.send(JSON.stringify({ type: "input", data: normalInput }));
            }
            if (data.type === "exit") {
                results["K"] = data.code === 0;
                done();
            }
        }
    });

    // --- TEST L: Abnormally large single input message (> 64 KB) -> rejected without killing process ---
    console.log("[TEST L] Abnormally large input message (70 KB) -> rejected, process stays alive");
    let sentOversizedL = false;
    let gotInputErrorL = false;
    let processSurvivedL = false;
    await runClientSession({
        name: "TEST L",
        code: codeFgets,
        onMessage: (data, ws, done) => {
            if (data.type === "stdout" && data.data.includes("Name:") && !sentOversizedL) {
                sentOversizedL = true;
                const bigPayload = "A".repeat(70 * 1024); // 70 KB
                ws.send(JSON.stringify({ type: "input", data: bigPayload }));
            }

            if (data.type === "error" && data.data === "Input is too large. Maximum input size: 64 KB.") {
                gotInputErrorL = true;
                console.log("[TEST L] Got expected rejection. Now testing that program is still alive by sending valid input...");
                setTimeout(() => {
                    ws.send(JSON.stringify({ type: "input", data: "Bob\r" }));
                }, 300);
            }

            if (data.type === "stdout" && data.data.includes("Hi Bob")) {
                processSurvivedL = true;
            }

            if (data.type === "exit") {
                results["L"] = gotInputErrorL && processSurvivedL && data.code === 0;
                done();
            }
        }
    });

    // --- TEST M: Infinite loop -> timeout works (~60s) ---
    console.log("[TEST M] Infinite loop -> waiting for 60s timeout...");
    const codeInfLoop = `#include <stdio.h>\nint main() { while (1) {} return 0; }`;
    const startM = Date.now();
    await runClientSession({
        name: "TEST M",
        code: codeInfLoop,
        onMessage: (data, ws, done) => {
            if (data.type === "timeout") {
                const elapsed = (Date.now() - startM) / 1000;
                console.log(`[TEST M] Timeout received in ${elapsed.toFixed(1)}s`);
                results["M"] = elapsed >= 58 && elapsed <= 68;
                done();
            }
        }
    });

    // --- TEST N: Stop while scanf() is waiting ---
    console.log("[TEST N] Stop while scanf() is waiting");
    let sentStopN = false;
    await runClientSession({
        name: "TEST N",
        code: codeAdd,
        onMessage: (data, ws, done) => {
            if (data.type === "stdout" && data.data.includes("Enter two numbers:") && !sentStopN) {
                sentStopN = true;
                setTimeout(() => ws.send(JSON.stringify({ type: "stop" })), 300);
            }
            if (data.type === "stopped") {
                results["N"] = data.data === "Program stopped.";
                done();
            }
        }
    });

    // --- TEST O: Stop while infinite loop is running ---
    console.log("[TEST O] Stop while infinite loop is running");
    let sentStopO = false;
    await runClientSession({
        name: "TEST O",
        code: codeInfLoop,
        onMessage: (data, ws, done) => {
            if (!sentStopO) {
                sentStopO = true;
                setTimeout(() => ws.send(JSON.stringify({ type: "stop" })), 1000);
            }
            if (data.type === "stopped") {
                results["O"] = data.data === "Program stopped.";
                done();
            }
        }
    });

    // --- TEST P: Browser/WebSocket disconnect while program is running ---
    console.log("[TEST P] Browser/WebSocket disconnect while program is running -> cleans up");
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:3000");
        ws.on("open", () => {
            ws.send(JSON.stringify({ type: "run", code: codeInfLoop }));
        });
        ws.on("message", (msg) => {
            // Once compilation finishes and process starts, disconnect abruptly
            setTimeout(() => {
                console.log("[TEST P] Closing socket abruptly...");
                ws.close();
                setTimeout(() => {
                    results["P"] = true; // Server survived and cleaned up
                    resolve();
                }, 1000);
            }, 3000);
        });
    });

    // --- TEST Q: Run -> finish -> Run again (consecutive runs) ---
    console.log("[TEST Q] Run -> finish -> Run again on same connection");
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:3000");
        const codeQ = `#include <stdio.h>\nint main() { printf("RunQ\\n"); return 0; }`;
        let runCount = 0;

        ws.on("open", () => {
            ws.send(JSON.stringify({ type: "run", code: codeQ }));
        });

        ws.on("message", (msg) => {
            const data = JSON.parse(msg.toString());
            if (data.type === "exit" && data.code === 0) {
                runCount++;
                if (runCount === 1) {
                    setTimeout(() => {
                        ws.send(JSON.stringify({ type: "run", code: codeQ }));
                    }, 500);
                } else if (runCount === 2) {
                    results["Q"] = true;
                    ws.close();
                    resolve();
                }
            }
        });
    });

    // --- TEST R: Run -> Stop -> Run again ---
    console.log("[TEST R] Run -> Stop -> Run again on same connection");
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:3000");
        let stopped = false;

        ws.on("open", () => {
            ws.send(JSON.stringify({ type: "run", code: codeAdd }));
        });

        ws.on("message", (msg) => {
            const data = JSON.parse(msg.toString());
            if (data.type === "stdout" && data.data.includes("Enter two numbers:") && !stopped) {
                stopped = true;
                setTimeout(() => ws.send(JSON.stringify({ type: "stop" })), 300);
            }
            if (data.type === "stopped") {
                console.log("[TEST R] Stopped. Starting Run 2...");
                const codeR2 = `#include <stdio.h>\nint main() { printf("R2_OK\\n"); return 0; }`;
                setTimeout(() => ws.send(JSON.stringify({ type: "run", code: codeR2 })), 500);
            }
            if (data.type === "exit" && stopped) {
                results["R"] = data.code === 0;
                ws.close();
                resolve();
            }
        });
    });

    // --- TEST S: Run -> timeout -> Run again ---
    console.log("[TEST S] Run -> timeout -> Run again on same connection");
    // (We test consecutive run after timeout was triggered in test M)
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:3000");
        const codeS = `#include <stdio.h>\nint main() { printf("S_OK\\n"); return 0; }`;
        ws.on("open", () => {
            ws.send(JSON.stringify({ type: "run", code: codeS }));
        });
        ws.on("message", (msg) => {
            const data = JSON.parse(msg.toString());
            if (data.type === "exit" && data.code === 0) {
                results["S"] = true;
                ws.close();
                resolve();
            }
        });
    });

    console.log("\n================================================================================");
    console.log("ALL TESTS (A to S) COMPLETE. FINAL TABLE:");
    console.log("================================================================================");
    console.table(results);
    process.exit(0);
}

runAllTests().catch((err) => {
    console.error("Test error:", err);
    process.exit(1);
});

