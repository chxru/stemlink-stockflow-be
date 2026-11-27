import type { requestStatus, runStatus } from "../schema.js";

// Shapes returned by the API. Real endpoints and mocked endpoints both use
// these, so the frontend sees the same data either way.

export type RequestStatus = (typeof requestStatus.enumValues)[number];
export type RunStatus = (typeof runStatus.enumValues)[number];

export type PersonRef = { id: number; name: string };
export type WarehouseRef = { id: number; code: string; name: string };
export type OutletRef = { id: number; name: string; area: string };

export type StockRequestResponse = {
	id: number;
	status: RequestStatus;
	fdo: PersonRef;
	warehouse: WarehouseRef;
	route: string | null;
	plannedDate: string | null;
	note: string | null;
	requestedAt: string;
	decidedBy: PersonRef | null;
	allocatedAt: string | null;
	allocationNote: string | null;
	rejectedAt: string | null;
	rejectionReason: string | null;
	acceptedAt: string | null;
	run: { id: number; status: RunStatus } | null;
	totalRequested: number;
	totalAllocated: number | null;
	products: {
		productId: number;
		sku: string;
		name: string;
		requested: number;
		allocated: number | null;
		available: number;
	}[];
};

export type RunProductResponse = {
	productId: number;
	sku: string;
	name: string;
	issued: number;
	delivered: number;
	expectedReturn: number;
	declaredReturn: number | null;
	verifiedReturn: number | null;
	variance: number | null;
};

export type DeliveryResponse = {
	id: number;
	runId: number;
	outlet: OutletRef;
	deliveredAt: string;
	note: string | null;
	totalUnits: number;
	products: {
		productId: number;
		sku: string;
		name: string;
		quantity: number;
	}[];
};

export type RunResponse = {
	id: number;
	requestId: number;
	status: RunStatus;
	fdo: PersonRef;
	warehouse: WarehouseRef;
	route: string | null;
	createdAt: string;
	collectedAt: string | null;
	returnSubmittedAt: string | null;
	returnNote: string | null;
	revisionFeedback: string | null;
	closedAt: string | null;
	closedBy: PersonRef | null;
	verificationNote: string | null;
	totals: {
		issued: number;
		delivered: number;
		expectedReturn: number;
		declaredReturn: number | null;
		verifiedReturn: number | null;
		variance: number | null;
	};
	products: RunProductResponse[];
	deliveries: DeliveryResponse[];
};
