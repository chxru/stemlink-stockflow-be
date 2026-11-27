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

| Table                                    | Purpose                                                                                                                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `warehouses`                             | The seven warehouses.                                                                                                                                                                  |
| `products`                               | Product lines, identified by a business-wide unique `sku`. `reorder_level` drives the "Low Stock" badge on the Stock Summary page.                                                     |
| `users`                                  | One row per Clerk user. `role` mirrors the Clerk `publicMetadata.role`. FDOs must have a `home_warehouse_id` (BR 20). Stock managers have network-wide access, so they don't need one. |
| `outlets`                                | Shops the FDO picks from when recording a delivery. This is pre-loaded reference data, not managed in the app (BRD rule 9.3).                                                          |
| `stock_requests` + `stock_request_items` | An FDO's request for a day's stock, and the manager's allocation per product (BR 6–8).                                                                                                 |
| `distribution_runs` + `run_items`        | What the FDO actually carries for the day, and how the return was declared and verified (BR 10–17).                                                                                    |
| `deliveries` + `delivery_items`          | Each outlet drop-off during a run (BR 11).                                                                                                                                             |
| `stock_movements`                        | The stock ledger. It is the only place stock levels come from (BR 1–4, 9, 17).                                                                                                         |
