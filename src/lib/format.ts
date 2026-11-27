import type { PersonRef } from "../types/responses.types.js";

type NameParts = { id: number; firstName: string; lastName: string };

export function toPerson(user: NameParts): PersonRef;
export function toPerson(user: NameParts | null): PersonRef | null;
export function toPerson(user: NameParts | null): PersonRef | null {
	return user
		? { id: user.id, name: `${user.firstName} ${user.lastName}` }
		: null;
}

export function toIso(date: Date): string;
export function toIso(date: Date | null): string | null;
export function toIso(date: Date | null): string | null {
	return date ? date.toISOString() : null;
}

export function sumBy<T>(rows: T[], pick: (row: T) => number): number {
	return rows.reduce((total, row) => total + pick(row), 0);
}
