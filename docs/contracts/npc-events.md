# NPC events

The participant event API and choice occurrence contract are specified in web/API.md, section “NPC event cycle”. Migration 011 stores durable waiting clocks, guidance and occurrences. Choices update the existing city, region and alignment ledgers atomically with completion. Ticks and submissions share session locks; database constraints additionally enforce one active occurrence per participant and one choice per occurrence.

At the 90-second deadline, unanswered situations with no location participate in random selection, including authored content awaiting map placement. The generated greeting is used only when the session has no playable authored content. Answered situations never repeat for the same participant and session; exhaustion leaves the participant waiting. This replaces the original generic-only, reusable fallback policy.

Mapped situations only match the participant route map version and configured radius. Approved exhibition coordinates must be configured for mapped events; no prototype coordinates are supplied or inferred for unlocated content.
