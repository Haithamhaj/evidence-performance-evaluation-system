import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { apiPort } from "./platform/api-port.js";
import { AppErrorFilter } from "./platform/error.filter.js";
import { enableGracefulShutdown } from "./platform/lifecycle.js";

const app = await NestFactory.create(AppModule);
enableGracefulShutdown(app);
app.useGlobalFilters(new AppErrorFilter());
await app.listen(apiPort());
