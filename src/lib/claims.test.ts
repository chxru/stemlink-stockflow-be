import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAccessProblem, profileFromClaims } from "./claims.js";

const manager = {
	role: "stock-manager",
	email: "nimal@stockflow.lk",
	firstName: "Nimal",
	lastName: "Perera",
};

describe("profileFromClaims", () => {
	it("maps Clerk's stock-manager role to the database enum", () => {
		assert.deepEqual(profileFromClaims(manager), {
			role: "stock_manager",
			email: "nimal@stockflow.lk",
			firstName: "Nimal",
			lastName: "Perera",
			warehouseCode: null,
		});
	});

	it("ignores a warehouse claim on a stock manager", () => {
		const profile = profileFromClaims({ ...manager, warehouse: "WH-1" });
		assert.ok(!isAccessProblem(profile));
		assert.equal(profile.warehouseCode, null);
	});

	it("keeps an FDO's home warehouse code", () => {
		const profile = profileFromClaims({
			...manager,
			role: "fdo",
			warehouse: " WH-1 ",
		});
		assert.ok(!isAccessProblem(profile));
		assert.equal(profile.role, "fdo");
		assert.equal(profile.warehouseCode, "WH-1");
	});

	it("rejects an FDO without a home warehouse", () => {
		const profile = profileFromClaims({ ...manager, role: "fdo" });
		assert.ok(isAccessProblem(profile));
		assert.equal(profile.problem, "missing-warehouse");
	});

	it("rejects a missing role", () => {
		const profile = profileFromClaims({ ...manager, role: null });
		assert.ok(isAccessProblem(profile));
		assert.equal(profile.problem, "missing-role");
	});

	it("rejects a role StockFlow doesn't know", () => {
		const profile = profileFromClaims({ ...manager, role: "admin" });
		assert.ok(isAccessProblem(profile));
		assert.equal(profile.problem, "missing-role");
	});

	it("rejects a token without the custom claims", () => {
		const profile = profileFromClaims({ role: "fdo", warehouse: "WH-1" });
		assert.ok(isAccessProblem(profile));
		assert.equal(profile.problem, "missing-profile");
	});

	it("falls back to the email when Clerk has no name", () => {
		const profile = profileFromClaims({
			role: "stock-manager",
			email: "kamal@stockflow.lk",
			firstName: null,
			lastName: "",
		});
		assert.ok(!isAccessProblem(profile));
		assert.equal(profile.firstName, "kamal");
		assert.equal(profile.lastName, "");
	});
});
