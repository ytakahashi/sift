---
name: respond
description:
  Address Sift review threads and hand the changes back to the reviewer. Use when an implementer is
  asked to respond to a Sift review.
---

Start with `wait_for_turn` using role `implementer`. Repeat while it returns `waiting`. On
`your-turn`, read `list_notes` with the returned `reviewId` and inspect the current changes before
deciding how to respond.

Write replies that describe what happened. Choose a resolution for each reply.

- `fixed` when you made the change. Explain what changed and include any focused verification that
  helps the reviewer check it.
- `declined` when you understand the concern and choose to keep the current behavior. Explain the
  concrete reason.
- `discuss` when the intended behavior is unclear or you need the reviewer to evaluate an
  alternative. Ask a specific question or explain the disagreement.

Send the replies together with `submit_response` using that `reviewId`. Then call `wait_for_turn`
again for the next round. Follow up on remaining open threads using the latest replies and current
changes.

On `approved`, use `list_notes` with the review ID from your last turn to check for comments added
with the approval. Tell the user whether you will act on any of those optional comments, then end
the turn. On `needs-user`, `peer-gone`, or `timeout`, end the turn and report the state and any
remaining work to the user.
