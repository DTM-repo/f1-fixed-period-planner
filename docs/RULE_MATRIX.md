# Rule Matrix

Last verified against the July 17, 2026 final rule: July 19, 2026.

Core safety rule: calculate only from confirmed facts and modeled rule text. Preserve every result that remains valid when another fact is missing. Stop a final report when answers conflict, but explain what needs clarification instead of returning a dead end.

Date rule: student-facing controls require Month, Day, and Year. Narrative intake accepts explicit month-name or ISO dates and does not guess the order of numeric dates such as `6/2/2029`.

## Current F-1 Students Under D/S

Required facts:

- In the United States in valid F-1 status on September 15, 2026.
- D/S on the I-94. This is the assumed current-student norm, with a visible correction path for a dated I-94.
- I-20 program end date in effect on September 15, 2026.
- EAD end date in effect on that date when approved OPT or STEM OPT applies.

Deterministic result:

- The old-rule study or training period ends on the later active I-20 or qualifying EAD date, capped at September 15, 2030.
- The transition F-1 preparation-for-departure period is 60 days after that date.
- A program or approved training plan beyond the protected date produces an extension-of-stay plan, not a guessed approval.
- Travel after the effective date is a separate fixed-period return alternative. The app compares staying in the United States with returning; it does not claim that travel preserves D/S or automatically starts four new years.

## Incoming, Readmitted, or Change-of-Status F-1

Required facts:

- I-20 program start and end dates.
- Planned entry date for an initial admission or return.
- Actual I-94 admit-until date once CBP has issued it.

Deterministic result:

- The ordinary maximum study or training period is measured from the Form I-20 program start date, not the day of entry.
- The study or training period is the earlier of the applicable program limit and I-20 end date.
- The projected I-94 date includes the final 30 days. The app never adds a second 30-day period to an actual I-94 date.
- Entry more than 30 days before the I-20 start is flagged.
- English-language training uses a 24-month maximum; public high school uses a 12-month aggregate maximum.
- Change of status inside the United States leads to the fixed-period system. Departure while that request is pending is separately warned because it can abandon the request.

## Extension of Stay

- The app separates the date to begin planning, the end of authorized study or training, and the last day USCIS may receive a timely Form I-539.
- A complete filing needs an endorsed I-20, supporting financial evidence, the filing fee, and any biometrics USCIS requires.
- Current general fees are displayed as $420 online or $470 by paper, with a linked USCIS source.
- Premium processing is not promised for this extension category.
- The app never predicts USCIS approval.

## OPT and STEM OPT Transition

- A qualifying post-completion OPT filing must be within the ordinary filing period, by March 18, 2027, and within the transition departure period.
- STEM OPT also requires the current EAD end date and a filing no later than that date.
- An approved EAD end date can control the protected training end, followed by the transition 60-day period.
- A missing EAD date does not erase the known I-20 timeline; the app shows the partial result and asks for the EAD date.

## Academic Mobility

- Undergraduate school or program changes during the first academic year are blocked unless the rule's exception process applies.
- Graduate program changes and graduate school transfers are separate rules: program changes are prohibited; a transfer requires an SEVP extenuating-circumstances exception.
- Starting another program at the same or a lower education level after a covered completion is flagged.
- Every academic-mobility result notes DHS authority to delay or suspend these restrictions through September 14, 2028; the deployment must keep that implementation status current.

## CPT, Travel, and Unusual Endings

- The rule did not eliminate Day One CPT or rewrite substantive CPT eligibility.
- CPT remains limited by the DSO-authorized CPT end date on the I-20 and cannot continue beyond the underlying program period.
- The pending-extension issue arises only when the student's fixed or transition activity deadline arrives before an otherwise-valid I-20 and CPT authorization would end.
- If USCIS receives a complete I-539 before that earlier activity deadline, already-authorized CPT may continue while the extension is pending for up to 240 days or the DSO-authorized CPT end date, whichever comes first.
- Filing only after the employment-authorized activity period ends does not automatically preserve or start CPT while the extension remains pending.
- Automatic visa revalidation and a pending-I-539 return for a longer period are routed to explicit caution rather than an ordinary projection.
- F-2 dependents are included in the extension plan.
- Early completion uses 30 days, authorized withdrawal uses 15 days, and a status violation receives no departure period.

## Outside the Current Module

- M-1 and J-1 calculations.
- A full CPT eligibility determination or employer-specific authorization review.
- SEVIS transaction instructions.
- Visa issuance predictions, port-of-entry predictions, and USCIS approval predictions.
- Filing packet or legal representation services.
