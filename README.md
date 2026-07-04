# Creatools 🎬

**Real-time TikTok LIVE monitoring dashboard** — visualize top live channels, monitore streams em tempo real via WebSocket, e faça verificação em massa do status de múltiplas contas.

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js)
![pnpm](https://img.shields.io/badge/pnpm-workspaces-F69220)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow)

---

## 📖 Índice

- [Quick Start](#-quick-start)
- [Stack Tecnológico](#-stack-tecnológico)
- [Arquitetura](#-arquitetura)
- [Desenvolvimento Local](#-desenvolvimento-local)
- [Deploy AWS](#-deploy-aws)
- [Estrutura de Diretórios](#-estrutura-de-diretórios)
- [API & Validação](#-api--validação)
- [Troubleshooting](#-troubleshooting)

---

## ⚡ Quick Start

### Pré-requisitos
- **Node.js 24+** e **pnpm**
- **Git** para clonar o repositório

### Instalação
```bash
git clone https://github.com/wztyr5thcf-del/finalversion.git
cd finalversion
pnpm install
```

### Desenvolvimento Local
```bash
# Terminal 1 - API (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 - Frontend (port 18853)
pnpm --filter @workspace/creatools run dev

# Typecheck tudo
pnpm run typecheck

# Build tudo
pnpm run build
```

### Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz:
```bash
# API Server
TIKTOOLS_API_KEY=your_api_key_here
NODE_ENV=development

# Database (para AWS deployment)
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

---

## 🛠 Stack Tecnológico

| Tecnologia | Versão | Propósito |
|---|---|---|
| **Node.js** | 24 | Runtime |
| **TypeScript** | 5.9 | Type safety |
| **pnpm** | Latest | Package manager (workspaces) |
| **Express** | 5 | Backend API (port 8080) |
| **React** | 19.1.0 | Frontend UI |
| **Vite** | 7.3.2 | Frontend bundler |
| **Tailwind CSS** | 4.1.14 | Styling |
| **Zod** | 3.25.76 | Schema validation |
| **Drizzle ORM** | 0.45.2 | Database layer |
| **PostgreSQL** | 8.22.0 | Database (AWS RDS) |
| **JWT** | 9.0.3 | Authentication |
| **Stripe** | 22.3.0 | Payments |

---

## 🏗 Arquitetura

### Componentes Principais

```
finalversion/
├── artifacts/
│   ├── api-server/          # Express API backend
│   │   ├── src/routes/      # Endpoints (tiktok, config, health)
│   │   ├── data/config.json # Config persistence
│   │   └── dist/            # Build output
│   ├── creatools/           # React frontend
│   │   ├── src/pages/       # Dashboard, Monitor, Bulk Check, Settings
│   │   └── src/components/  # React components
│   └── db/                  # Database migrations (AWS RDS)
├── lib/
│   ├── api-spec/           # OpenAPI spec (source of truth)
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas
│   └── integrations/       # External service integrations
├── scripts/                # Utility scripts
└── infra/                  # Terraform/CloudFormation (AWS)
```

### Fluxo de Dados

```
Frontend (React)
    ↓
JWT Request → /api/jwt endpoint
    ↓
Backend (Express) — Issues JWT Token
    ↓
Frontend opens WebSocket → wss://api.tik.tools?jwtKey=token
    ↓
Tik.tools API — Returns real-time stream data
```

### Key Decisions

- **No database local**: Todos os dados são proxied em tempo real do tik.tools
- **Server-side API Key**: Frontend nunca acessa a chave da API diretamente
- **WebSocket direto do browser**: Monitor abre conexão WebSocket direto, após obter JWT
- **Contract-first API**: OpenAPI spec → Orval codegen → React Query + Zod

---

## 💻 Desenvolvimento Local

### Estrutura de Workspaces (pnpm)

```yaml
# pnpm-workspace.yaml
packages:
  - artifacts/*      # Production artifacts
  - lib/*            # Shared libraries
  - scripts          # Utility scripts
```

### Scripts Importantes

```bash
# API Development
pnpm --filter @workspace/api-server run dev    # Start dev server
pnpm --filter @workspace/api-server run build  # Build for production

# Frontend Development
pnpm --filter @workspace/creatools run dev     # Start dev server

# Code Generation
pnpm --filter @workspace/api-spec run codegen  # Regenerate types from OpenAPI

# Validation & Build
pnpm run typecheck                  # Full typecheck
pnpm run typecheck:libs             # Libs only
pnpm run build                      # Typecheck + build all
```

### Debugging

```bash
# Inspect API requests (node debug mode)
node --inspect ./dist/index.mjs

# Frontend hot reload
pnpm --filter @workspace/creatools run dev

# Database migrations (Drizzle)
pnpm --filter @workspace/db run migrate
```

---

## 🚀 Deploy AWS

### Pré-requisitos AWS
- ✅ AWS Account
- ✅ EC2 instance (t3.small ou maior)
- ✅ RDS PostgreSQL database
- ✅ Security Groups configurados
- ✅ AWS CLI configured

### Setup AWS EC2 + RDS

1. **Launch EC2 Instance**
   ```bash
   # Ubuntu 24.04 LTS recommended
   # Security Group: Allow ports 80, 443, 8080 (API), 22 (SSH)
   # Instance Type: t3.small (1GB RAM) or t3.medium (2GB RAM)
   ```

2. **Connect & Install Dependencies**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-public-ip
   
   # Install Node.js & pnpm
   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
   sudo apt install -y nodejs
   npm install -g pnpm
   
   # Install Postgres client
   sudo apt install -y postgresql-client
   ```

3. **Clone & Deploy Repository**
   ```bash
   cd /opt
   git clone https://github.com/wztyr5thcf-del/finalversion.git
   cd finalversion
   pnpm install
   pnpm run build
   ```

4. **Configure Environment**
   ```bash
   cat > .env.production << EOF
   NODE_ENV=production
   TIKTOOLS_API_KEY=your_api_key
   DATABASE_URL=postgresql://user:password@rds-endpoint:5432/dbname
   PORT=8080
   EOF
   
   chmod 600 .env.production
   ```

5. **Setup PM2 (Process Manager)**
   ```bash
   sudo npm install -g pm2
   pm2 start "pnpm --filter @workspace/api-server start" --name creatools-api
   pm2 save
   pm2 startup
   ```

6. **Configure Nginx (Reverse Proxy)**
   ```bash
   sudo apt install -y nginx
   
   sudo tee /etc/nginx/sites-available/creatools > /dev/null << 'EOF'
   server {
       listen 80;
       server_name your-domain.com;
   
       location / {
           proxy_pass http://localhost:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   EOF
   
   sudo ln -s /etc/nginx/sites-available/creatools /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

7. **SSL Certificate (Let's Encrypt)**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

### Health Check
```bash
curl http://localhost:8080/api/health
# Expected: { "status": "ok" }
```

---

## 📁 Estrutura de Diretórios

```
finalversion/
├── .github/
│   └── workflows/        # CI/CD pipelines
├── artifacts/
│   ├── api-server/       # Express backend
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── tiktok.ts
│   │   │   │   ├── config.ts
│   │   │   │   └── health.ts
│   │   │   └── middleware/
│   │   ├── data/
│   │   │   └── config.json
│   │   ├── build.mjs
│   │   └── package.json
│   ├── creatools/        # React frontend
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── dashboard.tsx
│   │   │   │   ├── monitor.tsx
│   │   │   │   ├── bulk-check.tsx
│   │   │   │   └── settings.tsx
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   └── app-layout.tsx
│   │   │   │   └── ui/
│   │   │   ├── index.html
│   │   │   └── app.tsx
│   │   └── vite.config.ts
│   └── db/               # Database layer
│       ├── schema.ts
│       └── migrations/
├── lib/
│   ├── api-spec/         # OpenAPI spec
│   │   └── openapi.yaml
│   ├── api-client-react/ # Generated hooks
│   │   └── src/generated/api.ts
│   ├── api-zod/          # Generated schemas
│   │   └── src/generated/api.ts
│   └── integrations/
│       ├── stripe/
│       └── tiktok/
├── scripts/              # Utility scripts
│   ├── src/
│   │   └── hello.ts
│   └── package.json
├── infra/                # Infrastructure as Code
│   ├── terraform/
│   └── cloudformation/
├── deploy/               # Deployment scripts
├── pnpm-workspace.yaml   # Workspace config
├── package.json
├── tsconfig.json
├── tsconfig.base.json
├── .gitignore
├── .npmrc
├── replit.md
└── README.md             # ← You are here
```

---

## 🔌 API & Validação

### OpenAPI Spec (Source of Truth)
- Localização: `lib/api-spec/openapi.yaml`
- **Após mudanças**, rode:
  ```bash
  pnpm --filter @workspace/api-spec run codegen
  ```

### Generated Files
- **React Hooks**: `lib/api-client-react/src/generated/api.ts` (React Query)
- **Zod Schemas**: `lib/api-zod/src/generated/api.ts` (Validation)

### Endpoints
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/tiktok/jwt` | Get JWT for WebSocket |
| `GET` | `/api/tiktok/live` | Get top live channels |
| `GET` | `/api/tiktok/user/:id` | Get user info |
| `POST` | `/api/config` | Update API key config |

---

## 🐛 Troubleshooting

### "port 8080 already in use"
```bash
lsof -i :8080
kill -9 <PID>
```

### "Module not found" errors
```bash
pnpm install
pnpm run typecheck
```

### WebSocket connection fails
- Verifique JWT no `/api/tiktok/jwt`
- Confirme TIKTOOLS_API_KEY está definida
- Check CORS settings em express

### Database connection errors
```bash
# Test RDS connection
psql -h rds-endpoint.amazonaws.com -U postgres -d dbname

# Check environment variables
echo $DATABASE_URL
```

### TypeScript errors after spec changes
```bash
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
pnpm run build
```

---

## 🔒 Security & Best Practices

- ✅ **Never commit `.env` files**
- ✅ **API Keys stored server-side only**
- ✅ **JWT for WebSocket authentication**
- ✅ **HTTPS enforced in production**
- ✅ **Minimum 1-day npm package release age** (supply-chain defense)
- ✅ **Regular dependency updates** via GitHub Actions

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make changes and typecheck: `pnpm run typecheck`
3. Commit: `git commit -m "feat: description"`
4. Push: `git push origin feat/your-feature`
5. Open a Pull Request

---

## 📜 License

MIT License — See LICENSE file

---

## 📞 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/wztyr5thcf-del/finalversion/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/wztyr5thcf-del/finalversion/discussions)
- 📧 **Email**: Contact via GitHub

---

**Last Updated**: July 2026 | Made with ❤️
