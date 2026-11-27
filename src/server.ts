import "dotenv/config";
import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import express, {
	type NextFunction,
	type Request,
	type Response,
} from "express";
import morgan from "morgan";

import distributionRunsRouter from "./controllers/distribution-runs.controllers.js";
import fdoRouter from "./controllers/fdo.controllers.js";
import meRouter from "./controllers/me.controllers.js";
import outletsRouter from "./controllers/outlets.controllers.js";
import productsRouter from "./controllers/products.controllers.js";
import stockRouter from "./controllers/stock.controllers.js";
import stockRequestsRouter from "./controllers/stock-requests.controllers.js";
import usersRouter from "./controllers/users.controllers.js";
import warehousesRouter from "./controllers/warehouses.controllers.js";

// clerkMiddleware can't verify anything without these, and every request
// would fail with a vague 500. Fail loudly at startup instead.
for (const name of ["CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]) {
	if (!process.env[name]) {
		console.error(
			`Missing ${name}. Copy it from the Clerk dashboard into .env`,
		);
		process.exit(1);
	}
}

const app = express();
// the frontend's VITE_SERVER_URL points at 4000 (it runs on 3000 itself)
const port = Number(process.env.PORT ?? 4000);

// Browsers may only call this API from these origins (comma separated).
// Native mobile apps aren't browsers, so CORS doesn't apply to them.
const corsOrigins = (
	process.env.CORS_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000"
)
	.split(",")
	.map((origin) => origin.trim());

// middlewares
app.use(morgan("tiny"));
app.use(cors({ origin: corsOrigins })); // the frontend runs on a different port
app.use(express.json());
// Reads the session token (Authorization: Bearer ... or the __session cookie),
// checks its signature and expiry, and makes getAuth(req) work. It doesn't
// block anyone: routes that need a user add the attachUser middleware.
app.use(clerkMiddleware());

// routes
app.get("/health", (_req, res) => {
	res.json({ status: "ok" });
});

app.use(
	"/api",
	meRouter,
	warehousesRouter,
	productsRouter,
	outletsRouter,
	usersRouter,
	stockRouter,
	stockRequestsRouter,
	distributionRunsRouter,
	fdoRouter,
);

app.use((_req: Request, res: Response) => {
	res.status(404).json({ error: "Not found" });
});

// Express 5 sends errors thrown in async handlers here
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
	console.error(error);
	res.status(500).json({ error: "Something went wrong" });
});

app.listen(port, (error) => {
	if (error) {
		console.error("couldn't start server", error);
		return;
	}

	console.log(`server is running in localhost:${port}`);
});
