import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
await app.listen(
  Number(process.env.WORKER_HEALTH_PORT ?? "3001"),
  process.env.WORKER_HEALTH_HOST ?? "127.0.0.1",
);
