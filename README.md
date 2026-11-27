# StockFlow Backend 

> Part of fullstack development bootcamp by Stemlink

The API and database for **StockFlow**, a warehouse stock and distribution tracker for a beverage manufacturer with seven warehouses and about 700 field distribution officers (FDOs).

**Stack:** Node.js, Express 5, TypeScript, Drizzle ORM, PostgreSQL, Zod. Authentication is handled by Clerk

---

## Database design

### ER diagram

```mermaid
erDiagram
    warehouses {
        int id PK
        text code UK "e.g. WH-1"
        text name
        timestamptz created_at
    }

    products {
        int id PK
        text sku UK "unique across the business (BR 5)"
        text name
        int reorder_level "below this = low stock"
        boolean is_active
        timestamptz created_at
    }

    users {
        int id PK
        text clerk_user_id UK
        text first_name
        text last_name
        text email UK
        user_role role "stock_manager | fdo"
        int home_warehouse_id FK "required when role = fdo"
        timestamptz created_at
    }

    outlets {
        int id PK
        text name
        text area
        timestamptz created_at
    }

    stock_requests {
        int id PK
        int fdo_id FK
        int warehouse_id FK
        request_status status "pending | allocation_ready | approved | rejected"
        text route "nullable"
        date planned_date "nullable"
        text request_note "nullable"
        timestamptz requested_at
        int decided_by_id FK "stock manager who allocated or rejected"
        timestamptz allocated_at
        text allocation_note "nullable"
        timestamptz rejected_at
        text rejection_reason "required when rejected"
        timestamptz accepted_at "FDO accepted the allocation"
    }

    stock_request_items {
        int request_id PK, FK
        int product_id PK, FK
        int requested_qty "> 0"
        int allocated_qty "nullable until allocated, >= 0"
    }

    distribution_runs {
        int id PK
        int request_id FK, UK "one run per approved request"
        int fdo_id FK
        int warehouse_id FK
        run_status status "awaiting_collection | in_progress | return_submitted | revision_requested | closed"
        timestamptz created_at
        timestamptz collected_at
        timestamptz return_submitted_at
        text return_note "FDO note, required if declared != expected"
        text revision_feedback "latest manager feedback"
        timestamptz closed_at
        int closed_by_id FK
        text verification_note "required if variance > 0"
    }

    run_items {
        int run_id PK, FK
        int product_id PK, FK
        int issued_qty
        int declared_return_qty "set by FDO on return"
        int verified_return_qty "set by manager on accept"
    }

    deliveries {
        int id PK
        int run_id FK
        int outlet_id FK
        timestamptz delivered_at
        text note "nullable"
    }

    delivery_items {
        int delivery_id PK, FK
        int product_id PK, FK
        int quantity "> 0"
    }

    stock_movements {
        int id PK
        int warehouse_id FK
        int product_id FK
        movement_type type "receipt | issue | return"
        int quantity "signed: + in, - out"
        int run_id FK "nullable, set for issue and return"
        text reference "e.g. GRN-2026-0806, nullable"
        int created_by_id FK
        timestamptz created_at
    }

    warehouses ||--o{ users : "home of (FDOs)"
    warehouses ||--o{ stock_requests : "requested from"
    warehouses ||--o{ distribution_runs : "issues"
    warehouses ||--o{ stock_movements : "holds"

    users ||--o{ stock_requests : "raises (FDO)"
    users |o--o{ stock_requests : "decides (manager)"
    users ||--o{ distribution_runs : "runs (FDO)"
    users |o--o{ distribution_runs : "closes (manager)"
    users ||--o{ stock_movements : "records"

    stock_requests ||--|{ stock_request_items : "contains"
    stock_requests ||--o| distribution_runs : "becomes"

    distribution_runs ||--|{ run_items : "carries"
    distribution_runs ||--o{ deliveries : "makes"
    distribution_runs |o--o{ stock_movements : "causes"

    deliveries ||--|{ delivery_items : "contains"
    outlets ||--o{ deliveries : "receives"

    products ||--o{ stock_request_items : ""
    products ||--o{ run_items : ""
    products ||--o{ delivery_items : ""
    products ||--o{ stock_movements : ""
```

### Tables

| Table                                    | Purpose                                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `warehouses`                             | The warehouses.                                                                                                                                                                |
| `products`                               | Product lines, identified by a business-wide unique `sku`. `reorder_level` drives the "Low Stock" badge on the Stock Summary page.                                             |
| `users`                                  | One row per Clerk user. `role` mirrors the Clerk `publicMetadata.role`. FDOs must have a `home_warehouse_id`. Stock managers have network-wide access, so they don't need one. |
| `outlets`                                | Shops the FDO picks from when recording a delivery. This is pre-loaded reference data, not managed in the app.                                                                 |
| `stock_requests` + `stock_request_items` | An FDO's request for a day's stock, and the manager's allocation per product.                                                                                                  |
| `distribution_runs` + `run_items`        | What the FDO actually carries for the day, and how the return was declared and verified.                                                                                       |
| `deliveries` + `delivery_items`          | Each outlet drop-off during a run.                                                                                                                                             |
| `stock_movements`                        | The stock ledger. It is the only place stock levels come from.                                                                                                                 |

---

## Authentication

Clerk signs users in on both the web app (`@clerk/react`) and the FDO mobile app (`@clerk/expo`). The API never sees a password. It only checks the session token Clerk issued.

```
client: getToken()  ->  Authorization: Bearer <jwt>  ->  clerkMiddleware()  ->  attachUser  ->  route
                                                         checks signature       finds or creates
                                                         and expiry             the users row
```

- `clerkMiddleware()` (in `src/server.ts`) runs on every request. It verifies the token, but it doesn't block anyone.
- `attachUser` (in `src/middlewares/attach-user.ts`) is added to the routes that need to know the caller. It sends `401` without a valid session. It sends `403` when the user can't be let in yet: no role, an unknown role, or an FDO without a home warehouse. Otherwise it sets `req.user`.
- A user's `users` row is created on their first request, from the session token's claims (`src/lib/current-user.ts`). The row is updated whenever their role, warehouse or name changes in Clerk.

### Clerk setup

1. Copy the keys from Clerk dashboard → API keys into `.env` (see `.env.example`).
2. Go to Clerk dashboard → Sessions → Customize session token, and add these claims:

   ```json
   {
     "role": "{{user.public_metadata.role}}",
     "warehouse": "{{user.public_metadata.warehouse}}",
     "email": "{{user.primary_email_address}}",
     "firstName": "{{user.first_name}}",
     "lastName": "{{user.last_name}}"
   }
   ```

3. Set each user's public metadata. FDOs need a warehouse code that exists in `warehouses`:
   - Stock manager: `{ "role": "stock-manager" }`
   - FDO: `{ "role": "fdo", "warehouse": "WH-1" }`

### Calling the API with a token

Sign in to the web app, open the browser console, and run `await Clerk.session.getToken()`. Paste the result into the `token` variable of the Bruno `Local` environment. Clerk tokens expire after 60 seconds, so copy a fresh one when you get a 401.

### Commands

```sh
npm test          # unit tests (claims -> profile)
npm run jwt:demo  # sign, verify, tamper with and expire a JWT using jose
```
