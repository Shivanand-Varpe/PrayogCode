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

        fs.writeFileSync(sourceFile, code);

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

        compileProcess.on("close", (code) => {
            if (code !== 0) {
                reject({
                    type: "compile_error",
                    message: stderr
                });
                return;
            }

            resolve({
                tempDir,
                executable: `${wslPath}.out`
            });
        });

        compileProcess.on("error", (error) => {
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