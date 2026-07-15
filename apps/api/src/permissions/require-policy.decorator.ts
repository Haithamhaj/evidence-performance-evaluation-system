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

const policyRequirements = new WeakMap<Function, PolicyRequirement>();

export function RequirePolicy(
  action: import("@evaluation/permissions").PolicyAction,
  loadResource: PolicyResourceLoader,
): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    if (typeof descriptor.value !== "function") {
      throw new TypeError("RequirePolicy can only decorate a method");
    }
    policyRequirements.set(descriptor.value, Object.freeze({ action, loadResource }));
  };
}

export function getPolicyRequirement(handler: Function): PolicyRequirement | undefined {
  return policyRequirements.get(handler);
}
