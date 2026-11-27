import { db } from "../db.js";
import type {
	RequestStatus,
	StockRequestResponse,
} from "../types/responses.types.js";
import { sumBy, toIso, toPerson } from "./format.js";
import { getStockLookup, stockKey } from "./stock.js";

export type StockRequestFilter = {
	id?: number | undefined;
	status?: RequestStatus | undefined;
	warehouseId?: number | undefined;
	fdoId?: number | undefined;
};

// only the name fields, never email or clerk id
const nameColumns = { id: true, firstName: true, lastName: true } as const;

/** Load stock requests, newest first, with their products. */
export async function loadStockRequests(
	filter: StockRequestFilter = {},
): Promise<StockRequestResponse[]> {
	const requests = await db.query.stockRequests.findMany({
		where: (request, { and, eq }) =>
			and(
				filter.id ? eq(request.id, filter.id) : undefined,
				filter.status ? eq(request.status, filter.status) : undefined,
				filter.warehouseId
					? eq(request.warehouseId, filter.warehouseId)
					: undefined,
				filter.fdoId ? eq(request.fdoId, filter.fdoId) : undefined,
			),
		orderBy: (request, { desc }) => [desc(request.requestedAt)],
		with: {
			fdo: { columns: nameColumns },
			decidedBy: { columns: nameColumns },
			warehouse: { columns: { id: true, code: true, name: true } },
			run: { columns: { id: true, status: true } },
			items: {
				with: { product: { columns: { id: true, sku: true, name: true } } },
			},
		},
	});

	// "available" = current stock of each product in the request's warehouse
	const stock = await getStockLookup([
		...new Set(requests.map((request) => request.warehouseId)),
	]);

	return requests.map((request) => {
		const products = request.items.map((item) => ({
			productId: item.product.id,
			sku: item.product.sku,
			name: item.product.name,
			requested: item.requestedQty,
			allocated: item.allocatedQty,
			available: stock.get(stockKey(request.warehouseId, item.productId)) ?? 0,
		}));
		const isAllocated = products.some((p) => p.allocated !== null);

		return {
			id: request.id,
			status: request.status,
			fdo: toPerson(request.fdo),
			warehouse: request.warehouse,
			route: request.route,
			plannedDate: request.plannedDate,
			note: request.requestNote,
			requestedAt: toIso(request.requestedAt),
			decidedBy: toPerson(request.decidedBy),
			allocatedAt: toIso(request.allocatedAt),
			allocationNote: request.allocationNote,
			rejectedAt: toIso(request.rejectedAt),
			rejectionReason: request.rejectionReason,
			acceptedAt: toIso(request.acceptedAt),
			run: request.run,
			totalRequested: sumBy(products, (p) => p.requested),
			totalAllocated: isAllocated
				? sumBy(products, (p) => p.allocated ?? 0)
				: null,
			products,
		};
	});
}
