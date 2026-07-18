# Rule Matrix

Core safety rule: the app should give every source-backed result it can from confirmed facts, then mark the exact fact that would sharpen or change the answer. It should never present a guessed date or green status.

Date input rule: student-entered dates should use an explicit month name, day, and year. Numeric slash/dot dates are treated as a confirmation question because date order varies by country. Browser date-picker values may still be stored internally as `YYYY-MM-DD`.

## F-1 D/S Transition Cohort

Inputs:

- In the United States on September 15, 2026.
- Properly maintaining F-1 status on September 15, 2026.
- Current I-94 admission basis is D/S.
- Active I-20 program end date on September 15, 2026.
- EAD end date on September 15, 2026, if any.

Current deterministic output:

- Status end is the later of the effective-date I-20 program end or EAD end.
- That date is capped at September 15, 2030.
- F-1 departure period is 60 days after the calculated end.
- A later transfer, program change, CPT plan, or target program end creates an extension-planning flag.
- If the student travels after the effective date, the app should compare the stay-put D/S transition branch with the ordinary fixed-period return branch. The return branch uses the fixed-period 30-day post-period.

## Incoming or Readmitted F-1

Inputs:

- F-1 admission or re-entry after September 15, 2026.
- I-20 program end date used for admission.
- Admission/re-entry date if testing a post-effective-date return.

Current deterministic output:

- Admission end is the shorter of the I-20 program end or four years from admission.
- Fixed-period F-1 departure/maintain-status period is 30 days after the admit-until date.
- Program dates beyond that period create an extension-planning flag.
- Post-completion OPT/STEM OPT admission after the effective date surfaces the ordinary fixed-period context, then asks for EAD, pending I-765, DSO recommendation, and return facts needed to sharpen the OPT/STEM return branch.

## Transition OPT/STEM OPT

Inputs:

- OPT/STEM posture.
- I-765 filing date.
- Travel before filing.

Current deterministic output:

- Filing on or before March 18, 2027 is flagged as inside the transition window.
- Travel before filing is flagged for manual review.
- STEM OPT filings must also be on or before the current OPT EAD end date.
- Approved OPT/STEM OPT results show the I-20-based transition dates already available and explain how the EAD end date changes the branch.

## Pending Extension and Travel

Inputs:

- Whether an I-539 is pending when the student departs.
- Whether return seeks the balance of the prior admission or a longer admission.

Current deterministic output:

- Same-period return and longer-period return are separated.
- Longer-period return while extension is pending is flagged as higher risk.

## Not Yet Modeled as Legal Conclusions

- Full CPT eligibility.
- Change of level details.
- M-1 rule branch.
- J-1 categories and non-student exchange visitor cases.
- SEVIS transaction instructions.
- Attorney-facing filing packet generation.
