import { describe, expect, it } from "vitest";
import { feedbackResponseState, feedbackResponseSummary } from "./feedbackResponse.js";

const submitted = { id: "a", created_at: "2026-09-28T00:00:00.000Z", status: "pending" };
const now = Date.parse("2026-09-30T01:00:00.000Z");

describe("feedback response tracking", () => {
  it("flags an unanswered item past its default target", () => {
    expect(feedbackResponseState(submitted, {}, now)).toMatchObject({ targetHours: 48, ageHours: 49, overdue: true, hasReply: false });
  });

  it("uses a saved target and only a recorded queue time as a reply", () => {
    const triage = { a: { response_target_hours: 72, first_reply_queued_at: "2026-09-29T00:00:00.000Z" } };
    expect(feedbackResponseState(submitted, triage, now)).toMatchObject({ targetHours: 72, hasReply: true, overdue: false, elapsedHours: 24 });
  });

  it("counts closed reports with no recorded reply separately", () => {
    const feedback = [submitted, { ...submitted, id: "b", status: "resolved" }];
    expect(feedbackResponseSummary(feedback, {}, now)).toMatchObject({ openAwaiting: 1, overdue: 1, queued: 0, closedWithoutRecordedReply: 1 });
  });
});
