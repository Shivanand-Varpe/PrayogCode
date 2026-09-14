const {
    checkDockerAvailable,
    createTempWorkspace,
    cleanupTempWorkspace,
    compileInDocker,
    runInDocker
} = require("./dockerRunner");

async function main() {
    console.log("Checking Docker availability...");
    const available = await checkDockerAvailable();
    console.log("Docker available:", available);
    if (!available) {
        console.error("Docker not available!");
        process.exit(1);
    }

    const tempDir = createTempWorkspace();
    console.log("Created temp workspace:", tempDir);

    const testCode = `
#include <stdio.h>
int main() {
    int a, b;
    printf("Enter two numbers: ");
    if (scanf("%d %d", &a, &b) == 2) {
        printf("Sum = %d\\n", a + b);
    }
    return 0;
}
`;

    console.log("Compiling code in Docker...");
    const compileResult = await compileInDocker(testCode, tempDir);
    console.log("Compiled successfully:", compileResult.executable);

    console.log("Running executable in Docker...");
    const session = runInDocker(tempDir);

    session.proc.stdout.on("data", (data) => {
        const text = data.toString("utf8");
        console.log("CONTAINER STDOUT:", text);
        if (text.includes("Enter two numbers:")) {
            console.log("Sending input: 10 20");
            session.write("10 20\n");
        }
    });

    session.proc.stderr.on("data", (data) => {
        console.log("CONTAINER STDERR:", data.toString("utf8"));
    });

    session.proc.on("close", (code) => {
        console.log("CONTAINER CLOSED with code:", code);
        cleanupTempWorkspace(tempDir);
        console.log("TEST FINISHED SUCCESSFULLY!");
    });
}

main().catch((err) => {
    console.error("TEST FAILED:", err);
    process.exit(1);
});

