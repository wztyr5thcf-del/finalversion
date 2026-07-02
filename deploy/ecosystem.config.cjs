// PM2 Ecosystem Configuration for Creatools API Server
// Run with: pm2 start ecosystem.config.cjs
// Cluster mode with 2 instances (optimized for c6i.large with 2 vCPUs)
//
// IMPORTANT: Environment variables are loaded by deploy.sh (via `set -a; source .env`)
// before starting PM2. Do NOT rely on PM2's env block for secrets - it only holds
// defaults. Any manual restart should use:
//   cd /opt/creatools/app/deploy && set -a && source .env && set +a && pm2 restart ecosystem.config.cjs --update-env

module.exports = {
  apps: [
    {
      name: 'creatools-api',
      script: '/opt/creatools/app/artifacts/api-server/dist/index.mjs',
      cwd: '/opt/creatools/app/artifacts/api-server',
      node_args: '--enable-source-maps',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      // Watch (disabled in production)
      watch: false,
      // Logs
      log_file: '/opt/creatools/logs/combined.log',
      out_file: '/opt/creatools/logs/out.log',
      error_file: '/opt/creatools/logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Memory limit (restart if exceeds)
      max_memory_restart: '1G',
    },
  ],
};
