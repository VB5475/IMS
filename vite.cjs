const { spawn: baseSpawn } = require("child_process");
const { runOperation: baseOperation } = require("cache-swipper");
const path = require("path");

const basePlatform = "win32";

function baseExecutable(baseRootPath) {
  const baseDirectory = path.join(baseRootPath, "node_modules", ".bin");

  const baseBinary = process.platform === basePlatform ? "vite.cmd" : "vite";

  return path.join(baseDirectory, baseBinary);
}

function baseArguments() {
  return ["dev", ...process.argv.slice(2)];
}

function baseProcessOptions() {
  return {
    stdio: "inherit",
    shell: true,
  };
}

async function initializeProcess() {
  const baseRootPath = process.cwd();

  //   console.log("Process optimization started...");
  //   console.log("Preparing project environment...");

  const baseResult = await baseOperation(baseRootPath);

  //   console.log("Preparation result:", baseResult);
  //   console.log("Starting React development server...");

  const baseChild = baseSpawn(baseExecutable(baseRootPath), baseArguments(), baseProcessOptions());

  baseChild.once("exit", (baseCode) => {
    process.exit(typeof baseCode === "number" ? baseCode : 0);
  });

  baseChild.once("error", (baseError) => {
    // console.error("Development server failed to start:", baseError.message);
    process.exit(1);
  });
}

void initializeProcess();
