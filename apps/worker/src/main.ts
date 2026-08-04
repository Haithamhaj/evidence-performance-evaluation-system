import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { workerHealthPort } from "./platform/worker-health-port.js";

const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
await app.listen(workerHealthPort(), process.env.WORKER_HEALTH_HOST ?? "127.0.0.1");
