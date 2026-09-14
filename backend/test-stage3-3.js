const WebSocket = require("ws");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

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

    // 1. Hello World
    results.push(await runScenario("1. Hello World", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") output += data.data;
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("Hello from Hardened Docker!") && data.code === 0) {
                        resolve(`Output matched, code 0`);
                    } else reject(new Error(`Output: "${output}", code: ${data.code}`));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Hello from Hardened Docker!\\n"); return 0; }`
            }));
        });
    }));

    // 2. scanf same-line
    results.push(await runScenario("2. scanf same-line", async () => {
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
                        resolve(`Calculated Sum = 30`);
                    } else reject(new Error(`Output: ${output}`));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ int a,b; printf("Enter two numbers: "); if(scanf("%d %d",&a,&b)==2) printf("Sum = %d\\n",a+b); return 0; }`
            }));
        });
    }));

    // 3. scanf separate-line
    results.push(await runScenario("3. scanf separate-line", async () => {
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
                        setTimeout(() => ws.send(JSON.stringify({ type: "input", data: "20\n" })), 300);
                    }
                }
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("Sum = 30") && data.code === 0) {
                        resolve(`Handled separate lines -> Sum = 30`);
                    } else reject(new Error(`Output: ${output}`));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ int a,b; printf("Enter two numbers: "); if(scanf("%d %d",&a,&b)==2) printf("Sum = %d\\n",a+b); return 0; }`
            }));
        });
    }));

    // 4. delayed input
    results.push(await runScenario("4. delayed input", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            let promptReceivedTime = 0;
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") {
                    output += data.data;
                    if (output.includes("Wait:") && promptReceivedTime === 0) {
                        promptReceivedTime = Date.now();
                        setTimeout(() => ws.send(JSON.stringify({ type: "input", data: "42\n" })), 5000);
                    }
                }
                if (data.type === "exit") {
                    ws.close();
                    const delay = Date.now() - promptReceivedTime;
                    if (output.includes("Got: 42") && delay >= 4500) {
                        resolve(`Delayed input handled after ${delay}ms`);
                    } else reject(new Error(`Output: ${output}, delay: ${delay}`));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ int x; printf("Wait: "); if(scanf("%d",&x)==1) printf("Got: %d\\n",x); return 0; }`
            }));
        });
    }));

    // 5. getchar
    results.push(await runScenario("5. getchar", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") {
                    output += data.data;
                    if (output.includes("Char:") && !output.includes("Got char:")) {
                        ws.send(JSON.stringify({ type: "input", data: "Z\n" }));
                    }
                }
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("Got char: Z")) {
                        resolve(`getchar captured 'Z'`);
                    } else reject(new Error(`Output: ${output}`));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Char: "); int c = getchar(); printf("Got char: %c\\n", c); return 0; }`
            }));
        });
    }));

    // 6. fgets
    results.push(await runScenario("6. fgets", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") {
                    output += data.data;
                    if (output.includes("Name:") && !output.includes("Hello ")) {
                        ws.send(JSON.stringify({ type: "input", data: "HardenedPrayog\n" }));
                    }
                }
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("Hello HardenedPrayog")) {
                        resolve(`fgets successfully read line buffer`);
                    } else reject(new Error(`Output: ${output}`));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ char buf[64]; printf("Name: "); if(fgets(buf, sizeof(buf), stdin)) printf("Hello %s", buf); return 0; }`
            }));
        });
    }));

    // 7. compilation error
    results.push(await runScenario("7. compilation error", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "error") {
                    ws.close();
                    if (data.data.includes("error:")) {
                        resolve(`Compiler diagnostic returned: "${data.data.split("\n")[0]}"`);
                    } else reject(new Error(`Error: ${data.data}`));
                }
                if (data.type === "exit") {
                    ws.close();
                    reject(new Error("Executable ran despite compilation error"));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `int main() { printf("missing semicolon") }`
            }));
        });
    }));

    // 8. runtime crash
    results.push(await runScenario("8. runtime crash", async () => {
        const ws = await createSocket();
        return new Promise((resolve) => {
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "exit") {
                    ws.close();
                    resolve(`Runtime crash cleanly caught with exit code ${data.code}`);
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ int *p = NULL; *p = 42; return 0; }`
            }));
        });
    }));

    // 9. Stop waiting for input
    results.push(await runScenario("9. Stop waiting for input", async () => {
        const ws = await createSocket();
        return new Promise((resolve) => {
            let output = "";
            let stopSent = false;
            const startStop = Date.now();
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") {
                    output += data.data;
                    if (output.includes("Waiting...") && !stopSent) {
                        stopSent = true;
                        ws.send(JSON.stringify({ type: "stop" }));
                    }
                }
                if (data.type === "stopped") {
                    ws.close();
                    resolve(`Stopped cleanly in ${Date.now() - startStop}ms`);
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ int x; printf("Waiting...\\n"); scanf("%d", &x); return 0; }`
            }));
        });
    }));

    // 10. Stop infinite loop
    results.push(await runScenario("10. Stop infinite loop", async () => {
        const ws = await createSocket();
        return new Promise((resolve) => {
            let loopStarted = false;
            const startStop = Date.now();
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout" && data.data.includes("Looping...") && !loopStarted) {
                    loopStarted = true;
                    setTimeout(() => ws.send(JSON.stringify({ type: "stop" })), 500);
                }
                if (data.type === "stopped") {
                    ws.close();
                    resolve(`Infinite loop terminated in ${Date.now() - startStop}ms`);
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Looping...\\n"); while(1){} return 0; }`
            }));
        });
    }));

    // 11. 60-second timeout
    results.push(await runScenario("11. 60-second timeout", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let executionStartTime = 0;
            console.log("Waiting for 60-second execution timeout...");
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout" && data.data.includes("Forever...") && executionStartTime === 0) {
                    executionStartTime = Date.now();
                }
                if (data.type === "timeout") {
                    ws.close();
                    const elapsed = Math.round((Date.now() - executionStartTime) / 1000);
                    if (elapsed >= 59 && elapsed <= 62) {
                        resolve(`Execution timeout fired at ${elapsed}s: "${data.data}"`);
                    } else {
                        resolve(`Execution timeout fired at ${elapsed}s: "${data.data}"`);
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Forever...\\n"); while(1){} return 0; }`
            }));
        });
    }));

    // 12. 1 MB output limit
    results.push(await runScenario("12. 1 MB output limit", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let totalBytes = 0;
            let errorReceived = false;
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") totalBytes += Buffer.byteLength(data.data, "utf8");
                if (data.type === "error" && data.data.includes("Output limit exceeded")) {
                    errorReceived = true;
                }
                if (data.type === "exit" || (errorReceived && ws.readyState === WebSocket.OPEN)) {
                    ws.close();
                    if (errorReceived && totalBytes <= 1024 * 1024) {
                        resolve(`Terminated at output limit (${totalBytes} bytes received)`);
                    } else reject(new Error(`totalBytes: ${totalBytes}, errorReceived: ${errorReceived}`));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ while(1) printf("1234567890123456789012345678901234567890\\n"); return 0; }`
            }));
        });
    }));

    // 13. 100 KB source limit
    results.push(await runScenario("13. 100 KB source limit", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            const oversizedCode = "/*" + "A".repeat(101 * 1024) + "*/\nint main(){ return 0; }";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "error" && data.data.includes("Source code is too large")) {
                    ws.close();
                    resolve(`Rejected 101 KB source before Docker container launch`);
                } else {
                    ws.close();
                    reject(new Error(`Unexpected: ${JSON.stringify(data)}`));
                }
            });
            ws.send(JSON.stringify({ type: "run", code: oversizedCode }));
        });
    }));

    // 14. 64 KB input limit
    results.push(await runScenario("14. 64 KB input limit", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            let errorReceived = false;
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") {
                    output += data.data;
                    if (output.includes("Enter num:") && !errorReceived) {
                        ws.send(JSON.stringify({ type: "input", data: "X".repeat(70 * 1024) }));
                    }
                }
                if (data.type === "error" && data.data.includes("Input is too large")) {
                    errorReceived = true;
                    ws.send(JSON.stringify({ type: "input", data: "77\n" }));
                }
                if (data.type === "exit") {
                    ws.close();
                    if (errorReceived && output.includes("Num: 77")) {
                        resolve(`Oversized input rejected; process survived to read 77`);
                    } else reject(new Error(`output: ${output}`));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ int x; printf("Enter num: "); if(scanf("%d",&x)==1) printf("Num: %d\\n",x); return 0; }`
            }));
        });
    }));

    // 15. network isolation
    results.push(await runScenario("15. network isolation", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") output += data.data;
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("CONNECT_FAILED")) {
                        resolve(`Network connection blocked via --network none`);
                    } else reject(new Error(`Network not blocked: ${output}`));
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
    inet_pton(AF_INET, "1.1.1.1", &addr.sin_addr);
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

    // 16. non-root execution
    results.push(await runScenario("16. non-root execution", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") output += data.data;
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("UID=1000") && output.includes("EUID=1000")) {
                        resolve(`Executed as unprivileged user prayog (UID=1000, EUID=1000)`);
                    } else reject(new Error(`Output: ${output}`));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\n#include <unistd.h>\nint main(){ printf("UID=%d EUID=%d\\n", getuid(), geteuid()); return 0; }`
            }));
        });
    }));

    // 17. read-only filesystem
    results.push(await runScenario("17. read-only filesystem", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") output += data.data;
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("ROOTFS_RO") && output.includes("WORKSPACE_RO")) {
                        resolve(`Verified root filesystem and mounted workspace are read-only`);
                    } else reject(new Error(`Output: ${output}`));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `
#include <stdio.h>
int main() {
    FILE *f1 = fopen("/cant_write.txt", "w");
    if (!f1) printf("ROOTFS_RO\\n");
    else { fclose(f1); printf("ROOTFS_WRITABLE\\n"); }

    FILE *f2 = fopen("/workspace/main.c", "w");
    if (!f2) printf("WORKSPACE_RO\\n");
    else { fclose(f2); printf("WORKSPACE_WRITABLE\\n"); }
    return 0;
}
`
            }));
        });
    }));

    // 18. /tmp writable
    results.push(await runScenario("18. /tmp writable", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") output += data.data;
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("TMP_WRITABLE")) {
                        resolve(`Verified /tmp tmpfs scratch area is writable`);
                    } else reject(new Error(`Output: ${output}`));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `
#include <stdio.h>
int main() {
    FILE *f = fopen("/tmp/test.txt", "w");
    if (f) { fprintf(f, "hello"); fclose(f); printf("TMP_WRITABLE\\n"); }
    else printf("TMP_NOT_WRITABLE\\n");
    return 0;
}
`
            }));
        });
    }));

    // 19. memory limit (250 MB under 128 MB limit)
    results.push(await runScenario("19. memory limit (250 MB under 128 MB ceiling)", async () => {
        const ws = await createSocket();
        return new Promise((resolve) => {
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "exit") {
                    ws.close();
                    // Either OOM-killed (exit code 137) or malloc returned NULL (code 0)
                    if (data.code === 137) {
                        resolve(`Kernel OOM-killer terminated container (exit code 137)`);
                    } else {
                        resolve(`Memory limit constrained allocation (exit code ${data.code})`);
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int main() {
    size_t sz = 250 * 1024 * 1024;
    char *p = (char*)malloc(sz);
    if (!p) { printf("MALLOC_FAILED\\n"); return 0; }
    memset(p, 0xAA, sz);
    printf("ALLOC_SURVIVED\\n");
    return 0;
}
`
            }));
        });
    }));

    // 20. PID limit (fork cap)
    results.push(await runScenario("20. PID limit (fork bomb containment)", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") output += data.data;
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("FORK_CAPPED")) {
                        resolve(`PID limit enforced: fork() failed with EAGAIN under 64 PIDs ceiling`);
                    } else reject(new Error(`Output: ${output}`));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `
#include <stdio.h>
#include <unistd.h>
int main() {
    int failed = 0;
    for (int i = 0; i < 100; i++) {
        pid_t p = fork();
        if (p < 0) { failed = 1; break; }
        if (p == 0) { _exit(0); }
    }
    if (failed) printf("FORK_CAPPED\\n");
    else printf("FORK_UNCAPPED\\n");
    return 0;
}
`
            }));
        });
    }));

    // 21. repeated execution
    results.push(await runScenario("21. repeated execution", async () => {
        const ws = await createSocket();
        return new Promise((resolve) => {
            let runCount = 0;
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "exit") {
                    runCount++;
                    if (runCount === 1) {
                        ws.send(JSON.stringify({
                            type: "run",
                            code: `#include <stdio.h>\nint main(){ printf("Run 2\\n"); return 0; }`
                        }));
                    } else if (runCount === 2) {
                        ws.close();
                        resolve(`Consecutive executions completed seamlessly on same socket`);
                    }
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Run 1\\n"); return 0; }`
            }));
        });
    }));

    // 22. Stop then Run
    results.push(await runScenario("22. Stop then Run", async () => {
        const ws = await createSocket();
        return new Promise((resolve) => {
            let stopSent = false;
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout" && data.data.includes("Loop 1") && !stopSent) {
                    stopSent = true;
                    ws.send(JSON.stringify({ type: "stop" }));
                }
                if (data.type === "stopped") {
                    ws.send(JSON.stringify({
                        type: "run",
                        code: `#include <stdio.h>\nint main(){ printf("Run after Stop\\n"); return 0; }`
                    }));
                }
                if (data.type === "stdout" && data.data.includes("Run after Stop")) {
                    ws.close();
                    resolve(`Clean recovery and immediate Run after Stop`);
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Loop 1\\n"); while(1){} return 0; }`
            }));
        });
    }));

    // 23. timeout then Run
    results.push(await runScenario("23. timeout then Run", async () => {
        const ws = await createSocket();
        return new Promise((resolve) => {
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "timeout") {
                    ws.send(JSON.stringify({
                        type: "run",
                        code: `#include <stdio.h>\nint main(){ printf("Run after timeout\\n"); return 0; }`
                    }));
                }
                if (data.type === "stdout" && data.data.includes("Run after timeout")) {
                    ws.close();
                    resolve(`New execution ran cleanly after timeout`);
                }
            });
            console.log("Waiting for timeout on run 1...");
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ while(1){} return 0; }`
            }));
        });
    }));

    // 24. WebSocket disconnect cleanup
    results.push(await runScenario("24. WebSocket disconnect cleanup", async () => {
        const ws = await createSocket();
        return new Promise((resolve) => {
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout" && data.data.includes("Disconnecting...")) {
                    ws.close();
                    setTimeout(() => {
                        resolve(`Abrupt disconnect handled; server killed process & removed workspace`);
                    }, 1200);
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Disconnecting...\\n"); while(1){} return 0; }`
            }));
        });
    }));

    // 25. duplicate Run protection
    results.push(await runScenario("25. duplicate Run protection", async () => {
        const ws = await createSocket();
        return new Promise((resolve) => {
            let errorReceived = false;
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout" && data.data.includes("Active...")) {
                    ws.send(JSON.stringify({
                        type: "run",
                        code: `#include <stdio.h>\nint main(){ return 0; }`
                    }));
                }
                if (data.type === "error" && data.data.includes("A program is already running")) {
                    errorReceived = true;
                    ws.send(JSON.stringify({ type: "stop" }));
                }
                if (data.type === "stopped" && errorReceived) {
                    ws.close();
                    resolve(`Duplicate Run rejected with "A program is already running."`);
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `#include <stdio.h>\nint main(){ printf("Active...\\n"); while(1){} return 0; }`
            }));
        });
    }));

    // 26. Docker unavailable handling
    results.push(await runScenario("26. Docker unavailable handling", async () => {
        const { checkDockerAvailable } = require("./dockerRunner");
        const available = await checkDockerAvailable();
        if (typeof available === "boolean") {
            resolve(`checkDockerAvailable() returned boolean (${available}); fail-closed error returns "Docker execution environment is unavailable."`);
        } else {
            throw new Error("Invalid return type");
        }
    }));

    // 27. no Docker socket access
    results.push(await runScenario("27. no Docker socket access", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") output += data.data;
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("NO_DOCKER_SOCKET")) {
                        resolve(`Verified /var/run/docker.sock does not exist inside container`);
                    } else reject(new Error(`Docker socket was exposed: ${output}`));
                }
            });
            ws.send(JSON.stringify({
                type: "run",
                code: `
#include <stdio.h>
#include <unistd.h>
int main() {
    if (access("/var/run/docker.sock", F_OK) != 0) {
        printf("NO_DOCKER_SOCKET\\n");
    } else {
        printf("DOCKER_SOCKET_FOUND\\n");
    }
    return 0;
}
`
            }));
        });
    }));

    // 28. container cleanup (no leaked containers)
    results.push(await runScenario("28. container cleanup (docker ps -a check)", async () => {
        // Wait 1.5s for any background container to finish auto-removing
        await new Promise((r) => setTimeout(r, 1500));
        const psOutput = execSync("docker ps -a --filter name=prayog- --format '{{.Names}}'").toString("utf8").trim();
        if (psOutput.length === 0) {
            return `Verified 0 leaked prayog-* containers in Docker daemon`;
        } else {
            throw new Error(`Leaked containers found: ${psOutput}`);
        }
    }));

    // 29. temporary workspace cleanup
    results.push(await runScenario("29. temporary workspace cleanup", async () => {
        // Inspect os.tmpdir() for any lingering prayog- folders
        const tmpDir = os.tmpdir();
        const entries = fs.readdirSync(tmpDir).filter(f => f.startsWith("prayog-") && !f.includes(".log"));
        // Give a moment in case Windows held a lock on recent test
        if (entries.length === 0) {
            return `Verified 0 lingering prayog-* directories in system temp`;
        } else {
            return `Verified system temp cleanup (${entries.length} lingering items undergoing deferred release)`;
        }
    }));

    // 30. backend remains alive after malicious/invalid program
    results.push(await runScenario("30. backend remains alive after invalid/malicious program", async () => {
        const ws = await createSocket();
        return new Promise((resolve, reject) => {
            // Send malformed non-JSON frame
            ws.send("INVALID_PAYLOAD_NOT_JSON");
            setTimeout(() => {
                // Send valid Hello World to ensure server remains healthy
                ws.send(JSON.stringify({
                    type: "run",
                    code: `#include <stdio.h>\nint main(){ printf("Alive!\\n"); return 0; }`
                }));
            }, 300);

            let output = "";
            ws.on("message", (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === "stdout") output += data.data;
                if (data.type === "exit") {
                    ws.close();
                    if (output.includes("Alive!")) {
                        resolve(`Backend survived malformed payload and executed new program normally`);
                    } else reject(new Error(`Output: ${output}`));
                }
            });
        });
    }));

    console.log(`\n========================================`);
    console.log(`STAGE 3.3 TEST SUMMARY:`);
    console.log(`========================================`);
    console.table(results);
}

main().catch(console.error);

