# Upload rule review — 29 October 2026

This ledger records source review, not government-portal acceptance tests.

| Pack | Source / location | Enabled conditions | Review status |
|---|---|---|---|
| Telangana ePASS fresh 2026–27 | Official fresh form, required-document upload field | JPEG photograph maximum 30 KB | Preserved from 24 October review; no new review date asserted |
| TG EAPCET 2026 | Official 2026 application guide, pages 34–35 | JPEG photograph below 50 KB; signature below 30 KB | Preserved from 24 October review; 2026 reference only |
| NEET UG 2026 | Official NTA bulletin, printed p16, PDF p21, items i–ii | JPEG photograph 10–200 KB; signature 10–100 KB | Reviewed 29 October; 2026 reference only |
| CUET UG 2026 | Official NTA bulletin, page 10, upload scanned images | JPEG photograph 10–200 KB; signature 10–50 KB | Reviewed 29 October; 2026 reference only |

Official URLs, sections and limits live beside each rule in `src/packs/*.json`. KB interpretation is explicitly 1024 bytes; the documents do not establish identical byte-unit handling by every live portal.

## Excluded cases

- **JEE Main 2026:** the reviewed bulletin's application-procedure text (printed page 4, PDF page 10) says photo 10–200 KB / signature 10–100 KB. Its replica upload screen says photo 10–300 KB / signature 10–50 KB. No target is enabled from this conflicting evidence. Source: https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/10/202510311145384616.pdf
- **NEET fingerprints:** the upload specification and following guidance give conflicting ranges. No fingerprint target is enabled.
- **2027 cycles, recruitment, PDF document processing, live camera capture, face position, background compliance and legal authenticity:** not verified/enabled by this release.

The app does not claim the archived intake is open. A later cycle needs a new official source and independent pack. Routine reminders do not automatically update requirements.
