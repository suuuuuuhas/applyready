# ApplyReady + FeeSafe

A browser-local student application checker. The app compares manually entered details, inspects and corrects images, and creates printable readiness reports, proof checklists and editable college letters.

**Live application:** https://applyready-plum.vercel.app

## Run

Use Node.js 24 LTS (the reviewed build used 24.14.0).

```sh
npm ci
npm test
npm run build
npm run dev
```

No database, API key or environment file is required. Entered details and image files stay in browser memory. Clear session resets identity details, images, output settings and FeeSafe fields. No government accounts or submission actions are integrated.

## Reviewed scope

- Telangana ePASS 2026–27 fresh registration: entered-name/DOB consistency, the income-certificate date condition, declared document availability, the EBC bank-document exception for review, and the current 30 KB JPG photo target. These are limited checks, not a complete eligibility or approval assessment.
- TG EAPCET 2026: entered-name/DOB consistency plus separate JPG photograph and signature targets from the official 2026 user guide. The guide uses strict less-than limits. Images must only be uploaded when the official form asks for them; some records are populated automatically. This is not a 2027 rule pack.
- Recruitment image checking remains visibly unavailable because a named current notification and its exact conditions have not been verified. Generic local image processing does not certify portal compliance.
- FeeSafe uses explicitly editorial status categories. It does not retrieve account status, assert entitlement, calculate reimbursement or promise an outcome.

Source URLs, applicability and review dates are stored in `src/rules.ts` and shown in the app and printable reports. A successful check refers only to the configured comparison or file property.

## Verification

Unit tests cover name normalization/initials, real calendar dates, future dates, certificate boundaries, category and unknown states, rule isolation, initial privacy defaults, image sizing/crop safety and factual letter generation.

Release verification additionally exercised the built application in desktop and mobile browsers: correction freshness, malformed images, JPEG download and revalidation, both EAPCET image targets, clipboard behavior, complete multi-page letter printing, report/proof print isolation, clear-session privacy and same-origin-only requests. The reviewed release passed 14 unit tests and 18 browser workflow checks.

## Release

Build with `npm run build`; the static output is in `dist/`. The live application is hosted on Vercel. For a source-based Vercel project, choose the Vite preset, `npm run build` as the build command, and `dist` as the output directory. No environment variables or database provisioning are required.
