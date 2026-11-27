import { and, eq } from "drizzle-orm";
import express, { type Request, type Response } from "express";

import { db } from "../db.js";
import { loadRuns } from "../lib/distribution-runs.js";
import { findWarehouseByCode } from "../lib/warehouses.js";
import { mockManager, mockRunHistory } from "../mocks/fixtures.js";
import { distributionRuns } from "../schema.js";
import { idParamsSchema } from "../types/common.types.js";
import {
	acceptReturnSchema,
	listRunsQuerySchema,
	requestRevisionSchema,
} from "../types/distribution-run.types.js";

// Stock manager side of distribution runs and return approvals.
const router = express.Router();

// Distribution Runs page, and Return Approvals
// (?status=return_submitted for pending, ?status=closed for accepted).
router.get("/distribution-runs", async (req: Request, res: Response) => {
	const result = listRunsQuerySchema.safeParse(req.query);
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

	res.json(await loadRuns({ status, warehouseId, fdoId }));
});

router.get("/distribution-runs/:id", async (req: Request, res: Response) => {
	const params = idParamsSchema.safeParse(req.params);
	if (!params.success) {
		return res.status(400).json({ error: params.error.issues });
	}

	const [run] = await loadRuns({ id: params.data.id });
	if (!run) return res.status(404).json({ error: "Run not found" });
	res.json(run);
});

// Request Revision form: send a submitted return back to the FDO.
router.post(
	"/distribution-runs/:id/revision-request",
	async (req: Request, res: Response) => {
		const params = idParamsSchema.safeParse(req.params);
		if (!params.success) {
			return res.status(400).json({ error: params.error.issues });
		}
		const result = requestRevisionSchema.safeParse(req.body);
		if (!result.success) {
			return res.status(400).json({ error: result.error.issues });
		}

		// only a submitted return can be sent back
		const [updated] = await db
			.update(distributionRuns)
			.set({
				status: "revision_requested",
				revisionFeedback: result.data.feedback,
			})
			.where(
				and(
					eq(distributionRuns.id, params.data.id),
					eq(distributionRuns.status, "return_submitted"),
				),
			)
			.returning({ id: distributionRuns.id });

		if (!updated) {
			const [run] = await db
				.select({ id: distributionRuns.id })
				.from(distributionRuns)
				.where(eq(distributionRuns.id, params.data.id));
			if (!run) return res.status(404).json({ error: "Run not found" });
			return res.status(409).json({
				error: "Only a submitted return can be sent back for revision",
			});
		}

		const [run] = await loadRuns({ id: updated.id });
		res.json(run);
	},
);

// Accept Return: close the run and put the verified stock back.
router.post(
	"/distribution-runs/:id/acceptance",
	async (req: Request, res: Response) => {
		const params = idParamsSchema.safeParse(req.params);
		if (!params.success) {
			return res.status(400).json({ error: params.error.issues });
		}
		const result = acceptReturnSchema.safeParse(req.body);
		if (!result.success) {
			return res.status(400).json({ error: result.error.issues });
		}

		// TODO(auth): closed_by_id and stock_movements.created_by_id must be
		// the signed-in stock manager. Mock response, nothing is written.
		// The real version, in one transaction: sets verified_return_qty per
		// product, inserts a `return` movement per product (+verified qty),
		// and sets status = 'closed', closed_at, closed_by_id and
		// verification_note (required when there is a variance).
		const [mock] = mockRunHistory;
		res.json({
			...mock,
			id: params.data.id,
			closedBy: mockManager,
			closedAt: new Date().toISOString(),
			verificationNote: result.data.note ?? null,
		});
	},
);

export default router;
