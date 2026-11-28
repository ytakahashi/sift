---
name: review
description:
  Review repository changes with Sift and follow up on the implementer's replies until the review is
  closed or needs user input.
---

Inspect the requested changes and submit the first reviewer turn with `submit_review`. Write one
comment per actionable issue. Explain the affected behavior, the conditions that trigger the issue,
and the outcome the change should preserve. Use a line note for a specific range within one diff
hunk and a file note for feedback that applies across the file.

Use `request_changes` for issues that block approval. Use `comment` for feedback worth handing back
to the implementer when the decision to act is theirs. Use `approve` when the changes are ready.

After handing off, call `wait_for_turn` with role `reviewer`. Repeat while the status is `waiting`.
On `your-turn`, read `list_notes` with the returned `reviewId` and check the current diff against
the implementer's replies. Stale threads may contain changes that still need review. Resolve each
thread whose fix or explanation you accept. Reply to each remaining open thread with the specific
concern that still needs attention. Approve when the follow-up is satisfactory. If concerns remain,
choose between `request_changes` and `comment` using the same judgment as in the first review.
Submit the actions and verdict together using the same `reviewId`.

End the turn and report the outcome on `approved`, `needs-user`, `peer-gone`, or `timeout`. If
`wait_for_turn` returns `no-review` after you have submitted, tell the user that the review is no
longer available.
