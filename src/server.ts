import "dotenv/config";
import cors from "cors";
import express, {
	type NextFunction,
	type Request,
	type Response,
} from "express";
import morgan from "morgan";

import distributionRunsRouter from "./controllers/distribution-runs.controllers.js";
import fdoRouter from "./controllers/fdo.controllers.js";
import outletsRouter from "./controllers/outlets.controllers.js";
import productsRouter from "./controllers/products.controllers.js";
import stockRouter from "./controllers/stock.controllers.js";
import stockRequestsRouter from "./controllers/stock-requests.controllers.js";
import usersRouter from "./controllers/users.controllers.js";
import warehousesRouter from "./controllers/warehouses.controllers.js";

const app = express();
// the frontend's VITE_SERVER_URL points at 4000 (it runs on 3000 itself)
const port = Number(process.env.PORT ?? 4000);

// middlewares
app.use(morgan("tiny"));
app.use(cors()); // the frontend runs on a different port
app.use(express.json());

// routes
app.get("/health", (_req, res) => {
	res.json({ status: "ok" });
});

app.use(
	"/api",
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
