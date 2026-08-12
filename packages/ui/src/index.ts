export const PACKAGE_NAME = "@notes/ui";

/* Primitives */
export { PopupMenu } from "./popup-menu";
export { Island, IslandHeader, IslandBody, IslandFooter } from "./island";
export { TabStrip, Tab } from "./tabs";
export { ContextMenu, type ContextMenuEntry, type CustomContextMenuBuilder } from "./context-menu";
export { PanelGroup, PanelSection, PanelHeader, PanelBody, PanelEmpty } from "./panel";
export { Modal, ModalHeader, ModalBody, ModalFooter } from "./modal";

/* Hooks */
export { useTabOverflow } from "./use-tab-overflow";
export type { OverflowableTab } from "./use-tab-overflow";
export { useContextMenu, fitMenuToViewport } from "./use-context-menu";
export type { MenuPosition, ContextMenuState } from "./use-context-menu";
export { usePreventChildDrag } from "./use-prevent-child-drag";
export { useDraggable } from "./use-draggable";
