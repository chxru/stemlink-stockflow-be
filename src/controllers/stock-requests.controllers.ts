import express, { type Request, type Response } from "express";

import { loadStockRequests } from "../lib/stock-requests.js";
import { findWarehouseByCode } from "../lib/warehouses.js";
import { mockFdoStockRequests, mockManager } from "../mocks/fixtures.js";
import { idParamsSchema } from "../types/common.types.js";
import {
	allocateStockRequestSchema,
	listStockRequestsQuerySchema,
	rejectStockRequestSchema,
} from "../types/stock-request.types.js";

// Stock manager side of the request -> allocation -> acceptance cycle.
const router = express.Router();

// Stock Requests page: pending tab (?status=pending) and history.
router.get("/stock-requests", async (req: Request, res: Response) => {
	const result = listStockRequestsQuerySchema.safeParse(req.query);
	if (!result.success) {
		return res.status(400).json({ error: result.error.issues });
	}
	const { status, warehouse: warehouseCode, fdoId } = result.data;

	let warehouseId: number | undefined;
	if (warehouseCode) {
		const warehouse = await findWarehouseByCode(warehouseCode);
		if (!warehouse) {
			return res.status(404).json({ error: "Warehouse not found" });
		}
		warehouseId = warehouse.id;
	}

	res.json(await loadStockRequests({ status, warehouseId, fdoId }));
});

router.get("/stock-requests/:id", async (req: Request, res: Response) => {
	const params = idParamsSchema.safeParse(req.params);
	if (!params.success) {
		return res.status(400).json({ error: params.error.issues });
	}

	const [request] = await loadStockRequests({ id: params.data.id });
	if (!request) return res.status(404).json({ error: "Request not found" });
	res.json(request);
});

// Send Allocation dialog.
router.post(
	"/stock-requests/:id/allocation",
	async (req: Request, res: Response) => {
		const params = idParamsSchema.safeParse(req.params);
		if (!params.success) {
			return res.status(400).json({ error: params.error.issues });
		}
		const result = allocateStockRequestSchema.safeParse(req.body);
		if (!result.success) {
			return res.status(400).json({ error: result.error.issues });
		}

		// TODO(auth): decided_by_id must be the signed-in stock manager.
		// Mock response, nothing is written. The real version sets each
		// allocated_qty, then status = 'allocation_ready', allocated_at and
		// allocation_note, only while the request is 'pending'.
		const [mock] = mockFdoStockRequests;
		res.json({
			...mock,
			id: params.data.id,
			status: "allocation_ready",
			decidedBy: mockManager,
			allocatedAt: new Date().toISOString(),
			allocationNote: result.data.note ?? null,
		});
	},
);

// Reject Request dialog.
router.post(
	"/stock-requests/:id/rejection",
	async (req: Request, res: Response) => {
		const params = idParamsSchema.safeParse(req.params);
		if (!params.success) {
			return res.status(400).json({ error: params.error.issues });
		}
		const result = rejectStockRequestSchema.safeParse(req.body);
		if (!result.success) {
			return res.status(400).json({ error: result.error.issues });
		}

		// TODO(auth): decided_by_id must be the signed-in stock manager.
		// Mock response, nothing is written. The real version sets
		// status = 'rejected', rejected_at and rejection_reason, only while
		// the request is 'pending'.
		const [, , mock] = mockFdoStockRequests;
		res.json({
			...mock,
			id: params.data.id,
			decidedBy: mockManager,
			rejectedAt: new Date().toISOString(),
			rejectionReason: result.data.reason,
		});
	},
);

export default router;
