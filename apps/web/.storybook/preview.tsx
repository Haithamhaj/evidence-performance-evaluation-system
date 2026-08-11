import { createElement } from "react";

import "../src/app/globals.css";

const preview = {
  decorators: [
    (Story: () => React.ReactNode, context: { globals: Readonly<{ locale?: string }> }) => {
      const locale = context.globals.locale === "ar" ? "ar" : "en";
      return createElement(
        "div",
        { dir: locale === "ar" ? "rtl" : "ltr", lang: locale },
        createElement(Story),
      );
    },
  ],
  globalTypes: {
    locale: {
      defaultValue: "en",
      description: "Interface locale and direction",
      toolbar: {
        icon: "globe",
        items: [
          { title: "English", value: "en" },
          { title: "العربية", value: "ar" },
        ],
      },
    },
  },
  initialGlobals: { locale: "en" },
  parameters: {
    a11y: { test: "error" },
    controls: { expanded: true },
    layout: "fullscreen",
    options: { storySort: { order: ["Foundation"] } },
  },
};

export default preview;
