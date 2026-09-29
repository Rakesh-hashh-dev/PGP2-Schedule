import { describe, expect, it } from "vitest";
import { getConfigHistoryDiff, stageConfigSnapshot } from "./configHistory";

describe("configuration restore staging", () => {
  it("keeps live deployment bookkeeping and does not republish a retired role roster", () => {
    const history = [{ timestamp: "2026-09-01", flags: {} }];
    const queue = [{ id: "later" }];
    const staged = stageConfigSnapshot({
      enableFriends: false,
      configHistory: [{ flags: { configHistory: [{ flags: {} }] } }],
      scheduledConfigDeploys: [{ id: "old" }],
      adminRoles: { user_1: "superadmin" },
    }, { configHistory: history, scheduledConfigDeploys: queue });

    expect(staged).toEqual({ enableFriends: false, configHistory: history, scheduledConfigDeploys: queue });
    expect(staged.configHistory).toBe(history);
    expect(staged.scheduledConfigDeploys).toBe(queue);
  });

  it("shows changed live settings without exposing bookkeeping as a setting", () => {
    const changes = getConfigHistoryDiff(
      { enableFriends: true, configHistory: [{ flags: {} }], scheduledConfigDeploys: [{ id: 1 }] },
      { enableFriends: false, configHistory: [] },
    );
    expect(changes).toEqual([{ key: "enableFriends", label: "Social / Friends", before: "On", after: "Off", beforeRaw: "true", afterRaw: "false", details: "" }]);
  });
});
