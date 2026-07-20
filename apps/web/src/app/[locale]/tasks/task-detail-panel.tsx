import { createElement } from "react";

import { WorkItemDrawer } from "../my-work/work-item-drawer";

export function TaskDetailPanel({
  catalog,
  item,
  onClose,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  item: import("@evaluation/contracts").WorkItemDetail;
  onClose: () => void;
}>) {
  return createElement(WorkItemDrawer, { catalog, item, onClose });
}
