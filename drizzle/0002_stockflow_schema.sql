CREATE TYPE "public"."movement_type" AS ENUM('receipt', 'issue', 'return');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'allocation_ready', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('awaiting_collection', 'in_progress', 'return_submitted', 'revision_requested', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('stock_manager', 'fdo');--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deliveries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer NOT NULL,
	"outlet_id" integer NOT NULL,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "delivery_items" (
	"delivery_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "delivery_items_delivery_id_product_id_pk" PRIMARY KEY("delivery_id","product_id"),
	CONSTRAINT "delivery_items_quantity_check" CHECK ("delivery_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "distribution_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "distribution_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"request_id" integer NOT NULL,
	"fdo_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"status" "run_status" DEFAULT 'awaiting_collection' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"collected_at" timestamp with time zone,
	"return_submitted_at" timestamp with time zone,
	"return_note" text,
	"revision_feedback" text,
	"closed_at" timestamp with time zone,
	"closed_by_id" integer,
	"verification_note" text,
	CONSTRAINT "distribution_runs_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outlets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"area" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"reorder_level" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_reorder_level_check" CHECK ("products"."reorder_level" >= 0)
);
--> statement-breakpoint
CREATE TABLE "run_items" (
	"run_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"issued_qty" integer NOT NULL,
	"declared_return_qty" integer,
	"verified_return_qty" integer,
	CONSTRAINT "run_items_run_id_product_id_pk" PRIMARY KEY("run_id","product_id"),
	CONSTRAINT "run_items_issued_qty_check" CHECK ("run_items"."issued_qty" > 0),
	CONSTRAINT "run_items_declared_return_qty_check" CHECK ("run_items"."declared_return_qty" >= 0),
	CONSTRAINT "run_items_verified_return_qty_check" CHECK ("run_items"."verified_return_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_movements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"warehouse_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"type" "movement_type" NOT NULL,
	"quantity" integer NOT NULL,
	"run_id" integer,
	"reference" text,
	"created_by_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_quantity_sign_check" CHECK (("stock_movements"."type" = 'issue' AND "stock_movements"."quantity" < 0) OR ("stock_movements"."type" <> 'issue' AND "stock_movements"."quantity" > 0)),
	CONSTRAINT "stock_movements_run_id_check" CHECK (("stock_movements"."type" = 'receipt') = ("stock_movements"."run_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "stock_request_items" (
	"request_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"requested_qty" integer NOT NULL,
	"allocated_qty" integer,
	CONSTRAINT "stock_request_items_request_id_product_id_pk" PRIMARY KEY("request_id","product_id"),
	CONSTRAINT "stock_request_items_requested_qty_check" CHECK ("stock_request_items"."requested_qty" > 0),
	CONSTRAINT "stock_request_items_allocated_qty_check" CHECK ("stock_request_items"."allocated_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"fdo_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"route" text,
	"planned_date" date,
	"request_note" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by_id" integer,
	"allocated_at" timestamp with time zone,
	"allocation_note" text,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"clerk_user_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" NOT NULL,
	"home_warehouse_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_fdo_home_warehouse_check" CHECK ("users"."role" <> 'fdo' OR "users"."home_warehouse_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "warehouses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_run_id_distribution_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."distribution_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_runs" ADD CONSTRAINT "distribution_runs_request_id_stock_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."stock_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_runs" ADD CONSTRAINT "distribution_runs_fdo_id_users_id_fk" FOREIGN KEY ("fdo_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_runs" ADD CONSTRAINT "distribution_runs_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_runs" ADD CONSTRAINT "distribution_runs_closed_by_id_users_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_items" ADD CONSTRAINT "run_items_run_id_distribution_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."distribution_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_items" ADD CONSTRAINT "run_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_run_id_distribution_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."distribution_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_request_items" ADD CONSTRAINT "stock_request_items_request_id_stock_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."stock_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_request_items" ADD CONSTRAINT "stock_request_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_fdo_id_users_id_fk" FOREIGN KEY ("fdo_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_home_warehouse_id_warehouses_id_fk" FOREIGN KEY ("home_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deliveries_run_id_idx" ON "deliveries" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "distribution_runs_one_open_run_per_fdo_idx" ON "distribution_runs" USING btree ("fdo_id") WHERE "distribution_runs"."status" <> 'closed';--> statement-breakpoint
CREATE INDEX "distribution_runs_warehouse_id_status_idx" ON "distribution_runs" USING btree ("warehouse_id","status");--> statement-breakpoint
CREATE INDEX "stock_movements_warehouse_id_product_id_idx" ON "stock_movements" USING btree ("warehouse_id","product_id");--> statement-breakpoint
CREATE INDEX "stock_movements_run_id_idx" ON "stock_movements" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "stock_requests_fdo_id_idx" ON "stock_requests" USING btree ("fdo_id");--> statement-breakpoint
CREATE INDEX "stock_requests_warehouse_id_status_idx" ON "stock_requests" USING btree ("warehouse_id","status");