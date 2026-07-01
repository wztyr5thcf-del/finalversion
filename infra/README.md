# Guia de Deploy - Creatools na AWS

Este guia descreve o processo completo para fazer deploy do Creatools na AWS usando CloudFormation.

## Arquitetura

```
                    Internet
                       |
                [Route 53 DNS]
                       |
            [ALB + ACM (HTTPS/SSL)]
                       |
                  [EC2 Instance]
                       |
              [Docker + Nginx + App]
                       |
              [RDS PostgreSQL (privado)]
```

**Dominios:**
- `creatools.co` - Site principal (frontend + API)
- `creatools.stream` - Links de overlay para streaming
- `creatools.live` - Links de perfil de usuario

## Pre-requisitos

1. **AWS CLI** configurado com credenciais de administrador
2. **Key Pair** EC2 criado na regiao desejada
3. **Dominios** registrados e acessiveis (creatools.co, creatools.stream, creatools.live)
4. **Git** - repositorio acessivel pela instancia EC2

### Instalar AWS CLI

```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configurar
aws configure
```

### Criar Key Pair

```bash
aws ec2 create-key-pair \
  --key-name creatools-key \
  --query 'KeyMaterial' \
  --output text > creatools-key.pem

chmod 400 creatools-key.pem
```

## Como Fazer Deploy

### Passo 1: Criar a Stack do CloudFormation

```bash
aws cloudformation create-stack \
  --stack-name creatools-production \
  --template-body file://infra/cloudformation.yaml \
  --parameters \
    ParameterKey=KeyPairName,ParameterValue=creatools-key \
    ParameterKey=DBPassword,ParameterValue=SUA_SENHA_FORTE_AQUI \
    ParameterKey=JWTSecret,ParameterValue=SEU_JWT_SECRET_AQUI_MIN_32_CHARS \
    ParameterKey=GitRepoURL,ParameterValue=https://github.com/seu-org/creatools.git \
    ParameterKey=InstanceType,ParameterValue=t3.medium \
    ParameterKey=DBInstanceClass,ParameterValue=db.t3.micro \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

> **Importante:** Use `us-east-1` para que o certificado ACM funcione com o ALB sem problemas.

### Passo 2: Acompanhar a Criacao

```bash
# Verificar status
aws cloudformation describe-stacks \
  --stack-name creatools-production \
  --query 'Stacks[0].StackStatus' \
  --output text

# Acompanhar eventos em tempo real
aws cloudformation wait stack-create-complete \
  --stack-name creatools-production

# Ver eventos (util para debug)
aws cloudformation describe-stack-events \
  --stack-name creatools-production \
  --query 'StackEvents[0:10].{Time:Timestamp,Resource:LogicalResourceId,Status:ResourceStatus,Reason:ResourceStatusReason}'
```

### Passo 3: Obter Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name creatools-production \
  --query 'Stacks[0].Outputs'
```

Isso retorna:
- `ALBDNSName` - DNS do Load Balancer
- `EC2PublicIP` - IP publico da instancia
- `RDSEndpoint` - Endpoint do banco de dados
- `HostedZoneCoNameServers` - Name servers para creatools.co
- `HostedZoneStreamNameServers` - Name servers para creatools.stream
- `HostedZoneLiveNameServers` - Name servers para creatools.live

## Parametros do CloudFormation

| Parametro | Padrao | Descricao |
|-----------|--------|-----------|
| `InstanceType` | t3.medium | Tipo da instancia EC2 |
| `DBInstanceClass` | db.t3.micro | Classe da instancia RDS |
| `DBPassword` | - | Senha do banco de dados (obrigatorio) |
| `DBUsername` | creatools | Usuario do banco de dados |
| `JWTSecret` | - | Chave secreta para tokens JWT (obrigatorio) |
| `DomainName` | creatools.co | Dominio principal |
| `KeyPairName` | - | Key Pair para acesso SSH (obrigatorio) |
| `GitRepoURL` | - | URL do repositorio Git |

## Validacao do Certificado SSL (ACM)

O certificado ACM usa validacao por DNS. Apos a stack criar as Hosted Zones:

### Passo 1: Configurar Name Servers nos Registradores

Para cada dominio, configure os name servers retornados no output da stack:

1. Acesse o painel do registrador de cada dominio
2. Atualize os name servers para os valores do output do CloudFormation
3. Aguarde a propagacao DNS (pode levar ate 48h, geralmente 15-30min)

### Passo 2: Validacao Automatica

O CloudFormation configura os registros de validacao DNS automaticamente nas Hosted Zones.
O certificado sera validado assim que os name servers propagarem.

### Verificar Status do Certificado

```bash
# Listar certificados
aws acm list-certificates --region us-east-1

# Ver detalhes do certificado
aws acm describe-certificate \
  --certificate-arn ARN_DO_CERTIFICADO \
  --query 'Certificate.{Status:Status,DomainValidationOptions:DomainValidationOptions}'
```

## Configuracao Pos-Deploy

### 1. Acessar a Instancia EC2

```bash
ssh -i creatools-key.pem ec2-user@IP_DA_INSTANCIA
```

### 2. Verificar Status dos Containers

```bash
cd /opt/creatools/infra
docker compose ps
docker compose logs -f
```

### 3. Configurar Variaveis do Stripe

Edite o arquivo `.env` na instancia:

```bash
sudo nano /opt/creatools/infra/.env
```

Adicione suas chaves do Stripe:
```
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_PRICE_ID_BASIC=price_xxx
STRIPE_PRICE_ID_PRO=price_xxx
```

Reinicie os containers:
```bash
docker compose restart api
```

### 4. Configurar Webhook do Stripe

No painel do Stripe, crie um webhook endpoint apontando para:
```
https://creatools.co/api/stripe/webhook
```

### 5. Verificar Health

```bash
curl https://creatools.co/api/health
```

## Troubleshooting

### Stack falhou ao criar

```bash
# Ver motivo do erro
aws cloudformation describe-stack-events \
  --stack-name creatools-production \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].{Resource:LogicalResourceId,Reason:ResourceStatusReason}'
```

### Containers nao iniciam

```bash
ssh -i creatools-key.pem ec2-user@IP_DA_INSTANCIA

# Ver logs do user-data
sudo cat /var/log/user-data.log

# Ver logs dos containers
cd /opt/creatools/infra
docker compose logs

# Reiniciar containers
docker compose down
docker compose up -d --build
```

### Certificado SSL nao valida

1. Verifique se os name servers estao configurados corretamente no registrador
2. Verifique propagacao DNS: `dig NS creatools.co`
3. Aguarde ate 48h para propagacao completa

### Banco de dados inacessivel

```bash
# Verificar security group do RDS
aws ec2 describe-security-groups \
  --group-ids SECURITY_GROUP_ID

# Testar conectividade da EC2
ssh -i creatools-key.pem ec2-user@IP_DA_INSTANCIA
sudo dnf install -y postgresql15
psql "postgresql://creatools:SENHA@ENDPOINT_RDS:5432/creatools"
```

### Erro 502 Bad Gateway

1. Verifique se o container `api` esta rodando: `docker compose ps`
2. Verifique os logs: `docker compose logs api`
3. Verifique se o health check passa: `curl http://localhost:3000/api/health`

### Memoria insuficiente

Se a build falhar por falta de memoria:
```bash
# Adicionar swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab

# Tentar novamente
cd /opt/creatools/infra
docker compose up -d --build
```

## Como Atualizar

### Atualizacao Rapida (sem downtime significativo)

```bash
ssh -i creatools-key.pem ec2-user@IP_DA_INSTANCIA

cd /opt/creatools
git pull origin main

cd infra
docker compose up -d --build
```

### Atualizacao Completa (com rebuild)

```bash
ssh -i creatools-key.pem ec2-user@IP_DA_INSTANCIA

cd /opt/creatools
git pull origin main

cd infra
docker compose down
docker system prune -f
docker compose up -d --build
```

### Rollback

```bash
ssh -i creatools-key.pem ec2-user@IP_DA_INSTANCIA

cd /opt/creatools
git log --oneline -5  # Encontrar o commit anterior
git checkout COMMIT_HASH

cd infra
docker compose up -d --build
```

## Custos Estimados (USD/mes)

| Recurso | Tipo | Custo Estimado |
|---------|------|----------------|
| EC2 | t3.medium | ~$30/mes |
| RDS PostgreSQL | db.t3.micro | ~$15/mes |
| ALB | Application LB | ~$22/mes |
| NAT Gateway | - | ~$32/mes |
| Route 53 | 3 hosted zones | ~$1.50/mes |
| EBS | 30GB gp3 | ~$2.50/mes |
| Transfer | ~50GB/mes | ~$5/mes |
| **Total Estimado** | | **~$108/mes** |

> **Nota:** Os custos podem variar conforme a regiao e o uso. A maior parte do custo vem do NAT Gateway. Para reduzir custos, voce pode colocar o RDS na subnet publica (menos seguro) e remover o NAT Gateway.

### Dicas para Reduzir Custos

1. **Reserved Instances**: Comprando 1 ano de EC2 + RDS reservado, economize ate 40%
2. **Spot Instances**: Para ambientes de staging/dev, use Spot (~70% desconto)
3. **RDS em subnet publica**: Remove necessidade do NAT Gateway (-$32/mes)
4. **Desligar fora do horario**: Para dev/staging, agende stop/start

## Notas Importantes

### Storage (Armazenamento de Midia)

Atualmente o aplicativo usa Replit Object Storage para arquivos. Na AWS, isso precisara ser migrado para **Amazon S3**. Isso sera implementado em uma atualizacao futura. Por enquanto, funcionalidades que dependem de upload de arquivos podem nao funcionar corretamente.

### Seguranca

- Nunca commite o arquivo `.env` no repositorio
- Use senhas fortes para o banco de dados (min 16 caracteres)
- Rotacione o JWT_SECRET periodicamente
- Mantenha o SSH restrito (considere usar Session Manager ao inves de SSH)
- Ative o backup automatico do RDS

### Monitoramento Recomendado

- CloudWatch Alarms para CPU/Memoria da EC2
- CloudWatch Alarms para conexoes do RDS
- ALB health check (ja configurado)
- Logs centralizados com CloudWatch Logs

## Destruir a Stack

Para remover todos os recursos:

```bash
aws cloudformation delete-stack --stack-name creatools-production

# Aguardar
aws cloudformation wait stack-delete-complete --stack-name creatools-production
```

> **Atencao:** Isso remove TODOS os recursos incluindo o banco de dados. Faca backup antes!

```bash
# Backup do banco antes de deletar
pg_dump "postgresql://creatools:SENHA@ENDPOINT:5432/creatools" > backup.sql
```
