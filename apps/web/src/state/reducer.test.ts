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

  it("changes the theme", () => {
    const state = workspaceReducer(initial(), { type: "setTheme", theme: "dark" });
    expect(state.theme).toBe("dark");
  });
});
