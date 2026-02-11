# Environment Variables Configuration

This document describes all environment variables used across the OMS microservices.

## Database Credentials

All database credentials are defined in `infrastructure/docker/postgres/init-databases.sql`:

| Service | Database | Username | Password |
|---------|----------|----------|----------|
| Products | oms_products_db | products_user | products_pass |
| Orders | oms_orders_db | orders_user | orders_pass |
| Users | oms_users_db | users_user | users_pass |
| Payments | oms_payments_db | payments_user | payments_pass |

## Products Service

**Location:** `services/products-service/.env`

```bash
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Database Configuration
# Local: postgres://products_user:products_pass@localhost:5432/oms_products_db
# Docker: postgres://products_user:products_pass@postgres:5432/oms_products_db
DATABASE_URL=postgres://products_user:products_pass@localhost:5432/oms_products_db

# RabbitMQ Configuration
# Local: amqp://rabbitmq:rabbitmq@localhost:5672
# Docker: amqp://rabbitmq:rabbitmq@rabbitmq:5672
RABBITMQ_URL=amqp://rabbitmq:rabbitmq@localhost:5672

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379
```

### Endpoints Exposed
- `POST /api/v1/products` - Create product
- `GET /api/v1/products` - List products
- `GET /api/v1/products/:id` - Get product
- `PATCH /api/v1/products/:id` - Update product
- `POST /api/v1/products/batch` - Batch create products
- `GET /api/v1/inventory/:productId` - Get inventory
- `PUT /api/v1/inventory/:productId` - Update inventory
- `POST /api/v1/inventory/reserve` - Reserve inventory
- `POST /api/v1/inventory/release` - Release inventory
- `PATCH /api/v1/inventory/batch` - Batch update inventory
- `POST /api/v1/warehouses` - Create warehouse
- `GET /api/v1/warehouses` - List warehouses
- `GET /api/v1/warehouses/:id` - Get warehouse
- `GET /health` - Health check

### Events Consumed
- `order.created` (from orders-service)
- `order.cancelled` (from orders-service)

### Events Published
- `product.created`
- `product.updated`
- `inventory.reserved`
- `inventory.insufficient`

---

## Orders Service

**Location:** `services/orders-service/.env`

```bash
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Database Configuration
# Local: postgres://orders_user:orders_pass@localhost:5432/oms_orders_db
# Docker: postgres://orders_user:orders_pass@postgres:5432/oms_orders_db
DATABASE_URL=postgres://orders_user:orders_pass@localhost:5432/oms_orders_db

# RabbitMQ Configuration
# Local: amqp://rabbitmq:rabbitmq@localhost:5672
# Docker: amqp://rabbitmq:rabbitmq@rabbitmq:5672
RABBITMQ_URL=amqp://rabbitmq:rabbitmq@localhost:5672

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# Service URLs (Optional - for direct HTTP calls)
PRODUCTS_SERVICE_URL=http://localhost:3002
USERS_SERVICE_URL=http://localhost:3003
```

### Endpoints Exposed
- `POST /api/v1/orders` - Create order
- `GET /api/v1/orders` - List orders (with filters)
- `GET /api/v1/orders/:id` - Get order
- `PATCH /api/v1/orders/:id` - Update order
- `POST /api/v1/orders/:id/cancel` - Cancel order
- `POST /api/v1/orders/:id/confirm` - Confirm order (manual)
- `GET /api/v1/users/:userId/orders` - Get user's orders
- `GET /health` - Health check

### Events Consumed
- `inventory.reserved` (from products-service)
- `inventory.insufficient` (from products-service)
- `payment.completed` (from payments-service)
- `payment.failed` (from payments-service)

### Events Published
- `order.created`
- `order.confirmed`
- `order.cancelled`
- `order.shipped`

---

## Users Service

**Location:** `services/users-service/.env`

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://users_user:users_pass@localhost:5432/oms_users_db
RABBITMQ_URL=amqp://rabbitmq:rabbitmq@localhost:5672
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h
LOG_LEVEL=info
```

---

## Payments Service

**Location:** `services/payments-service/.env`

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://payments_user:payments_pass@localhost:5432/oms_payments_db
RABBITMQ_URL=amqp://rabbitmq:rabbitmq@localhost:5672
REDIS_URL=redis://localhost:6379
PAYMENT_GATEWAY_API_KEY=test-api-key-change-in-production
LOG_LEVEL=info
```

### Events Published
- `payment.completed`
- `payment.failed`

---

## BFF Services

### BFF-Web
**Location:** `services/bff-web/.env`

```bash
NODE_ENV=development
PORT=3000
ORDERS_SERVICE_URL=http://localhost:3001
PRODUCTS_SERVICE_URL=http://localhost:3002
USERS_SERVICE_URL=http://localhost:3003
PAYMENTS_SERVICE_URL=http://localhost:3004
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-change-in-production
```

### BFF-Mobile
**Location:** `services/bff-mobile/.env`

```bash
NODE_ENV=development
PORT=3000
ORDERS_SERVICE_URL=http://localhost:3001
PRODUCTS_SERVICE_URL=http://localhost:3002
USERS_SERVICE_URL=http://localhost:3003
PAYMENTS_SERVICE_URL=http://localhost:3004
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-change-in-production
```

---

## Infrastructure Services

### PostgreSQL
- **Host:** localhost (local) / postgres (Docker)
- **Port:** 5432
- **Root User:** postgres
- **Root Password:** postgres
- **Databases:** oms_products_db, oms_orders_db, oms_users_db, oms_payments_db

### RabbitMQ
- **Host:** localhost (local) / rabbitmq (Docker)
- **AMQP Port:** 5672
- **Management UI:** http://localhost:15672
- **Username:** rabbitmq
- **Password:** rabbitmq

### Redis
- **Host:** localhost (local) / redis (Docker)
- **Port:** 6379
- **No password** (development only)

---

## Port Assignments

| Service | Port | Container Port |
|---------|------|----------------|
| Products Service | 3002 | 3000 |
| Orders Service | 3001 | 3000 |
| Users Service | 3003 | 3000 |
| Payments Service | 3004 | 3000 |
| BFF-Web | 3010 | 3000 |
| BFF-Mobile | 3011 | 3000 |
| PostgreSQL | 5432 | 5432 |
| RabbitMQ AMQP | 5672 | 5672 |
| RabbitMQ Management | 15672 | 15672 |
| Redis | 6379 | 6379 |

---

## Development vs Docker

### Local Development (outside Docker)
Use `localhost` for all service hosts:
```bash
DATABASE_URL=postgres://products_user:products_pass@localhost:5432/oms_products_db
RABBITMQ_URL=amqp://rabbitmq:rabbitmq@localhost:5672
```

### Docker Compose
Use service names for internal communication:
```bash
DATABASE_URL=postgres://products_user:products_pass@postgres:5432/oms_products_db
RABBITMQ_URL=amqp://rabbitmq:rabbitmq@rabbitmq:5672
```

---

## Security Notes

⚠️ **IMPORTANT:** The credentials shown here are for **development only**.

For production:
1. Use strong, randomly generated passwords
2. Store secrets in a secrets manager (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault)
3. Use environment-specific .env files
4. Never commit .env files to version control
5. Rotate credentials regularly
6. Use TLS for all database and message broker connections

---

## Setup Instructions

### 1. Copy Environment Files
```bash
# Products Service
cp services/products-service/ex services/products-service/.env

# Orders Service
cp services/orders-service/ex services/orders-service/.env
```

### 2. Update for Your Environment
Edit the `.env` files and change:
- `localhost` → `postgres` if running in Docker
- `localhost` → `rabbitmq` if running in Docker
- Update any passwords or secrets

### 3. Run Database Migrations
```bash
# Products Service
cd services/products-service
npm run migrate

# Orders Service
cd services/orders-service
npm run migrate
```

### 4. Start Services
```bash
# Docker Compose (recommended)
docker-compose up -d

# Or local development
npm run dev
```
