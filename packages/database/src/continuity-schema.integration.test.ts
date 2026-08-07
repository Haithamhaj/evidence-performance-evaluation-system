import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => database.$disconnect());

describe("continuity and offboarding database schema", () => {
  it("creates the bounded continuity tables", async () => {
    const expected = [
      "DelegateConfirmation",
      "DeactivationReceipt",
      "Delegation",
      "DelegationAccessGap",
      "DelegationPeriod",
      "DelegationScope",
      "HandoverItem",
      "HandoverRecord",
      "HandoverRevision",
      "LeaveDecision",
      "LeaveRecord",
      "LeaveTransition",
      "ReassignmentRequiredCase",
      "ReassignmentResolution",
      "RetentionPolicyReference",
      "ReturnHandover",
    ].sort();
    const rows = await database.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY(${expected}::text[])
      ORDER BY table_name
    `;
    expect(rows.map(({ table_name }) => table_name)).toEqual(expected);
  });

  it("protects continuity history with append-only triggers", async () => {
    const protectedTables = [
      "LeaveDecision",
      "LeaveTransition",
      "HandoverRevision",
      "HandoverItem",
      "DelegationPeriod",
      "DelegationScope",
      "DelegateConfirmation",
      "DelegationAccessGap",
      "ReturnHandover",
      "ReassignmentResolution",
      "RetentionPolicyReference",
    ];
    const rows = await database.$queryRaw<Array<{ table_name: string }>>`
      SELECT event_object_table AS table_name
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND trigger_name LIKE '%_append_only'
        AND event_object_table = ANY(${protectedTables}::text[])
      GROUP BY event_object_table
      ORDER BY event_object_table
    `;
    expect(rows.map(({ table_name }) => table_name)).toEqual([...protectedTables].sort());
  });

  it("declares exact-time and emergency integrity constraints", async () => {
    const expected = [
      "DelegationPeriod_nonempty_check",
      "Delegation_emergency_reason_check",
      "LeaveRecord_nonempty_check",
    ].sort();
    const rows = await database.$queryRaw<Array<{ conname: string; convalidated: boolean }>>`
      SELECT conname, convalidated
      FROM pg_constraint
      WHERE conname = ANY(${expected}::text[])
      ORDER BY conname
    `;
    expect(rows).toEqual(expected.map((conname) => ({ conname, convalidated: true })));
  });

  it("resolves the current delegation without referencing a missing trigger-row field", async () => {
    const rows = await database.$queryRaw<Array<{ definition: string }>>`
      SELECT pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'reject_overlapping_active_delegation'
    `;
    expect(rows).toHaveLength(1);
    const definition = rows[0]!.definition.toLowerCase();
    expect(definition).toContain("to_jsonb(new)");
    expect(definition).not.toContain('else new."delegationid"');
  });
});
