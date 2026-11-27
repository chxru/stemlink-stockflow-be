-- Reference data taken from the placeholder values in stkflw-web/src/data/mock.
-- Written to be safe on a database that already has some of these rows.

INSERT INTO "warehouses" ("code", "name") VALUES
	('WH-1', 'Colombo Central Warehouse'),
	('WH-2', 'Kandy Regional Warehouse'),
	('WH-3', 'Galle Regional Warehouse')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "products" ("sku", "name", "reorder_level") VALUES
	('RIC-5K-001', 'Premium Rice 5kg', 200),
	('OIL-1L-002', 'Cooking Oil 1L', 200),
	('MLK-400-003', 'Milk Powder 400g', 200),
	('TEA-200-004', 'Black Tea 200g', 200),
	('SOP-BAR-005', 'Laundry Soap Bar', 200),
	('WTR-15L-006', 'Bottled Water 1.5L', 200)
ON CONFLICT ("sku") DO NOTHING;
--> statement-breakpoint
-- outlets have no unique column, so skip any (name, area) pair that already exists
INSERT INTO "outlets" ("name", "area")
SELECT v.name, v.area
FROM (VALUES
	('Pettah City Mart', 'Colombo North'),
	('Kotahena General Store', 'Colombo North'),
	('Maradana Traders', 'Colombo North'),
	('Kandy Town Supermarket', 'Kandy Central'),
	('Peradeniya Road Shop', 'Kandy Central'),
	('Galle Fort Provisions', 'Galle City')
) AS v(name, area)
WHERE NOT EXISTS (
	SELECT 1 FROM "outlets" o WHERE o.name = v.name AND o.area = v.area
);
