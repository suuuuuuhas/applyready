# Contributing verified upload rules

Rules are plain JSON in `src/packs/`; `pack.schema.json` defines their shape. `npm run validate:packs` validates shape, exact dates, unique IDs, referenced sources, byte ranges and approved source hosts. The build runs this automatically. Application rules and eligibility checks must remain separate.

1. Find the official publisher's cycle-specific bulletin or live upload field. Link the exact URL and page/section. Do not copy a coaching blog or another resizer's limits.
2. Create a separate pack for a new exam **and cycle**. Never silently reuse a 2026 pack for 2027. Add its import to `src/rules.ts` and the official publisher's hostname to the validator only after review.
3. Record `reviewedAt`, the human-readable `reviewedOn`, `reviewAfter`, semantic `version`, and `cycleStatus`. `published` means specifications are published, not that applications are open. `archived` marks earlier intake reference packs. Overdue reviews show a visible reminder.
4. Every image constraint needs a source ID, exact byte boundaries and a limitation. Use integer bytes. The app currently interprets KB as 1024 bytes and displays this assumption. If the portal specifies exact bytes, use those. `below 50 KB` is an exclusive boundary (51199), while `maximum 30 KB` is inclusive (30720).
5. Only add pixel limits if explicitly stated. No guessed DPI, minimum resolution, document authenticity or face recognition claims. Add visual conditions to `manualChecks`.
6. Where sources conflict, stop and document it. Do not pick the convenient range or call an intersection "verified". Disabled packs have no enabled image constraints. NEET fingerprint rules and JEE Main 2026 are deliberately excluded because reviewed sections conflict.
7. Increase the pack version when rules change. Explain the old/new rule and evidence in the PR. Do not change a review date without actually re-reading the source.
8. Run `npm ci`, `npm test`, `npm run build`, and `npm run test:e2e` after installing the Playwright browser with `npx playwright install chromium`. Check the boundary tests and manually inspect the source. An HTTP 200 does not prove a rule is correct.

## Source review versus portal acceptance

Source review means a human checked a published specification. It does not mean a student submitted a file or the live portal accepted it. Do not replace the UI language with "portal verified" without direct evidence. Add real acceptance observations to the pilot evidence ledger only with permission and redaction.

## Privacy

Use synthetic image fixtures in tests and screenshots. Never commit student photos, signatures, identifiers, portal logins, downloaded student reports, `.env`, `.vercel`, or private agent handoffs. Rule feedback is public GitHub metadata; keep personal files and unredacted portal errors out of issues.

## Licensing

This repository currently has no open-source license grant. Public visibility permits viewing; broader reuse terms have not been selected by the owner. Contributors should discuss licensing with the owner before contributing material that needs a particular license. Official documents remain with their publishers; cite them rather than redistributing entire bulletins.
