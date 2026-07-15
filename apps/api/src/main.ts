import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { AppErrorFilter } from "./platform/error.filter.js";

const app = await NestFactory.create(AppModule);
app.useGlobalFilters(new AppErrorFilter());
await app.listen(3000);
