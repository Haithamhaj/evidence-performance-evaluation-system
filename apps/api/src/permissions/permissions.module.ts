import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { PolicyGuard } from "./policy.guard.js";

export class PermissionsModule {}

Module({
  imports: [AuthModule],
  providers: [PolicyGuard],
  exports: [AuthModule, PolicyGuard],
})(PermissionsModule);
