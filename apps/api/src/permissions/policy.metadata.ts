export type PolicyRequest = Record<string, unknown> & {
  readonly principal?: import("@evaluation/auth").AuthenticatedPrincipal;
};

export type LoadedPolicyResource = Readonly<{
  resource: import("@evaluation/permissions").PolicyResource;
  context: import("@evaluation/permissions").PolicyContext;
  roleAssignments: import("@evaluation/permissions").PolicyInput["roles"];
}>;

export type PolicyResourceLoader = (
  request: PolicyRequest,
  principal: import("@evaluation/auth").AuthenticatedPrincipal,
) => Promise<LoadedPolicyResource>;

export type PolicyRequirement = Readonly<{
  action: import("@evaluation/permissions").PolicyAction;
  loadResource: PolicyResourceLoader;
}>;

export const POLICY_REQUIREMENT = Symbol("POLICY_REQUIREMENT");
