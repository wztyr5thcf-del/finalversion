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
      },
      env_file: "/opt/creatools/infra/.env",
      watch: false,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
