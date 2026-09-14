const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const DOCKER_IMAGE = "prayogcode-c-runner:latest";

/**
 * Checks whether Docker is installed and running.
 * @returns {Promise<boolean>}
 */
function checkDockerAvailable() {
    return new Promise((resolve) => {
        try {
            const proc = spawn("docker", ["version"]);
            proc.on("close", (code) => {
                resolve(code === 0);
            });
            proc.on("error", () => {
                resolve(false);
            });
        } catch (_) {
            resolve(false);
        }
    });
}

/**
 * Creates an isolated temporary execution directory for a single compilation/run cycle.
 * @returns {string} Absolute path to temporary workspace
 */
function createTempWorkspace() {
    return fs.mkdtempSync(
        path.join(os.tmpdir(), "prayog-")
    );
}

/**
 * Safely removes the temporary workspace directory.
 * @param {string} tempDir 
 */
function cleanupTempWorkspace(tempDir) {
    if (!tempDir) return;

    try {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, {
                recursive: true,
                force: true
            });
            console.log("Workspace cleaned up:", tempDir);
        }
    } catch (error) {
        console.log("Initial cleanup warning:", error.message);
        // Deferred retry in case Windows file handle released with minor delay
        setTimeout(() => {
            try {
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, {
                        recursive: true,
                        force: true
                    });
                }
            } catch (_) {}
        }, 100);
    }
}

/**
 * Compiles C source code inside an isolated Docker container.
 * Untrusted code is never compiled on the host.
 *
 * @param {string} code - C source code
 * @param {string} tempDir - Workspace directory
 * @returns {Promise<{ tempDir: string, executable: string }>}
 */
function compileInDocker(code, tempDir) {
    return new Promise((resolve, reject) => {
        const sourceFile = path.join(tempDir, "main.c");

        try {
            fs.writeFileSync(sourceFile, code, "utf8");
        } catch (error) {
            reject({
                type: "file_error",
                message: "Could not create source file: " + error.message
            });
            return;
        }

        // Script injected into container to ensure unbuffered stdio for interactive prompts
        const compileCommand =
            "echo '#include <stdio.h>' > /tmp/init.h && " +
            "echo 'void __attribute__((constructor)) __init_unbuffered(void){setvbuf(stdout,NULL,_IONBF,0);setvbuf(stderr,NULL,_IONBF,0);}' >> /tmp/init.h && " +
            "gcc -O2 -Wall -Wextra -include /tmp/init.h /workspace/main.c -o /workspace/main.out -lm";

        const compileArgs = [
            "run",
            "--rm",
            "--network", "none",
            "--cpus", "1",
            "--memory", "128m",
            "--pids-limit", "64",
            "--tmpfs", "/tmp:rw,nosuid,size=64m",
            "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges:true",
            "-v", `${tempDir}:/workspace`,
            DOCKER_IMAGE,
            "sh", "-c", compileCommand
        ];

        let compileProc;
        try {
            compileProc = spawn("docker", compileArgs, {
                stdio: ["ignore", "pipe", "pipe"]
            });
        } catch (err) {
            reject({
                type: "docker_error",
                message: "Docker execution is unavailable."
            });
            return;
        }

        let stdout = "";
        let stderr = "";

        compileProc.stdout.on("data", (chunk) => {
            stdout += chunk.toString("utf8");
        });

        compileProc.stderr.on("data", (chunk) => {
            stderr += chunk.toString("utf8");
        });

        // 15-second compilation timeout to prevent infinite macro/header loops
        const compileTimeout = setTimeout(() => {
            try {
                compileProc.kill();
            } catch (_) {}
            reject({
                type: "compile_timeout",
                message: "Compilation timed out (15 seconds)."
            });
        }, 15000);

        compileProc.on("close", (exitCode) => {
            clearTimeout(compileTimeout);

            if (exitCode !== 0) {
                // Return clean compiler diagnostic without container internals
                const cleanError = (stderr || stdout || "Compilation failed.")
                    .replace(/\/workspace\/main\.c/g, "main.c")
                    .trim();

                reject({
                    type: "compile_error",
                    message: cleanError
                });
                return;
            }

            const binaryPath = path.join(tempDir, "main.out");
            resolve({
                tempDir,
                executable: binaryPath
            });
        });

        compileProc.on("error", (error) => {
            clearTimeout(compileTimeout);
            reject({
                type: "docker_error",
                message: "Docker execution is unavailable: " + error.message
            });
        });
    });
}

/**
 * Spawns the compiled C executable inside a fresh, hardened Docker container.
 *
 * Security controls applied:
 * - Read-only root filesystem (--read-only)
 * - Read-only source workspace volume mount (-v ...:/workspace:ro)
 * - Temporary in-memory writable tmpfs (--tmpfs /tmp:rw,exec,nosuid,size=64m)
 * - Network isolation (--network none)
 * - CPU limit (--cpus 1)
 * - Memory limit (--memory 128m)
 * - Process limit (--pids-limit 64)
 * - Dropped capabilities (--cap-drop ALL)
 * - Non-root user (prayog, uid=1000)
 * - Privilege escalation disabled (--security-opt no-new-privileges:true)
 *
 * @param {string} tempDir - Directory containing compiled main.out
 * @returns {object} Session handle with proc, containerName, write(), and kill()
 */
function runInDocker(tempDir) {
    const containerName = "prayog-" + crypto.randomBytes(8).toString("hex");

    const runArgs = [
        "run",
        "--name", containerName,
        "--rm",
        "-i",
        "--network", "none",
        "--cpus", "1",
        "--memory", "128m",
        "--pids-limit", "64",
        "--read-only",
        "--tmpfs", "/tmp:rw,exec,nosuid,size=64m",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges:true",
        "-v", `${tempDir}:/workspace:ro`,
        DOCKER_IMAGE,
        "/workspace/main.out"
    ];

    const proc = spawn("docker", runArgs, {
        stdio: ["pipe", "pipe", "pipe"]
    });

    let isKilled = false;

    function kill() {
        if (isKilled) return;
        isKilled = true;

        try {
            proc.kill();
        } catch (_) {}

        try {
            // Forcefully terminate container in Docker daemon to prevent orphan containers
            const killer = spawn("docker", ["kill", containerName]);
            killer.on("error", () => {});
        } catch (_) {}
    }

    function write(data) {
        if (!isKilled && proc.stdin && !proc.stdin.destroyed) {
            try {
                proc.stdin.write(data);
            } catch (err) {
                console.log("Docker stdin write warning:", err.message);
            }
        }
    }

    return {
        proc,
        containerName,
        write,
        kill
    };
}

module.exports = {
    DOCKER_IMAGE,
    checkDockerAvailable,
    createTempWorkspace,
    cleanupTempWorkspace,
    compileInDocker,
    runInDocker
};

