type ConnectedSourceAdapter = import("../source-adapter.js").ConnectedSourceAdapter;
type PullSourceInput = import("../source-adapter.js").PullSourceInput;
type SourceDeltaPage = import("../source-adapter.js").SourceDeltaPage;

type GoogleWorkspaceRestAdapterDependencies = Readonly<{
  gmail: ConnectedSourceAdapter;
  calendar: ConnectedSourceAdapter;
}>;

/** Keeps provider selection outside Gmail and Calendar payload parsers. */
export class GoogleWorkspaceRestAdapter implements ConnectedSourceAdapter {
  private readonly gmail: ConnectedSourceAdapter;
  private readonly calendar: ConnectedSourceAdapter;

  constructor(dependencies: GoogleWorkspaceRestAdapterDependencies) {
    this.gmail = dependencies.gmail;
    this.calendar = dependencies.calendar;
  }

  pull(input: PullSourceInput): Promise<SourceDeltaPage> {
    return input.provider === "GOOGLE_GMAIL" ? this.gmail.pull(input) : this.calendar.pull(input);
  }
}
