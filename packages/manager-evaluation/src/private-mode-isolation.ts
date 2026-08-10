type FutureMode = "MANAGER_BLINDED" | "ANONYMOUS_AGGREGATED";

interface PrivatePolicy {
  readonly enabled: boolean;
  readonly mode: FutureMode;
  readonly managerCanReadIdentity: false;
  readonly managerCanReadOriginals: false;
  readonly minimumTopicSupport: number;
}

interface Ports {
  readonly auditBeforeRead: (
    input: Readonly<{ mode: FutureMode; reason: string }>,
  ) => Promise<unknown>;
  readonly readSealedIdentity?: (reference: string) => Promise<string>;
}

interface ReadInput {
  readonly policy: PrivatePolicy | null;
  readonly mode: FutureMode;
  readonly identityLink: string | null;
  readonly topics: readonly Readonly<{ key: string; support: number }>[];
  readonly sensitiveAccess?: Readonly<{ authorized: boolean; reason: string }>;
}

export class PrivateModeIsolation {
  private readonly ports: Ports;

  constructor(ports: Ports) {
    this.ports = ports;
  }

  async read(input: ReadInput) {
    if (
      input.policy === null ||
      !input.policy.enabled ||
      input.policy.mode !== input.mode ||
      input.policy.managerCanReadIdentity ||
      input.policy.managerCanReadOriginals ||
      !Number.isInteger(input.policy.minimumTopicSupport) ||
      input.policy.minimumTopicSupport < 2
    ) {
      return { allowed: false } as const;
    }

    const topics = input.topics
      .filter(({ support }) => support >= input.policy!.minimumTopicSupport)
      .map(({ key }) => key);
    let identity: string | null = null;
    const sensitiveReason = input.sensitiveAccess?.reason.trim() ?? "";
    if (
      input.sensitiveAccess?.authorized &&
      sensitiveReason.length > 0 &&
      input.identityLink &&
      this.ports.readSealedIdentity
    ) {
      await this.ports.auditBeforeRead({ mode: input.mode, reason: sensitiveReason });
      identity = await this.ports.readSealedIdentity(input.identityLink);
    }
    return {
      allowed: true,
      identity,
      managerProjection: { identity: null, originals: null, topics },
    } as const;
  }
}
