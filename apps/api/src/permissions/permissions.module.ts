import { Module } from "@nestjs/common";

import { PolicyGuard } from "./policy.guard.js";

export class PermissionsModule {}

Module({ providers: [PolicyGuard], exports: [PolicyGuard] })(PermissionsModule);
