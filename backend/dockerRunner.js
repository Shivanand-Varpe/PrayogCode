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
        }
    } catch (error) {
        // Deferred retry in case Windows file handle released with minor latency
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
 * Security controls:
 * - Direct GCC binary invocation (NO shell / sh -c)
 * - Network disabled (--network none)
 * - Read-only root filesystem (--read-only)
 * - Ephemeral in-memory scratch space (--tmpfs /tmp:rw,nosuid,size=64m)
 * - Cgroup limits (1 CPU, 128 MB RAM, 64 PIDs)
 * - Dropped Linux capabilities (--cap-drop ALL)
 * - Privilege escalation disabled (--security-opt no-new-privileges:true)
 * - Non-root user (prayog, uid=1000)
 * - Uniquely named container for deterministic cancellation
 *
 * @param {string} code - C source code
 * @param {string} tempDir - Workspace directory
 * @returns {{ promise: Promise<{ tempDir: string, executable: string }>, kill: Function }}
 */
function compileInDocker(code, tempDir) {
    const sourceFile = path.join(tempDir, "main.c");
    const containerName = "prayog-cmp-" + crypto.randomBytes(8).toString("hex");

    try {
        fs.writeFileSync(sourceFile, code, "utf8");
    } catch (error) {
        return {
            promise: Promise.reject({
                type: "file_error",
                message: "Could not create source file: " + error.message
            }),
            kill: () => {}
        };
    }

    // Direct invocation of GCC without shell wrapper:
    // Uses pre-baked /etc/prayog/init.h for unbuffered stdout/stderr
    const compileArgs = [
        "run",
        "--name", containerName,
        "--rm",
        "--network", "none",
        "--cpus", "1",
        "--memory", "128m",
        "--pids-limit", "64",
        "--read-only",
        "--tmpfs", "/tmp:rw,nosuid,size=64m",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges:true",
        "-v", `${tempDir}:/workspace`,
        DOCKER_IMAGE,
        "gcc",
        "-O2",
        "-Wall",
        "-Wextra",
        "-include", "/etc/prayog/init.h",
        "/workspace/main.c",
        "-o", "/workspace/main.out",
        "-lm"
    ];

    let compileProc;
    try {
        compileProc = spawn("docker", compileArgs, {
            stdio: ["ignore", "pipe", "pipe"]
        });
    } catch (err) {
        return {
            promise: Promise.reject({
                type: "docker_error",
                message: "Docker execution environment is unavailable."
            }),
            kill: () => {}
        };
    }

    let isKilled = false;
    function kill() {
        if (isKilled) return;
        isKilled = true;
        try {
            compileProc.kill("SIGKILL");
        } catch (_) {}
        try {
            // Force-remove container directly in Docker daemon immediately (handles running, created, paused, and exited states)
            const remover = spawn("docker", ["rm", "-f", containerName]);
            remover.on("error", () => {});
        } catch (_) {}
    }

    const promise = new Promise((resolve, reject) => {
        let stdout = "";
        let stderr = "";

        compileProc.stdout.on("data", (chunk) => {
            stdout += chunk.toString("utf8");
        });

        compileProc.stderr.on("data", (chunk) => {
            stderr += chunk.toString("utf8");
        });

        // 15-second compilation ceiling to prevent compiler hangs
        const compileTimeout = setTimeout(() => {
            kill();
            reject({
                type: "compile_timeout",
                message: "Compilation timed out (15 seconds)."
            });
        }, 15000);

        compileProc.on("close", (exitCode) => {
            clearTimeout(compileTimeout);

            if (isKilled) {
                reject({
                    type: "compile_stopped",
                    message: "Compilation cancelled."
                });
                return;
            }

            if (exitCode !== 0) {
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
                message: "Docker execution environment is unavailable: " + error.message
            });
        });
    });

    return {
        promise,
        kill
    };
}

/**
 * Spawns the compiled C executable inside a fresh, hardened Docker container.
 *
 * Security controls:
 * - Read-only root filesystem (--read-only)
 * - Read-only source workspace volume mount (-v ...:/workspace:ro)
 * - Ephemeral in-memory writable tmpfs (--tmpfs /tmp:rw,exec,nosuid,size=64m)
 * - Network isolation (--network none)
 * - CPU limit (--cpus 1)
 * - Memory limit (--memory 128m)
 * - Process limit (--pids-limit 64)
 * - Dropped capabilities (--cap-drop ALL)
 * - Non-root user (prayog, uid=1000)
 * - Privilege escalation disabled (--security-opt no-new-privileges:true)
 * - Direct execution of binary without shell
 * - Dedicated unique container name
 *
 * @param {string} tempDir - Directory containing compiled main.out
 * @returns {object} Session handle with proc, containerName, write(), and kill()
 */
function runInDocker(tempDir) {
    const containerName = "prayog-run-" + crypto.randomBytes(8).toString("hex");

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
            if (proc.stdin && !proc.stdin.destroyed) {
                proc.stdin.destroy();
            }
            if (proc.stdout && !proc.stdout.destroyed) {
                proc.stdout.destroy();
            }
            if (proc.stderr && !proc.stderr.destroyed) {
                proc.stderr.destroy();
            }
            proc.kill("SIGKILL");
        } catch (_) {}

        try {
            // Force-remove container directly in Docker daemon immediately (handles running, created, paused, and exited states)
            const remover = spawn("docker", ["rm", "-f", containerName]);
            remover.on("error", () => {});
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
