export type AdminAuthorizationPort = Readonly<{
  isSystemAdministrator(actorId: string): Promise<boolean>;
}>;

export type OwnerCommandReceipt = Readonly<{
  ownerDomain: string;
  ownerReceiptId: string;
  auditEventId: string;
}>;

export type OwnerCommandPort = Readonly<{
  execute(command: import("@evaluation/contracts").AdminCommand): Promise<OwnerCommandReceipt>;
}>;

export type OwnerCommandRegistry = Partial<
  Record<import("@evaluation/contracts").AdminCommand["capability"], OwnerCommandPort>
>;

export type AdminHealthProbe = Readonly<{
  dependency: import("@evaluation/contracts").AdminDependencyHealth["dependency"];
  check(): Promise<Readonly<Record<string, unknown>>>;
}>;
