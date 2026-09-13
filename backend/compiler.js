const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

function createTempFolder() {
    return fs.mkdtempSync(
        path.join(os.tmpdir(), "prayogcode-")
    );
}

function compileC(code) {
    return new Promise((resolve, reject) => {
        const tempDir = createTempFolder();

        const sourceFile = path.join(tempDir, "main.c");
        const outputFile = path.join(tempDir, "main.exe");

        fs.writeFileSync(sourceFile, code);

        const gcc = spawn(
            "gcc",
            ["main.c", "-o", "main.exe"],
            {
                cwd: tempDir
            }
        );

        let stderr = "";

        gcc.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        gcc.on("close", (code) => {
            if (code !== 0) {
                reject({
                    type: "compile_error",
                    message: stderr
                });
                return;
            }

            resolve({
                tempDir,
                executable: outputFile
            });
        });

        gcc.on("error", (error) => {
            reject({
                type: "gcc_error",
                message: error.message
            });
        });
    });
}

module.exports = {
    compileC
};