import { randomUUID } from "node:crypto";

export type SafeEmailMessage = Readonly<{
  recipientId: string;
  templateKey: string;
  templateArguments: Readonly<Record<string, string>>;
  actionKind: string;
}>;

export interface EmailAdapter {
  send(message: SafeEmailMessage): Promise<Readonly<{ receipt: string }>>;
}

export class EmailDeliveryError extends Error {
  constructor(readonly category: "TRANSIENT" | "PERMANENT") {
    super(`Email delivery ${category.toLowerCase()} failure`);
  }
}

export class InMemoryEmailAdapter implements EmailAdapter {
  readonly messages: SafeEmailMessage[] = [];
  private nextFailure: "TRANSIENT" | "PERMANENT" | undefined;

  failNext(category: "TRANSIENT" | "PERMANENT") {
    this.nextFailure = category;
  }

  async send(message: SafeEmailMessage) {
    if (this.nextFailure) {
      const failure = this.nextFailure;
      this.nextFailure = undefined;
      throw new EmailDeliveryError(failure);
    }
    this.messages.push(message);
    return { receipt: `local:${randomUUID()}` };
  }
}

export class UnavailableEmailAdapter implements EmailAdapter {
  async send(): Promise<never> {
    throw new EmailDeliveryError("PERMANENT");
  }
}
