import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import next from "next";
import http from "http";
import { startScheduler } from "./src/cron/scheduler";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);
const hostname = "localhost";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  startScheduler();
  const server = http.createServer((req, res) => handle(req, res));
  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
