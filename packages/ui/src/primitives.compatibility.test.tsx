import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type ActionButtonProperties = {
  children?: ReactNode;
  isDisabled?: boolean;
  variant?: "primary" | "secondary" | "quiet" | "critical";
};

async function actionButton(): Promise<ComponentType<ActionButtonProperties>> {
  const path = "./actions/action-button.tsx";
  const module = (await import(path)) as {
    ActionButton: ComponentType<ActionButtonProperties>;
  };
  return module.ActionButton;
}

describe("owned accessible primitive compatibility", () => {
  it("server-renders an Arabic action with owned variants and disabled semantics", async () => {
    const ActionButton = await actionButton();
    const markup = renderToStaticMarkup(
      createElement(ActionButton, { isDisabled: true, variant: "primary" }, "تأكيد"),
    );

    expect(markup).toContain("تأكيد");
    expect(markup).toContain("disabled");
    expect(markup).toContain("primary");
  });

  it("exports disclosure, dialog, icon, and reduced-motion wrappers from the owned boundary", async () => {
    const module = await import("./index.ts");

    expect(module).toHaveProperty("ProductDisclosure");
    expect(module).toHaveProperty("FocusedDialog");
    expect(module).toHaveProperty("ProductIcon");
    expect(module).toHaveProperty("SemanticMotionProvider");
  });
});
