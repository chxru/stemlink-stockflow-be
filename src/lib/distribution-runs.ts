import { db } from "../db.js";
import type { RunResponse, RunStatus } from "../types/responses.types.js";
import { sumBy, toIso, toPerson } from "./format.js";

export type RunFilter = {
	id?: number | undefined;
	status?: RunStatus | undefined;
	warehouseId?: number | undefined;
	fdoId?: number | undefined;
};

// only the name fields, never email or clerk id
const nameColumns = { id: true, firstName: true, lastName: true } as const;
const productColumns = { id: true, sku: true, name: true } as const;

/**
 * Load distribution runs, newest first, with their products and deliveries.
 * Delivered, expected return and variance are calculated here, never stored.
 */
export async function loadRuns(filter: RunFilter = {}): Promise<RunResponse[]> {
	// Drizzle turns this into SQL and returns nested objects (see relations.ts)
	const runs = await db.query.distributionRuns.findMany({
		where: (run, { and, eq }) =>
			and(
				filter.id ? eq(run.id, filter.id) : undefined,
				filter.status ? eq(run.status, filter.status) : undefined,
				filter.warehouseId
					? eq(run.warehouseId, filter.warehouseId)
					: undefined,
				filter.fdoId ? eq(run.fdoId, filter.fdoId) : undefined,
			),
		orderBy: (run, { desc }) => [desc(run.createdAt)],
		with: {
			fdo: { columns: nameColumns },
			closedBy: { columns: nameColumns },
			warehouse: { columns: { id: true, code: true, name: true } },
			request: { columns: { route: true } },
			items: { with: { product: { columns: productColumns } } },
			deliveries: {
				orderBy: (delivery, { desc }) => [desc(delivery.deliveredAt)],
				with: {
					outlet: { columns: { id: true, name: true, area: true } },
					items: { with: { product: { columns: productColumns } } },
				},
			},
		},
	});

	return runs.map((run) => {
		const deliveries = run.deliveries.map((delivery) => ({
			id: delivery.id,
			runId: delivery.runId,
			outlet: delivery.outlet,
			deliveredAt: toIso(delivery.deliveredAt),
			note: delivery.note,
			totalUnits: sumBy(delivery.items, (line) => line.quantity),
			products: delivery.items.map((line) => ({
				productId: line.product.id,
				sku: line.product.sku,
				name: line.product.name,
				quantity: line.quantity,
			})),
		}));

		const products = run.items.map((item) => {
			// delivered = everything handed to outlets for this product
			const delivered = sumBy(run.deliveries, (delivery) =>
				sumBy(delivery.items, (line) =>
					line.productId === item.productId ? line.quantity : 0,
				),
			);
			const expectedReturn = item.issuedQty - delivered;
			// the manager's verified count wins over the FDO's declared count
			const counted = item.verifiedReturnQty ?? item.declaredReturnQty;

			return {
				productId: item.product.id,
				sku: item.product.sku,
				name: item.product.name,
				issued: item.issuedQty,
				delivered,
				expectedReturn,
				declaredReturn: item.declaredReturnQty,
				verifiedReturn: item.verifiedReturnQty,
				variance: counted === null ? null : expectedReturn - counted,
			};
		});

		// a total is only known once every product has a value
		const totalOf = (values: (number | null)[]) =>
			values.includes(null) ? null : sumBy(values, (value) => value ?? 0);

		return {
			id: run.id,
			requestId: run.requestId,
			status: run.status,
			fdo: toPerson(run.fdo),
			warehouse: run.warehouse,
			route: run.request.route,
			createdAt: toIso(run.createdAt),
			collectedAt: toIso(run.collectedAt),
			returnSubmittedAt: toIso(run.returnSubmittedAt),
			returnNote: run.returnNote,
			revisionFeedback: run.revisionFeedback,
			closedAt: toIso(run.closedAt),
			closedBy: toPerson(run.closedBy),
			verificationNote: run.verificationNote,
			totals: {
				issued: sumBy(products, (p) => p.issued),
				delivered: sumBy(products, (p) => p.delivered),
				expectedReturn: sumBy(products, (p) => p.expectedReturn),
				declaredReturn: totalOf(products.map((p) => p.declaredReturn)),
				verifiedReturn: totalOf(products.map((p) => p.verifiedReturn)),
				variance: totalOf(products.map((p) => p.variance)),
			},
			products,
			deliveries,
		};
	});
}
