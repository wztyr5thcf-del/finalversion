#!/usr/bin/env node
// =============================================================================
// GitHub Webhook Listener for Auto-Deploy
// Listens on port 9000 for GitHub push events and triggers a deploy.
// =============================================================================

const http = require('http');
const crypto = require('crypto');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.WEBHOOK_PORT || 9000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const DEPLOY_SCRIPT = path.join(__dirname, 'deploy.sh');
const LOG_FILE = process.env.WEBHOOK_LOG || '/var/log/webhook-deploy.log';

// =============================================================================
// Logging
// =============================================================================

function log(level, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (err) {
    // If we can't write to log file, just continue with stdout
  }
}

// =============================================================================
// Signature Validation
// =============================================================================

function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET) {
    log('warn', 'WEBHOOK_SECRET not set - skipping signature validation');
    return true;
  }

  if (!signature) {
    log('error', 'No signature header received');
    return false;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (err) {
    log('error', `Signature comparison failed: ${err.message}`);
    return false;
  }
}

// =============================================================================
// Deploy Execution
// =============================================================================

let isDeploying = false;

function runDeploy(event) {
  if (isDeploying) {
    log('warn', 'Deploy already in progress, skipping this trigger');
    return;
  }

  isDeploying = true;
  log('info', `Starting deploy triggered by: ${event}`);

  execFile('/bin/bash', [DEPLOY_SCRIPT], {
    cwd: path.dirname(DEPLOY_SCRIPT),
    timeout: 600000, // 10 minute timeout
    env: { ...process.env, PATH: process.env.PATH }
  }, (error, stdout, stderr) => {
    isDeploying = false;

    if (error) {
      log('error', `Deploy failed: ${error.message}`);
      if (stderr) log('error', `stderr: ${stderr}`);
    } else {
      log('info', 'Deploy completed successfully');
    }

    if (stdout) {
      log('info', `Deploy output: ${stdout.slice(-2000)}`);
    }
  });
}

// =============================================================================
// HTTP Server
// =============================================================================

const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', deploying: isDeploying }));
    return;
  }

  // Only accept POST to /webhook
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString();
    // Limit body size to 10MB
    if (body.length > 10 * 1024 * 1024) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload too large' }));
      req.destroy();
    }
  });

  req.on('end', () => {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];
    const deliveryId = req.headers['x-github-delivery'];

    log('info', `Received event: ${event}, delivery: ${deliveryId}`);

    // Verify webhook signature
    if (!verifySignature(body, signature)) {
      log('error', `Invalid signature for delivery: ${deliveryId}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid signature' }));
      return;
    }

    // Handle ping event (GitHub sends this on webhook creation)
    if (event === 'ping') {
      log('info', 'Received ping event - webhook is configured correctly');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'pong' }));
      return;
    }

    // Only deploy on push events
    if (event !== 'push') {
      log('info', `Ignoring event type: ${event}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Event ignored', event }));
      return;
    }

    // Parse payload to get branch info
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (err) {
      log('error', `Failed to parse payload: ${err.message}`);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      return;
    }

    const ref = payload.ref || '';
    const branch = ref.replace('refs/heads/', '');
    const pusher = payload.pusher ? payload.pusher.name : 'unknown';

    log('info', `Push to branch "${branch}" by ${pusher}`);

    // Only deploy from main branch (configurable)
    const deployBranch = process.env.DEPLOY_BRANCH || 'main';
    if (branch !== deployBranch) {
      log('info', `Ignoring push to "${branch}" (deploy branch is "${deployBranch}")`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: `Ignored push to ${branch}` }));
      return;
    }

    // Trigger deploy
    runDeploy(`push to ${branch} by ${pusher} (delivery: ${deliveryId})`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Deploy triggered', branch }));
  });
});

// =============================================================================
// Start Server
// =============================================================================

server.listen(PORT, () => {
  log('info', `Webhook server listening on port ${PORT}`);
  log('info', `Deploy script: ${DEPLOY_SCRIPT}`);
  log('info', `Deploy branch: ${process.env.DEPLOY_BRANCH || 'main'}`);
  log('info', `Signature validation: ${WEBHOOK_SECRET ? 'enabled' : 'DISABLED (no WEBHOOK_SECRET set)'}`);
});

server.on('error', (err) => {
  log('error', `Server error: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    log('info', 'Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('info', 'Received SIGINT, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
