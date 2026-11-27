import express, { type Request, type Response } from "express";

import { loadStockRequests } from "../lib/stock-requests.js";
import { attachUser, currentUser } from "../middlewares/attach-user.js";
import {
	mockActiveRun,
	mockFdo,
	mockFdoStockRequests,
	mockFdoSummary,
	mockRunHistory,
	mockWarehouse,
} from "../mocks/fixtures.js";
import { idParamsSchema } from "../types/common.types.js";
import {
	recordDeliverySchema,
	submitReturnSchema,
} from "../types/distribution-run.types.js";
import { createStockRequestSchema } from "../types/stock-request.types.js";

// Everything an FDO does is about *their own* requests and runs, so every
// endpoint here needs the signed-in FDO's id.
//
// TODO(auth): until the authentication lesson, all of these validate the
// request body for real but return mock data and write nothing to the
// database.
const router = express.Router();

// Every /fdo/* route needs to know who is calling. attachUser sets req.user,
// or answers 401/403 itself. (Which roles may call these is Session 5.)
router.use("/fdo", attachUser);

// Summary cards on the FDO Stock Requests page.
router.get("/fdo/summary", (_req: Request, res: Response) => {
	// TODO(auth): figures for the FDO's home warehouse.
	res.json(mockFdoSummary);
});

// FDO Stock Requests page: the FDO's own requests.
router.get("/fdo/stock-requests", async (req: Request, res: Response) => {
	const user = currentUser(req);
	res.json(await loadStockRequests({ fdoId: user.id }));
});

// Request Stock dialog.
router.post("/fdo/stock-requests", (req: Request, res: Response) => {
	const result = createStockRequestSchema.safeParse(req.body);
	if (!result.success) {
		return res.status(400).json({ error: result.error.issues });
	}

	// TODO(auth): insert a stock_request (fdo_id = current user) and its
	// stock_request_items in one transaction.
	const { route, plannedDate, note, products } = result.data;
	res.status(201).json({
		id: 1062,
		status: "pending",
		fdo: mockFdo,
		warehouse: mockWarehouse,
		route: route ?? null,
		plannedDate: plannedDate ?? null,
		note: note ?? null,
		requestedAt: new Date().toISOString(),
		decidedBy: null,
		allocatedAt: null,
		allocationNote: null,
		rejectedAt: null,
		rejectionReason: null,
		acceptedAt: null,
		run: null,
		totalRequested: products.reduce((total, line) => total + line.quantity, 0),
		totalAllocated: null,
		products: products.map((line) => ({
			productId: line.productId,
			sku: "MOCK-SKU",
			name: "Mock product",
			requested: line.quantity,
			allocated: null,
			available: 0,
		})),
	});
});

// Accept Allocation dialog: the FDO agrees to the allocated quantities.
router.post(
	"/fdo/stock-requests/:id/acceptance",
	(req: Request, res: Response) => {
		const params = idParamsSchema.safeParse(req.params);
		if (!params.success) {
			return res.status(400).json({ error: params.error.issues });
		}

		// TODO(auth): check the request belongs to the current FDO and is
		// 'allocation_ready'. Then in one transaction: status = 'approved',
		// create the distribution_run and run_items, and insert an `issue`
		// movement per product (-allocated qty). The one-open-run index
		// rejects this if the FDO already has an open run.
		const [mock] = mockFdoStockRequests;
		res.json({
			...mock,
			id: params.data.id,
			status: "approved",
			acceptedAt: new Date().toISOString(),
			run: { id: mockActiveRun.id, status: "awaiting_collection" },
		});
	},
);

// The FDO's current run (Distributions page). null when there is none.
router.get("/fdo/distribution-runs/active", (_req: Request, res: Response) => {
	// TODO(auth): loadRuns(fdo_id = current user AND status <> 'closed')
	res.json(mockActiveRun);
});

// Run History page.
router.get("/fdo/distribution-runs/history", (_req: Request, res: Response) => {
	// TODO(auth): loadRuns(fdo_id = current user AND status = 'closed')
	res.json(mockRunHistory);
});

// Confirm Collection dialog.
router.post(
	"/fdo/distribution-runs/:id/collection",
	(req: Request, res: Response) => {
		const params = idParamsSchema.safeParse(req.params);
		if (!params.success) {
			return res.status(400).json({ error: params.error.issues });
		}

		// TODO(auth): only for the current FDO's run while
		// 'awaiting_collection'. Sets status = 'in_progress' and collected_at.
		res.json({
			...mockActiveRun,
			id: params.data.id,
			status: "in_progress",
			collectedAt: new Date().toISOString(),
		});
	},
);

// Record Outlet Delivery dialog.
router.post(
	"/fdo/distribution-runs/:id/deliveries",
	(req: Request, res: Response) => {
		const params = idParamsSchema.safeParse(req.params);
		if (!params.success) {
			return res.status(400).json({ error: params.error.issues });
		}
		const result = recordDeliverySchema.safeParse(req.body);
		if (!result.success) {
			return res.status(400).json({ error: result.error.issues });
		}

		// TODO(auth): only for the current FDO's run while 'in_progress'.
		// Each quantity must not exceed what is left (issued - delivered).
		// Inserts a delivery and its delivery_items.
		const { outletId, note, products } = result.data;
		res.status(201).json({
			id: 2004,
			runId: params.data.id,
			outlet: { id: outletId, name: "Mock outlet", area: "Mock area" },
			deliveredAt: new Date().toISOString(),
			note: note ?? null,
			totalUnits: products.reduce((total, line) => total + line.quantity, 0),
			products: products.map((line) => ({
				productId: line.productId,
				sku: "MOCK-SKU",
				name: "Mock product",
				quantity: line.quantity,
			})),
		});
	},
);

// Finish Run -> Submit Return dialog.
router.post(
	"/fdo/distribution-runs/:id/return",
	(req: Request, res: Response) => {
		const params = idParamsSchema.safeParse(req.params);
		if (!params.success) {
			return res.status(400).json({ error: params.error.issues });
		}
		const result = submitReturnSchema.safeParse(req.body);
		if (!result.success) {
			return res.status(400).json({ error: result.error.issues });
		}

		// TODO(auth): only for the current FDO's run while 'in_progress' or
		// 'revision_requested'. Sets declared_return_qty per product, then
		// status = 'return_submitted', return_submitted_at and return_note
		// (required when any declared return differs from expected).
		res.json({
			...mockActiveRun,
			id: params.data.id,
			status: "return_submitted",
			returnSubmittedAt: new Date().toISOString(),
			returnNote: result.data.note ?? null,
		});
	},
);

export default router;
