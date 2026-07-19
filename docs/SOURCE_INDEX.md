# Source Index

Last verified: July 19, 2026. The executable registry in `src/sources/sourceIndex.ts` is canonical.

## Primary Rule

- `FR-2026-FINAL-RULE`: [Federal Register final rule](https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant), published July 17, 2026 and effective September 15, 2026.
- Local source copy used during the audit: `/Users/davidmaxon/Documents/New project/D:S Rule app/New D:S Rules.pdf`.

## Paragraph-Linked Rule Entries

- `8CFR-214-1-A4`: fixed periods of admission after the effective date, paragraph `p-1748`.
- `8CFR-214-1-M1`: transition treatment for people admitted for D/S, paragraph `p-1731`.
- `8CFR-214-1-M1-OPT`: transition OPT and STEM OPT filing treatment, paragraph `p-1732`.
- `8CFR-214-1-C8`: departure with an extension request pending, paragraph `p-1728`.
- `8CFR-214-2-F5V`: fixed-period F-1 final 30 days, paragraph `p-1760`.
- `8CFR-214-2-F5II`: school transfer, program change, and level limits, paragraph `p-1754`.
- `8CFR-214-2-F5II-DELAY`: possible delay or suspension through September 14, 2028, paragraph `p-1758`.
- `8CFR-214-2-F5-EXCEPTIONS`: shorter program limits and related exceptions, paragraph `p-1749`.
- `8CFR-214-2-F5VIII-CPT`: CPT and employment during a pending extension, paragraph `p-1768`.
- `8CFR-214-2-F7`: F-1 extension eligibility and filing requirements, paragraph `p-1769`.
- `8CFR-214-2-F7-TIMELY`: timely filing and work limits in the final 30 days, paragraph `p-1780`.
- `8CFR-214-2-F11`: practical-training extension mechanics, paragraph `p-1732`.
- `FR-FOUR-YEAR-START`: DHS explanation that the ordinary maximum is measured from the I-20 program start date, paragraph `p-537`.

The Federal Register page does not provide a unique URL for every nested CFR clause. Each source chip therefore uses the closest stable paragraph anchor, not the top of the rule.

## Supporting Public Sources

- `USCIS-G1055-I539`: [USCIS Form I-539 fee schedule](https://www.uscis.gov/g-1055?topic_id=97292), currently $420 online or $470 on paper for the general filing.
- `USCIS-I539-PREMIUM`: [USCIS premium-processing bulletin](https://content.govdelivery.com/accounts/USDHSCIS/bulletins/35fa3e4) for certain F/M/J change-of-status filings; it does not promise premium processing for the extension path calculated here.
- `NAFSA-DS-FINAL-RULE-HUB`: [NAFSA public overview and link hub](https://www.nafsa.org/regulatory-information/dhs-final-rule-ending-duration-status), used for orientation and cross-checking, not as the calculation authority.

## Source Discipline

- Every deterministic finding names the source IDs that produced it.
- The final advisor endpoint recomputes the result on the server and sends only the resulting source metadata to GPT-5.6 Sol.
- AI may paraphrase a verified result but may not create a citation, rule, date, or outcome.
- Fee, implementation-delay, and agency-practice statements need re-verification before public launch because they can change.
