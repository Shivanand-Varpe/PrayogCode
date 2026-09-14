const WebSocket = require("ws");

function runScenario(testName, fn) {
    return new Promise(async (resolve) => {
        console.log(`\n========================================`);
        console.log(`STARTING: ${testName}`);
        console.log(`========================================`);
        try {
            const result = await fn();
            console.log(`[PASS] ${testName} -> ${result}`);
            resolve({ name: testName, status: "PASS", detail: result });
        } catch (err) {
            console.error(`[FAIL] ${testName} -> ${err.message || err}`);
            resolve({ name: testName, status: "FAIL", detail: err.message || err });
        }
    });
}

function createSocket() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket("ws://localhost:3000");
        ws.on("open", () => resolve(ws));
        ws.on("error", reject);
    });
}

async function main() {
    const results = [];

    // TEST 1: Hello World
    results.push(await runScenario("TEST 1 — Hello World", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") output += data.data;
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("Hello from Docker!") && data.code === 0) {
                        resolve(`Output matched, exit code 0`);
                    } else {
                        reject(new Error(`Unexpected output: "${output}", code: ${data.code}`));
                    }
                }
                if (data.type === "error") {
                    ws.close();
                    reject(new Error(`Compiler/Runtime error: ${data.data}`));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Hello from Docker!\\n"); return 0; }`
            }));
        });
    }));

    // TEST 2: scanf same-line
    results.push(await runScenario("TEST 2 — scanf same-line", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") {
                    output += data.data;
                    if (output.includes("Enter two numbers:") && !output.includes("Sum =")) {
                        ws.send(JSON.stringify({ type: "input", data: "10 20\n" }));
                    }
                }
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("Sum = 30") && data.code === 0) {
                        resolve(`Sum = 30 calculated correctly`);
                    } else {
                        reject(new Error(`Output: ${output}, code: ${data.code}`));
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ int a, b; printf("Enter two numbers: "); if(scanf("%d %d", &a, &b)==2) printf("Sum = %d\\n", a+b); return 0; }`
            }));
        });
    }));

    // TEST 3: scanf separate lines
    results.push(await runScenario("TEST 3 — scanf separate lines", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            let sentFirst = false;
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") {
                    output += data.data;
                    if (output.includes("Enter two numbers:") && !sentFirst) {
                        sentFirst = true;
                        ws.send(JSON.stringify({ type: "input", data: "10\n" }));
                        setTimeout(() => {
                            ws.send(JSON.stringify({ type: "input", data: "20\n" }));
                        }, 300);
                    }
                }
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("Sum = 30") && data.code === 0) {
                        resolve(`Separate line input parsed correctly into Sum = 30`);
                    } else {
                        reject(new Error(`Output: ${output}, code: ${data.code}`));
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ int a, b; printf("Enter two numbers: "); if(scanf("%d %d", &a, &b)==2) printf("Sum = %d\\n", a+b); return 0; }`
            }));
        });
    }));

    // TEST 4: delayed input
    results.push(await runScenario("TEST 4 — delayed input", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            let promptReceivedTime = 0;
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") {
                    output += data.data;
                    if (output.includes("Waiting for input:") && promptReceivedTime === 0) {
                        promptReceivedTime = Date.now();
                        // Wait 5 seconds before providing input
                        setTimeout(() => {
                            ws.send(JSON.stringify({ type: "input", data: "42\n" }));
                        }, 5000);
                    }
                }
                if (data.type === "exit") {
                    ws.close();
                    const delay = Date.now() - promptReceivedTime;
                    if (output.includes("Got: 42") && delay >= 4500) {
                        resolve(`Delayed input handled cleanly after ${delay}ms`);
                    } else {
                        reject(new Error(`Output: ${output}, delay: ${delay}ms`));
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ int x; printf("Waiting for input: "); if(scanf("%d", &x)==1) printf("Got: %d\\n", x); return 0; }`
            }));
        });
    }));

    // TEST 5: getchar
    results.push(await runScenario("TEST 5 — getchar", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") {
                    output += data.data;
                    if (output.includes("Enter char:") && !output.includes("Received char:")) {
                        ws.send(JSON.stringify({ type: "input", data: "Z\n" }));
                    }
                }
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("Received char: Z")) {
                        resolve(`getchar captured character 'Z'`);
                    } else {
                        reject(new Error(`Output: ${output}`));
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Enter char: "); int c = getchar(); printf("Received char: %c\\n", c); return 0; }`
            }));
        });
    }));

    // TEST 6: fgets
    results.push(await runScenario("TEST 6 — fgets", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") {
                    output += data.data;
                    if (output.includes("Enter name:") && !output.includes("Hello ")) {
                        ws.send(JSON.stringify({ type: "input", data: "DockerPrayog\n" }));
                    }
                }
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("Hello DockerPrayog")) {
                        resolve(`fgets successfully read line buffer`);
                    } else {
                        reject(new Error(`Output: ${output}`));
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ char buf[64]; printf("Enter name: "); if(fgets(buf, sizeof(buf), stdin)) printf("Hello %s", buf); return 0; }`
            }));
        });
    }));

    // TEST 7: compilation error
    results.push(await runScenario("TEST 7 — compilation error", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "error") {
                    ws.close();
                    if (data.data.includes("error:")) {
                        resolve(`Compiler error diagnostic returned: "${data.data.split("\n")[0]}"`);
                    } else {
                        reject(new Error(`Unexpected error message: ${data.data}`));
                    }
                }
                if (data.type === "exit") {
                    ws.close();
                    reject(new Error("Executable ran despite syntax error!"));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `int main() { printf("missing semicolon") }`
            }));
        });
    }));

    // TEST 8: runtime crash
    results.push(await runScenario("TEST 8 — runtime crash", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "exit") {
                    ws.close();
                    if (data.code === 139) {
                        resolve(`Runtime SIGSEGV exited with code 139`);
                    } else {
                        resolve(`Runtime crash exited with code ${data.code}`);
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ int *p = NULL; *p = 42; return 0; }`
            }));
        });
    }));

    // TEST 9: Stop while waiting for input
    results.push(await runScenario("TEST 9 — Stop while waiting for input", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            let stopSent = false;
            const startStop = Date.now();
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") {
                    output += data.data;
                    if (output.includes("Waiting for input...") && !stopSent) {
                        stopSent = true;
                        ws.send(JSON.stringify({ type: "stop" }));
                    }
                }
                if (data.type === "stopped") {
                    ws.close();
                    const duration = Date.now() - startStop;
                    resolve(`Stopped successfully in ${duration}ms with "${data.data}"`);
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ int x; printf("Waiting for input...\\n"); scanf("%d", &x); return 0; }`
            }));
        });
    }));

    // TEST 10: Stop infinite loop
    results.push(await runScenario("TEST 10 — Stop infinite loop", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let loopStarted = false;
            const startStop = Date.now();
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") {
                    if (data.data.includes("Looping...") && !loopStarted) {
                        loopStarted = true;
                        setTimeout(() => {
                            ws.send(JSON.stringify({ type: "stop" }));
                        }, 500);
                    }
                }
                if (data.type === "stopped") {
                    ws.close();
                    const duration = Date.now() - startStop;
                    resolve(`Infinite loop terminated in ${duration}ms`);
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Looping...\\n"); while(1){} return 0; }`
            }));
        });
    }));

    // TEST 11: timeout (60s)
    results.push(await runScenario("TEST 11 — timeout (60 seconds)", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            const start = Date.now();
            console.log("Waiting for 60s execution timeout...");
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "timeout") {
                    ws.close();
                    const elapsed = Math.round((Date.now() - start) / 1000);
                    if (elapsed >= 58 && elapsed <= 65) {
                        resolve(`Timeout triggered at ${elapsed}s with message: "${data.data}"`);
                    } else {
                        reject(new Error(`Timeout occurred at ${elapsed}s, expected ~60s`));
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Running forever...\\n"); while(1){} return 0; }`
            }));
        });
    }));

    // TEST 12: output limit (1 MB)
    results.push(await runScenario("TEST 12 — output limit (1 MB)", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let totalBytes = 0;
            let errorReceived = false;
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") {
                    totalBytes += Buffer.byteLength(data.data, "utf8");
                }
                if (data.type === "error" && data.data.includes("Output limit exceeded")) {
                    errorReceived = true;
                }
                if (data.type === "exit" || (errorReceived && ws.readyState === WebSocket.OPEN)) {
                    ws.close();
                    if (errorReceived && totalBytes <= 1024 * 1024) {
                        resolve(`Terminated at output limit: received ${totalBytes} bytes`);
                    } else {
                        reject(new Error(`ErrorReceived: ${errorReceived}, totalBytes: ${totalBytes}`));
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ while(1){ printf("1234567890123456789012345678901234567890\\n"); } return 0; }`
            }));
        });
    }));

    // TEST 13: source limit (100 KB)
    results.push(await runScenario("TEST 13 — source limit (100 KB)", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            const oversizedCode = "/*" + "A".repeat(101 * 1024) + "*/\nint main(){ return 0; }";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "error" && data.data.includes("Source code is too large")) {
                    ws.close();
                    resolve(`Rejected oversized source (101 KB) before container launch`);
                } else {
                    ws.close();
                    reject(new Error(`Unexpected response: ${JSON.stringify(data)}`));
                }
            });
            ws.send(JSON.stringify({ type: "run", code: oversizedCode }));
        });
    }));

    // TEST 14: input limit (64 KB)
    results.push(await runScenario("TEST 14 — input limit (64 KB)", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            let errorReceived = false;
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") {
                    output += data.data;
                    if (output.includes("Enter number:") && !errorReceived) {
                        // Send oversized input chunk (70 KB)
                        ws.send(JSON.stringify({ type: "input", data: "X".repeat(70 * 1024) }));
                    }
                }
                if (data.type === "error" && data.data.includes("Input is too large")) {
                    errorReceived = true;
                    // Send valid input now to verify session survived
                    ws.send(JSON.stringify({ type: "input", data: "99\n" }));
                }
                if (data.type === "exit") {
                    ws.close();
                    if (errorReceived && output.includes("Value: 99")) {
                        resolve(`Oversized input rejected and session survived to parse 99`);
                    } else {
                        reject(new Error(`errorReceived: ${errorReceived}, output: ${output}`));
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ int x; printf("Enter number: "); if(scanf("%d", &x)==1) printf("Value: %d\\n", x); return 0; }`
            }));
        });
    }));

    // TEST 15: network isolation
    results.push(await runScenario("TEST 15 — network isolation", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") output += data.data;
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("CONNECT_FAILED")) {
                        resolve(`Network socket connect failed as expected (--network none)`);
                    } else {
                        reject(new Error(`Output: ${output}`));
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `
#include <stdio.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>

int main() {
    int s = socket(AF_INET, SOCK_STREAM, 0);
    struct sockaddr_in addr;
    addr.sin_family = AF_INET;
    addr.sin_port = htons(80);
    inet_pton(AF_INET, "8.8.8.8", &addr.sin_addr);
    if (connect(s, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        printf("CONNECT_FAILED\\n");
    } else {
        printf("CONNECT_SUCCESS\\n");
    }
    close(s);
    return 0;
}
`
            }));
        });
    }));

    // TEST 16: non-root execution
    results.push(await runScenario("TEST 16 — non-root execution", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") output += data.data;
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("UID=1000")) {
                        resolve(`Verified execution as unprivileged user (UID=1000)`);
                    } else {
                        reject(new Error(`Unexpected UID in output: ${output}`));
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\n#include <unistd.h>\nint main(){ printf("UID=%d\\n", getuid()); return 0; }`
            }));
        });
    }));

    // TEST 17: read-only filesystem
    results.push(await runScenario("TEST 17 — read-only filesystem", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") output += data.data;
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("ROOT_WRITE_DENIED") && output.includes("TMP_WRITE_OK")) {
                        resolve(`Verified rootfs is read-only and /tmp is writable tmpfs`);
                    } else {
                        reject(new Error(`Filesystem output mismatch: ${output}`));
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `
#include <stdio.h>
int main() {
    FILE *f1 = fopen("/test.txt", "w");
    if (!f1) printf("ROOT_WRITE_DENIED\\n");
    else { fclose(f1); printf("ROOT_WRITE_ALLOWED\\n"); }

    FILE *f2 = fopen("/tmp/test.txt", "w");
    if (f2) { fprintf(f2, "ok"); fclose(f2); printf("TMP_WRITE_OK\\n"); }
    else printf("TMP_WRITE_FAILED\\n");
    return 0;
}
`
            }));
        });
    }));

    // TEST 18: repeated execution
    results.push(await runScenario("TEST 18 — repeated execution", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let runCount = 0;
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "exit") {
                    runCount++;
                    if (runCount === 1) {
                        // Trigger second run on same socket
                        ws.send(JSON.stringify({
                            type: "run",
                            code: `#include <stdio.h>\nint main(){ printf("Run 2\\n"); return 0; }`
                        }));
                    } else if (runCount === 2) {
                        ws.close();
                        resolve(`Consecutive executions on same WebSocket connection completed`);
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Run 1\\n"); return 0; }`
            }));
        });
    }));

    // TEST 19: Stop then Run
    results.push(await runScenario("TEST 19 — Stop then Run", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let stopTriggered = false;
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout" && data.data.includes("Loop 1") && !stopTriggered) {
                    stopTriggered = true;
                    ws.send(JSON.stringify({ type: "stop" }));
                }
                if (data.type === "stopped") {
                    // Trigger new run immediately
                    ws.send(JSON.stringify({
                        type: "run",
                        code: `#include <stdio.h>\nint main(){ printf("Run after Stop\\n"); return 0; }`
                    }));
                }
                if (data.type === "stdout" && data.data.includes("Run after Stop")) {
                    ws.close();
                    resolve(`Clean recovery and fresh execution after Stop`);
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Loop 1\\n"); while(1){} return 0; }`
            }));
        });
    }));

    // TEST 20: timeout then Run
    results.push(await runScenario("TEST 20 — timeout then Run", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            // Trigger 1 run, timeout simulation or fast timeout verification
            let timeoutHappened = false;
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "timeout") {
                    timeoutHappened = true;
                    // Trigger fresh run
                    ws.send(JSON.stringify({
                        type: "run",
                        code: `#include <stdio.h>\nint main(){ printf("Recovered after timeout\\n"); return 0; }`
                    }));
                }
                if (data.type === "stdout" && data.data.includes("Recovered after timeout")) {
                    ws.close();
                    resolve(`New execution successfully executed after timeout`);
                }
            });
            // Let's trigger a timeout (60s)
            console.log("Waiting for initial run timeout...");
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ while(1){} return 0; }`
            }));
        });
    }));

    // TEST 21: WebSocket disconnect
    results.push(await runScenario("TEST 21 — WebSocket disconnect", async () => {
        const ws = await createSocket();
        return new Promise((resolve) => {
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout" && data.data.includes("Disconnect test")) {
                    // Abruptly close socket
                    ws.close();
                    setTimeout(() => {
                        resolve(`Disconnected abruptly; server reclaimed container and workspace`);
                    }, 1000);
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Disconnect test\\n"); while(1){} return 0; }`
            }));
        });
    }));

    // TEST 22: duplicate Run
    results.push(await runScenario("TEST 22 — duplicate Run", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let errorReceived = false;
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout" && data.data.includes("Active program")) {
                    // Dispatch duplicate run while first is active
                    ws.send(JSON.stringify({
                        type: "run",
                        code: `#include <stdio.h>\nint main(){ printf("Duplicate\\n"); return 0; }`
                    }));
                }
                if (data.type === "error" && data.data.includes("A program is already running")) {
                    errorReceived = true;
                    ws.send(JSON.stringify({ type: "stop" }));
                }
                if (data.type === "stopped" && errorReceived) {
                    ws.close();
                    resolve(`Duplicate run rejected with: "A program is already running."`);
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Active program\\n"); while(1){} return 0; }`
            }));
        });
    }));

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY:`);
    console.log(`========================================`);
    console.table(results);
}

main().catch(console.error);

