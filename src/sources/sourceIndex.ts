export interface SourceReference {
  id: string;
  title: string;
  locator: string;
  url: string;
  published?: string;
  effective?: string;
  lastVerified: string;
}

export const SOURCE_INDEX: Record<string, SourceReference> = {
  "FR-2026-FINAL-RULE": {
    id: "FR-2026-FINAL-RULE",
    title: "Establishing a Fixed Time Period of Admission and an Extension of Stay Procedure for Nonimmigrant Academic Students, Exchange Visitors, and Representatives of Foreign Information Media",
    locator: "Federal Register final rule, DHS, published July 17, 2026",
    url: "https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant",
    published: "2026-07-17",
    effective: "2026-09-15",
    lastVerified: "2026-07-19"
  },
  "8CFR-214-1-A4": {
    id: "8CFR-214-1-A4",
    title: "8 CFR 214.1(a)(4), fixed period of admission",
    locator: "Final rule regulatory text for fixed admissions after the effective date",
    url: "https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant",
    lastVerified: "2026-07-19"
  },
  "8CFR-214-1-M1": {
    id: "8CFR-214-1-M1",
    title: "8 CFR 214.1(m)(1), transition treatment for D/S admissions",
    locator: "Final rule transition provisions for F and J nonimmigrants admitted for duration of status",
    url: "https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant",
    lastVerified: "2026-07-19"
  },
  "8CFR-214-1-M1-OPT": {
    id: "8CFR-214-1-M1-OPT",
    title: "8 CFR 214.1(m)(1)(i)-(ii), transition OPT/STEM OPT filing treatment",
    locator: "Final rule transition provisions for F-1 post-completion OPT and STEM OPT filings",
    url: "https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant",
    lastVerified: "2026-07-19"
  },
  "8CFR-214-1-C8": {
    id: "8CFR-214-1-C8",
    title: "8 CFR 214.1(c)(8), travel while extension request is pending",
    locator: "Final rule pending extension and departure provisions",
    url: "https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant",
    lastVerified: "2026-07-19"
  },
  "8CFR-214-2-F11": {
    id: "8CFR-214-2-F11",
    title: "8 CFR 214.2(f)(11), F-1 practical training extension-of-stay mechanics",
    locator: "Final rule updates for OPT/STEM OPT extension-of-stay filing context",
    url: "https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant",
    lastVerified: "2026-07-19"
  },
  "8CFR-214-2-F5V": {
    id: "8CFR-214-2-F5V",
    title: "8 CFR 214.2(f)(5)(v), F-1 period of preparation for departure",
    locator: "Final rule fixed-period F-1 30-day departure/maintain-status period",
    url: "https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant",
    lastVerified: "2026-07-19"
  },
  "8CFR-214-2-F5II": {
    id: "8CFR-214-2-F5II",
    title: "8 CFR 214.2(f)(5)(ii), F-1 school transfer, program change, and education-level limits",
    locator: "Final rule rules for undergraduate first-year changes, graduate changes/transfers, and same/lower-level programs",
    url: "https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant",
    lastVerified: "2026-07-19"
  },
  "USCIS-G1055-I539": {
    id: "USCIS-G1055-I539",
    title: "USCIS G-1055 Fee Schedule, Form I-539",
    locator: "Form I-539 general filing fee: $470 paper filing or $420 online filing; page last reviewed August 29, 2025",
    url: "https://www.uscis.gov/g-1055?topic_id=97292",
    lastVerified: "2026-07-19"
  },
  "USCIS-I539-PREMIUM": {
    id: "USCIS-I539-PREMIUM",
    title: "USCIS premium processing bulletin for certain Form I-539 F/M/J change-of-status requests",
    locator: "USCIS bulletin describing premium processing for certain change-of-status I-539 filings and biometrics timing",
    url: "https://content.govdelivery.com/accounts/USDHSCIS/bulletins/35fa3e4",
    lastVerified: "2026-07-19"
  }
};

export function source(id: string): SourceReference {
  return SOURCE_INDEX[id];
}
