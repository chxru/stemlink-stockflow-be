import type { User } from "../schema.js";

// Declaration merging: add our own field to Express's Request type.
// attachUser (src/middlewares/attach-user.ts) sets it.
declare global {
	namespace Express {
		interface Request {
			user?: User;
		}
	}
}
