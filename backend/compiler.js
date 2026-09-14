const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

function createTempFolder() {
    return fs.mkdtempSync(
        path.join(os.tmpdir(), "prayogcode-")
    );
}

function cleanupTempFolder(tempDir) {
    if (!tempDir) return;

    try {
        fs.rmSync(tempDir, {
            recursive: true,
            force: true
        });
    } catch (error) {
        console.log("Cleanup error:", error.message);
    }
}

function compileC(code) {
    return new Promise((resolve, reject) => {
        const tempDir = createTempFolder();

        const sourceFile = path.join(tempDir, "main.c");

        try {
            fs.writeFileSync(sourceFile, code);
        } catch (error) {
            cleanupTempFolder(tempDir);

            reject({
                type: "file_error",
                message: "Could not create source file."
            });

            return;
        }

        const wslPath = `/mnt/${sourceFile[0].toLowerCase()}${sourceFile
            .slice(2)
            .replace(/\\/g, "/")}`;

        const compileProcess = spawn(
            "wsl",
            ["gcc", wslPath, "-o", `${wslPath}.out`]
        );

        let stderr = "";

        compileProcess.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        compileProcess.on("close", (exitCode) => {
            if (exitCode !== 0) {
                cleanupTempFolder(tempDir);

                reject({
                    type: "compile_error",
                    message: stderr.trim() || "Compilation failed."
                });

                return;
            }

            resolve({
                tempDir,
                executable: `${wslPath}.out`
            });
        });

        compileProcess.on("error", (error) => {
            cleanupTempFolder(tempDir);

            reject({
                type: "gcc_error",
                message: "Compiler error: " + error.message
            });
        });
    });
}

module.exports = {
    compileC
};