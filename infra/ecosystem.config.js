const fs = require("fs");
const path = require("path");

// Load .env file and parse it into an object
function loadEnv(envPath) {
  const env = {};
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      env[key] = value;
    }
  } catch (e) {
    console.error("Failed to load .env file:", e.message);
  }
  return env;
}

const dotenvPath = path.resolve(__dirname, ".env");
const envVars = loadEnv(dotenvPath);

module.exports = {
  apps: [
    {
      name: "creatools-api",
      script: "./artifacts/api-server/dist/index.mjs",
      cwd: "/opt/creatools",
      node_args: "--enable-source-maps",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        NODE_TLS_REJECT_UNAUTHORIZED: "0",
        ...envVars,
      },
      watch: false,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
