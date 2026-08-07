type FutureMode = "MANAGER_BLINDED" | "ANONYMOUS_AGGREGATED";

interface PrivatePolicy {
  readonly enabled: boolean;
  readonly mode: FutureMode;
  readonly managerCanReadIdentity: false;
  readonly managerCanReadOriginals: false;
  readonly minimumTopicSupport: number;
}

interface Ports {
  readonly auditBeforeRead: (input: Readonly<{ mode: FutureMode; reason: string }>) => Promise<unknown>;
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
  constructor(private readonly ports: Ports) {}

  async read(input: ReadInput) {
    if (
      input.policy === null ||
      !input.policy.enabled ||
      input.policy.mode !== input.mode ||
      input.policy.managerCanReadIdentity ||
      input.policy.managerCanReadOriginals
    ) {
      return { allowed: false } as const;
    }

    const topics = input.topics
      .filter(({ support }) => support >= input.policy!.minimumTopicSupport)
      .map(({ key }) => key);
    let identity: string | null = null;
    if (input.sensitiveAccess?.authorized && input.identityLink && this.ports.readSealedIdentity) {
      await this.ports.auditBeforeRead({ mode: input.mode, reason: input.sensitiveAccess.reason });
      identity = await this.ports.readSealedIdentity(input.identityLink);
    }
    return {
      allowed: true,
      identity,
      managerProjection: { identity: null, originals: null, topics },
    } as const;
  }
}
