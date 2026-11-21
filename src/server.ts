import express from "express";
import morgan from "morgan";

import categoriesRouter from "./controllers/categories.controllers.js";
import itemsRouter from "./controllers/items.controllers.js";

const app = express();
const port = 3000;

// middlewares
app.use(morgan("tiny"));
app.use(express.json());

// routes
app.use(itemsRouter);
app.use(categoriesRouter);

app.listen(port, (error) => {
	if (error) {
		console.error("couldn't start server", error);
		return;
	}

	console.log(`server is running in localhost:${port}`);
});
