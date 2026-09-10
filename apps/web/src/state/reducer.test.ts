import { describe, expect, it } from "vitest";
import { workspaceReducer } from "./reducer";
import { createInitialState, type WorkspaceState } from "./types";

function initial(): WorkspaceState {
  return createInitialState("system");
}

describe("workspaceReducer", () => {
  it("opens a file as a new active tab in the active pane", () => {
    const state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    const pane = state.panes[0];
    expect(pane.tabs).toHaveLength(1);
    expect(pane.tabs[0].path).toBe("a.md");
    expect(pane.activeTabId).toBe(pane.tabs[0].id);
  });

  it("does not duplicate a tab for an already-open file", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    state = workspaceReducer(state, { type: "openFile", path: "b.md", title: "b" });
    state = workspaceReducer(state, { type: "openFile", path: "a.md", title: "a" });
    const pane = state.panes[0];
    expect(pane.tabs.map((tab) => tab.path)).toEqual(["a.md", "b.md"]);
    expect(pane.tabs.find((tab) => tab.id === pane.activeTabId)?.path).toBe("a.md");
  });

  it("closes a tab and updates the active tab", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    state = workspaceReducer(state, { type: "openFile", path: "b.md", title: "b" });
    const paneId = state.panes[0].id;
    const firstTabId = state.panes[0].tabs[0].id;
    state = workspaceReducer(state, { type: "closeTab", paneId, tabId: firstTabId });
    expect(state.panes[0].tabs.map((tab) => tab.path)).toEqual(["b.md"]);
  });

  it("splits (duplicate) into a second pane and caps at two panes", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    const paneId = state.panes[0].id;
    state = workspaceReducer(state, { type: "splitPane", paneId, mode: "duplicate" });
    expect(state.panes).toHaveLength(2);
    expect(state.panes[0].tabs[0].path).toBe("a.md"); // original kept
    expect(state.panes[1].tabs[0].path).toBe("a.md"); // duplicated

    state = workspaceReducer(state, {
      type: "splitPane",
      paneId: state.panes[1].id,
      mode: "duplicate",
    });
    expect(state.panes).toHaveLength(2);
  });

  it("splits (move) the active tab into the new pane", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    state = workspaceReducer(state, { type: "openFile", path: "b.md", title: "b" });
    const paneId = state.panes[0].id;
    state = workspaceReducer(state, { type: "splitPane", paneId, mode: "move" });
    expect(state.panes).toHaveLength(2);
    expect(state.panes[0].tabs.map((tab) => tab.path)).toEqual(["a.md"]); // b moved out
    expect(state.panes[1].tabs.map((tab) => tab.path)).toEqual(["b.md"]);
  });

  it("moves the active tab to the opposite group", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    state = workspaceReducer(state, { type: "openFile", path: "b.md", title: "b" });
    const left = state.panes[0].id;
    state = workspaceReducer(state, { type: "splitPane", paneId: left, mode: "move" });
    // left has [a] active, right has [b]
    state = workspaceReducer(state, { type: "moveTabToOpposite", paneId: state.panes[0].id });
    // left had only "a"; moving it collapses back to a single pane containing a and b
    expect(state.panes).toHaveLength(1);
    expect(state.panes[0].tabs.map((tab) => tab.path).sort()).toEqual(["a.md", "b.md"]);
  });

  it("closes an empty split pane and keeps at least one pane", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    const paneId = state.panes[0].id;
    state = workspaceReducer(state, { type: "splitPane", paneId, mode: "duplicate" });
    expect(state.panes).toHaveLength(2);

    // Closing one pane leaves the other.
    const target = state.panes[1].id;
    state = workspaceReducer(state, { type: "closePane", paneId: target });
    expect(state.panes).toHaveLength(1);
    expect(state.activePaneId).toBe(state.panes[0].id);

    // Closing the last remaining pane is a no-op.
    state = workspaceReducer(state, { type: "closePane", paneId: state.panes[0].id });
    expect(state.panes).toHaveLength(1);
  });

  it("changes the theme", () => {
    const state = workspaceReducer(initial(), { type: "setTheme", theme: "dark" });
    expect(state.theme).toBe("dark");
  });

  it("reorders tabs within the same pane via moveTab", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    state = workspaceReducer(state, { type: "openFile", path: "b.md", title: "b" });
    state = workspaceReducer(state, { type: "openFile", path: "c.md", title: "c" });
    const pane = state.panes[0];
    const tabA = pane.tabs[0];

    // Move "a" (index 0) to after "c" (insert at index 3)
    state = workspaceReducer(state, {
      type: "moveTab",
      fromPaneId: pane.id,
      tabId: tabA.id,
      toPaneId: pane.id,
      toIndex: 3,
    });
    expect(state.panes[0].tabs.map((t) => t.path)).toEqual(["b.md", "c.md", "a.md"]);
    expect(state.panes[0].activeTabId).toBe(tabA.id);
  });

  it("moves a tab between panes via moveTab", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    state = workspaceReducer(state, { type: "openFile", path: "b.md", title: "b" });
    const left = state.panes[0].id;
    state = workspaceReducer(state, { type: "splitPane", paneId: left, mode: "duplicate" });
    // left: [a, b], right: [b] (duplicate of active)
    const right = state.panes[1].id;
    const tabA = state.panes[0].tabs[0];

    state = workspaceReducer(state, {
      type: "moveTab",
      fromPaneId: left,
      tabId: tabA.id,
      toPaneId: right,
      toIndex: 0,
    });
    expect(state.panes.find((p) => p.id === left)?.tabs.map((t) => t.path)).toEqual(["b.md"]);
    // right already had b.md; a.md is inserted at index 0
    const rightPane = state.panes.find((p) => p.id === right);
    expect(rightPane?.tabs[0].path).toBe("a.md");
  });

  it("collapses the source pane when moveTab empties it", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    const left = state.panes[0].id;
    state = workspaceReducer(state, { type: "splitPane", paneId: left, mode: "duplicate" });
    const right = state.panes[1].id;
    // right has only the duplicate of a.md
    const rightTabId = state.panes[1].tabs[0].id;

    state = workspaceReducer(state, {
      type: "moveTab",
      fromPaneId: right,
      tabId: rightTabId,
      toPaneId: left,
      toIndex: 1,
    });
    expect(state.panes).toHaveLength(1);
    expect(state.panes[0].id).toBe(left);
  });

  it("splits with a specific tabId via splitPane", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    state = workspaceReducer(state, { type: "openFile", path: "b.md", title: "b" });
    const pane = state.panes[0];
    const tabA = pane.tabs[0]; // "a" is not active (b is)

    state = workspaceReducer(state, {
      type: "splitPane",
      paneId: pane.id,
      mode: "move",
      tabId: tabA.id,
    });
    expect(state.panes).toHaveLength(2);
    // "a" moved to new pane, "b" stays in original
    expect(state.panes[0].tabs.map((t) => t.path)).toEqual(["b.md"]);
    expect(state.panes[1].tabs.map((t) => t.path)).toEqual(["a.md"]);
  });

  it("splits with insertBefore to place new pane on the left", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    state = workspaceReducer(state, { type: "openFile", path: "b.md", title: "b" });
    const pane = state.panes[0];

    state = workspaceReducer(state, {
      type: "splitPane",
      paneId: pane.id,
      mode: "move",
      insertBefore: true,
    });
    expect(state.panes).toHaveLength(2);
    // New pane is first (left), original is second (right)
    expect(state.panes[0].tabs.map((t) => t.path)).toEqual(["b.md"]); // active tab moved to new pane on left
    expect(state.panes[1].tabs.map((t) => t.path)).toEqual(["a.md"]); // original keeps non-active tab
  });
});

describe("navigation stack", () => {
  it("openFile pushes to navHistory", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    expect(state.navHistory).toHaveLength(1);
    expect(state.navHistory[0]).toEqual({ path: "a.md", title: "a" });
    expect(state.navIndex).toBe(0);

    state = workspaceReducer(state, { type: "openFile", path: "b.md", title: "b" });
    expect(state.navHistory).toHaveLength(2);
    expect(state.navIndex).toBe(1);
  });

  it("opening same path does not duplicate history entry", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    state = workspaceReducer(state, { type: "openFile", path: "a.md", title: "a" });
    expect(state.navHistory).toHaveLength(1);
    expect(state.navIndex).toBe(0);
  });

  it("navBack navigates to the previous entry", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    state = workspaceReducer(state, { type: "openFile", path: "b.md", title: "b" });
    expect(state.panes[0].tabs.find((t) => t.id === state.panes[0].activeTabId)?.path).toBe("b.md");

    state = workspaceReducer(state, { type: "navBack" });
    expect(state.navIndex).toBe(0);
    const activeTab = state.panes[0].tabs.find((t) => t.id === state.panes[0].activeTabId);
    expect(activeTab?.path).toBe("a.md");
  });

  it("navForward navigates forward after going back", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    state = workspaceReducer(state, { type: "openFile", path: "b.md", title: "b" });
    state = workspaceReducer(state, { type: "navBack" });
    state = workspaceReducer(state, { type: "navForward" });
    expect(state.navIndex).toBe(1);
    const activeTab = state.panes[0].tabs.find((t) => t.id === state.panes[0].activeTabId);
    expect(activeTab?.path).toBe("b.md");
  });

  it("navBack at start is a no-op", () => {
    const state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    const next = workspaceReducer(state, { type: "navBack" });
    expect(next.navIndex).toBe(0);
    expect(next).toBe(state);
  });

  it("navForward at end is a no-op", () => {
    const state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    const next = workspaceReducer(state, { type: "navForward" });
    expect(next.navIndex).toBe(0);
    expect(next).toBe(state);
  });

  it("opening a file after going back truncates forward history", () => {
    let state = workspaceReducer(initial(), { type: "openFile", path: "a.md", title: "a" });
    state = workspaceReducer(state, { type: "openFile", path: "b.md", title: "b" });
    state = workspaceReducer(state, { type: "navBack" });
    // Now open a new file — this should drop "b.md" from history.
    state = workspaceReducer(state, { type: "openFile", path: "c.md", title: "c" });
    expect(state.navHistory.map((e) => e.path)).toEqual(["a.md", "c.md"]);
    expect(state.navIndex).toBe(1);
  });
});
