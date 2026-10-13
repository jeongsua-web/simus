# NPC events

The participant event API and choice occurrence contract are specified in web/API.md, section “NPC event cycle”. Migration 011 stores durable waiting clocks, guidance and occurrences. Choices update the existing city, region and alignment ledgers atomically with completion. Ticks and submissions share session locks; database constraints additionally enforce one active occurrence per participant and one choice per occurrence.

Generic situations must be explicitly authored for arbitrary-position use. Locations only match the participant route map version. Approved exhibition coordinates must be configured for mapped events; no prototype coordinates are supplied.
