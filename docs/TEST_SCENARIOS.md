# Test Scenarios

The first deterministic tests cover:

- Current F-1 D/S student with an I-20 ending after September 15, 2030.
- Incoming F-1 student whose program ends before the four-year fixed admission cap, with the fixed-period 30-day departure/maintain-status period.
- Incoming F-1 student whose program runs beyond the four-year fixed admission cap.
- Effective-date EAD end later than I-20 end but before the transition cap.
- Effective-date EAD end later than September 15, 2030.
- Current transition student testing post-effective-date travel.
- Unknown transition facts that must route to manual review.
- Malformed dates that must route to manual review without calculating deadlines.
- Transition OPT filing inside the March 18, 2027 checkpoint.
- STEM OPT filing cases requiring the current OPT EAD end date.
- STEM OPT filing after the current OPT EAD end date.
- Approved OPT/STEM without an EAD end date.
- Pending I-539 travel with return seeking a longer I-20 period.
- Automatic visa revalidation branch.
- Fixed-period OPT/STEM admission branch, which must not be guessed by the MVP.

Next test additions:

- Transfer program end later than the effective-date I-20.
- CPT after calculated admission end.
- Pending I-539 with return for prior-admission balance.
- Approved OPT/STEM with a complete, source-backed EAD and filing-date path once that branch is explicitly modeled.
