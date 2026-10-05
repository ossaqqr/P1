import { createRequire } from "node:module";
import express, { type Express } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";

const require = createRequire(import.meta.url);
const pinoHttp = require("pino-http") as (options: {
  logger: typeof logger;
  serializers: {
    req: (req: { id?: string; method?: string; url?: string }) => unknown;
    res: (res: { statusCode: number }) => unknown;
  };
}) => express.RequestHandler;

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware());

app.use("/api", router);

export default app;
