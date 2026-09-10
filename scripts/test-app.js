const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const requiredFiles = [
  "package.json",
  "app.json",
  "App.js",
  "app",
  "components",
  "contexts",
  "hooks",
  "lib",
  "screens",
];

function assertProjectFiles() {
  const missing = requiredFiles.filter((file) => {
    return !fs.existsSync(path.join(projectRoot, file));
  });

  if (missing.length > 0) {
    throw new Error(`Missing project files or folders: ${missing.join(", ")}`);
  }

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
  );
  if (packageJson.main !== "expo-router/entry") {
    throw new Error("package.json must use expo-router/entry as its main entry point");
  }
}

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

try {
  console.log("Checking Expo app structure...");
  assertProjectFiles();
  console.log("App structure OK.");

  run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "lint"]);
  run(process.platform === "win32" ? "npx.cmd" : "npx", [
    "expo",
    "export",
    "--platform",
    "web",
    "--output-dir",
    ".expo/test-export",
  ]);

  console.log("\nApp smoke tests passed.");
} catch (error) {
  console.error(`\nApp smoke tests failed: ${error.message}`);
  process.exit(1);
}