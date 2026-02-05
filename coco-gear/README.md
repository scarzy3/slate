# COCO Gear — Equipment Management System

Full-stack equipment tracking and management system built with React, Express, PostgreSQL, and Prisma. Manage kit inventories, component tracking, checkout/return workflows, inspections, maintenance, reservations, consumables, standalone assets, personnel, and audit logging — all with role-based access control.

## Prerequisites

**Option A — Docker (recommended):**
- Docker & Docker Compose

**Option B — Manual:**
- Node.js 20+
- PostgreSQL 16+

## Quick Start with Docker

```bash
cd coco-gear
docker-compose up --build
```

Open **http://localhost:3000** once services are healthy. The database is automatically migrated and seeded with demo data.

## Manual Setup

```bash
cd coco-gear

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials and a strong JWT_SECRET

# 3. Push schema to database & seed demo data
npx prisma db push
node prisma/seed.js

# 4. Build frontend
npm run build

# 5. Start production server
npm start
```

### Development Mode

```bash
npm run dev
```

Runs the Express API on **:3000** and Vite dev server on **:5173** concurrently. The Vite server proxies `/api` and `/uploads` requests to the backend.

## Default Login Credentials

All seeded users share PIN **1234**. Roles:

| Name | Role | Department |
|------|------|------------|
| CPT Rodriguez | Super Admin | HQ |
| SFC Williams | Admin | Alpha |
| SGT Mitchell | Admin | Bravo |
| SPC Davis | User | Alpha |
| PFC Thompson | User | Bravo |
| PV2 Garcia | User | Charlie |
| SSG Park | Admin | HQ |
| CPL Jensen | User | Alpha |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://coco:coco_secret@localhost:5432/cocogear?schema=public` | PostgreSQL connection string |
| `JWT_SECRET` | `change-this-to-a-strong-random-secret` | Secret key for JWT signing |
| `JWT_EXPIRES_IN` | `24h` | JWT token expiration |
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | `development` or `production` |
| `UPLOAD_DIR` | `./uploads` | Photo upload directory |
| `MAX_FILE_SIZE` | `10485760` | Max upload size in bytes (10 MB) |

## API Endpoints

All routes are prefixed with `/api`.

### Auth (public)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/users` | List users for login screen |
| POST | `/auth/login` | Authenticate with userId + PIN |
| GET | `/auth/me` | Get current user profile |
| PUT | `/auth/me` | Update own name/title |

### Kits
| Method | Path | Description |
|--------|------|-------------|
| GET | `/kits` | List all kits |
| GET | `/kits/:id` | Get kit with full relations |
| POST | `/kits` | Create kit |
| PUT | `/kits/:id` | Update kit |
| DELETE | `/kits/:id` | Delete kit |
| POST | `/kits/checkout` | Check out a kit |
| POST | `/kits/return` | Return a kit |
| POST | `/kits/inspect` | Submit inspection results |
| PUT | `/kits/:id/location` | Update kit location |

### Kit Types
| Method | Path | Description |
|--------|------|-------------|
| GET | `/types` | List all kit types |
| GET | `/types/:id` | Get kit type with components |
| POST | `/types` | Create kit type |
| PUT | `/types/:id` | Update kit type |
| DELETE | `/types/:id` | Delete kit type |

### Components
| Method | Path | Description |
|--------|------|-------------|
| GET | `/components` | List all components |
| POST | `/components` | Create component |
| PUT | `/components/:id` | Update component |
| DELETE | `/components/:id` | Delete component |

### Locations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/locations` | List locations |
| POST | `/locations` | Create location |
| PUT | `/locations/:id` | Update location |
| DELETE | `/locations/:id` | Delete location |

### Departments
| Method | Path | Description |
|--------|------|-------------|
| GET | `/departments` | List departments |
| POST | `/departments` | Create department |
| PUT | `/departments/:id` | Update department |
| DELETE | `/departments/:id` | Delete department |

### Personnel
| Method | Path | Description |
|--------|------|-------------|
| GET | `/personnel` | List all users (admin) |
| GET | `/personnel/:id` | Get user detail |
| POST | `/personnel` | Create user |
| PUT | `/personnel/:id` | Update user |
| DELETE | `/personnel/:id` | Delete user |

### Consumables
| Method | Path | Description |
|--------|------|-------------|
| GET | `/consumables` | List consumables |
| POST | `/consumables` | Create consumable |
| PUT | `/consumables/:id` | Update consumable |
| DELETE | `/consumables/:id` | Delete consumable |
| POST | `/consumables/:id/adjust` | Adjust quantity |

### Standalone Assets
| Method | Path | Description |
|--------|------|-------------|
| GET | `/assets` | List assets |
| POST | `/assets` | Create asset |
| PUT | `/assets/:id` | Update asset |
| DELETE | `/assets/:id` | Delete asset |
| POST | `/assets/:id/checkout` | Check out asset |
| POST | `/assets/:id/return` | Return asset |

### Reservations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/reservations` | List reservations |
| POST | `/reservations` | Create reservation |
| PUT | `/reservations/:id/approve` | Approve reservation |
| PUT | `/reservations/:id/cancel` | Cancel reservation |

### Maintenance
| Method | Path | Description |
|--------|------|-------------|
| GET | `/maintenance` | List kits in maintenance + history |
| POST | `/maintenance/send` | Send kit to maintenance |
| POST | `/maintenance/:kitId/return` | Return kit from maintenance |

### Audit Log
| Method | Path | Description |
|--------|------|-------------|
| GET | `/audit` | List audit entries (super admin) |

### Settings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/settings` | Get system settings |
| PUT | `/settings` | Update settings (super admin) |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports/fleet` | Fleet overview |
| GET | `/reports/checkouts` | Checkout history |
| GET | `/reports/inspections` | Inspection summary |
| GET | `/reports/personnel` | Personnel report |
| GET | `/reports/components` | Component status |
| GET | `/reports/departments` | Department summary |
| GET | `/reports/custody/:kitId` | Kit custody chain |

### Other
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/upload` | Upload photos (multipart) |

## Project Structure

```
coco-gear/
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.js              # Demo data seeder
├── server/
│   ├── index.js             # Express entry point
│   ├── middleware/
│   │   ├── auth.js          # JWT authentication
│   │   └── rbac.js          # Role-based access control
│   ├── routes/
│   │   ├── auth.js          # Login, profile
│   │   ├── kits.js          # Kit CRUD + checkout/return/inspect
│   │   ├── types.js         # Kit type management
│   │   ├── components.js    # Component definitions
│   │   ├── locations.js     # Location management
│   │   ├── departments.js   # Department management
│   │   ├── personnel.js     # User management
│   │   ├── consumables.js   # Consumable tracking
│   │   ├── assets.js        # Standalone assets
│   │   ├── reservations.js  # Kit reservations
│   │   ├── maintenance.js   # Maintenance workflow
│   │   ├── audit.js         # Audit log
│   │   ├── settings.js      # System settings
│   │   └── reports.js       # Report generation
│   └── utils/
│       ├── auditLogger.js   # Audit trail helper
│       └── validation.js    # Zod schemas + middleware
├── client/
│   ├── index.html           # HTML entry
│   ├── vite.config.js       # Vite configuration
│   └── src/
│       ├── index.jsx         # React entry + AuthProvider
│       ├── App.jsx           # Main application (refactored from tracker.jsx)
│       ├── api.js            # API client module
│       └── auth.jsx          # Auth context + hooks
├── uploads/                  # Photo uploads directory
├── Dockerfile                # Multi-stage Docker build
├── docker-compose.yml        # PostgreSQL + app stack
├── package.json
├── .env.example
└── .gitignore
```

## Role-Based Access

Three roles with hierarchical permissions:

- **Super Admin** — Full system access including settings, audit log, and personnel management
- **Admin** — Kit management, checkout/return, inspections, and delegated permissions
- **User** — View kits, self-checkout (when allowed), view own reservations

Admin permissions are configurable via system settings (require approval, allow user location updates, etc.).
