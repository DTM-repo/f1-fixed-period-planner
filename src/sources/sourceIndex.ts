export interface SourceReference {
  id: string;
  title: string;
  locator: string;
  url: string;
  published?: string;
  effective?: string;
  lastVerified: string;
}

const FEDERAL_REGISTER_RULE =
  "https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant";
const ruleParagraph = (paragraph: number) => `${FEDERAL_REGISTER_RULE}#p-${paragraph}`;

export const SOURCE_INDEX: Record<string, SourceReference> = {
  "FR-2026-FINAL-RULE": {
    id: "FR-2026-FINAL-RULE",
    title: "Establishing a Fixed Time Period of Admission and an Extension of Stay Procedure for Nonimmigrant Academic Students, Exchange Visitors, and Representatives of Foreign Information Media",
    locator: "Federal Register final rule, DHS, published July 17, 2026",
    url: FEDERAL_REGISTER_RULE,
    published: "2026-07-17",
    effective: "2026-09-15",
    lastVerified: "2026-07-19"
  },
  "8CFR-214-1-A4": {
    id: "8CFR-214-1-A4",
    title: "8 CFR 214.1(a)(4), fixed period of admission",
    locator: "Final rule regulatory text for fixed admissions after the effective date",
    url: ruleParagraph(1748),
    lastVerified: "2026-07-19"
  },
  "8CFR-214-1-M1": {
    id: "8CFR-214-1-M1",
    title: "8 CFR 214.1(m)(1), transition treatment for D/S admissions",
    locator: "Final rule transition provisions for F and J nonimmigrants admitted for duration of status",
    url: ruleParagraph(1731),
    lastVerified: "2026-07-19"
  },
  "8CFR-214-1-M1-OPT": {
    id: "8CFR-214-1-M1-OPT",
    title: "8 CFR 214.1(m)(1)(i)-(ii), transition OPT/STEM OPT filing treatment",
    locator: "Final rule transition provisions for F-1 post-completion OPT and STEM OPT filings",
    url: ruleParagraph(1732),
    lastVerified: "2026-07-19"
  },
  "8CFR-214-1-C8": {
    id: "8CFR-214-1-C8",
    title: "8 CFR 214.1(c)(8), travel while extension request is pending",
    locator: "Final rule pending extension and departure provisions",
    url: ruleParagraph(1728),
    lastVerified: "2026-07-19"
  },
  "8CFR-214-2-F11": {
    id: "8CFR-214-2-F11",
    title: "8 CFR 214.2(f)(11), F-1 practical training extension-of-stay mechanics",
    locator: "Final rule updates for OPT/STEM OPT extension-of-stay filing context",
    url: ruleParagraph(1803),
    lastVerified: "2026-07-19"
  },
  "8CFR-214-2-F5V": {
    id: "8CFR-214-2-F5V",
    title: "8 CFR 214.2(f)(5)(v), F-1 period of preparation for departure",
    locator: "Final rule fixed-period F-1 30-day departure/maintain-status period",
    url: ruleParagraph(1760),
    lastVerified: "2026-07-19"
  },
  "8CFR-214-2-F5II": {
    id: "8CFR-214-2-F5II",
    title: "8 CFR 214.2(f)(5)(ii), F-1 school transfer, program change, and education-level limits",
    locator: "Final rule rules for undergraduate first-year changes, graduate changes/transfers, and same/lower-level programs",
    url: ruleParagraph(1754),
    lastVerified: "2026-07-19"
  },
  "8CFR-214-2-F5II-GRADUATE": {
    id: "8CFR-214-2-F5II-GRADUATE",
    title: "8 CFR 214.2(f)(5)(ii)(A), graduate program and transfer limits",
    locator: "Regulatory text for changes and transfers during an active graduate program",
    url: ruleParagraph(1754),
    lastVerified: "2026-07-20"
  },
  "8CFR-214-2-F5II-SAME-LOWER": {
    id: "8CFR-214-2-F5II-SAME-LOWER",
    title: "8 CFR 214.2(f)(5)(ii)(C), same- or lower-level study",
    locator: "DHS explanation that only programs completed after September 15, 2026 count toward the new limit",
    url: ruleParagraph(794),
    lastVerified: "2026-07-21"
  },
  "8CFR-214-2-F5VIII-CPT": {
    id: "8CFR-214-2-F5VIII-CPT",
    title: "8 CFR 214.2(f)(5)(viii), CPT and employment during a pending extension",
    locator: "Final rule discussion of CPT, day-one CPT, and employment while an F-1 extension of stay is pending",
    url: ruleParagraph(1768),
    lastVerified: "2026-07-19"
  },
  "FR-FOUR-YEAR-START": {
    id: "FR-FOUR-YEAR-START",
    title: "DHS explanation of the four-year calculation",
    locator: "Final rule preamble: the maximum period is calculated from the Form I-20 program start date",
    url: ruleParagraph(537),
    lastVerified: "2026-07-19"
  },
  "8CFR-214-2-F7": {
    id: "8CFR-214-2-F7",
    title: "8 CFR 214.2(f)(7), F-1 extension of stay",
    locator: "Eligibility, filing requirements, timing, dependents, and extension length",
    url: ruleParagraph(1779),
    lastVerified: "2026-07-19"
  },
  "8CFR-214-2-F7-TIMELY": {
    id: "8CFR-214-2-F7-TIMELY",
    title: "8 CFR 214.2(f)(7)(iii)(B), timely extension filing",
    locator: "USCIS receipt deadline and work limits during the final 30 days",
    url: ruleParagraph(1780),
    lastVerified: "2026-07-19"
  },
  "8CFR-214-2-F8-TRANSFER": {
    id: "8CFR-214-2-F8-TRANSFER",
    title: "8 CFR 214.2(f)(8), transfer eligibility and timing",
    locator: "Regulatory text for a transfer from post-completion or STEM OPT into a later program",
    url: ruleParagraph(1797),
    lastVerified: "2026-07-20"
  },
  "8CFR-214-2-F5-EXCEPTIONS": {
    id: "8CFR-214-2-F5-EXCEPTIONS",
    title: "8 CFR 214.2(f)(5)(i), shorter fixed-period limits",
    locator: "English-language training, public high school, pending OPT, and F-2 limits",
    url: ruleParagraph(1748),
    lastVerified: "2026-07-19"
  },
  "8CFR-214-2-F5II-DELAY": {
    id: "8CFR-214-2-F5II-DELAY",
    title: "8 CFR 214.2(f)(5)(ii)(E), possible implementation delay",
    locator: "DHS authority to delay or suspend academic-mobility restrictions through September 14, 2028",
    url: ruleParagraph(1758),
    lastVerified: "2026-07-19"
  },
  "USCIS-G1055-I539": {
    id: "USCIS-G1055-I539",
    title: "USCIS G-1055 Fee Schedule, Form I-539",
    locator: "Form I-539 general filing fee: $470 paper filing or $420 online filing; page last reviewed August 29, 2025",
    url: "https://www.uscis.gov/g-1055?topic_id=97292",
    lastVerified: "2026-07-19"
  },
  "FR-F1-EXTENSION-PROCESS": {
    id: "FR-F1-EXTENSION-PROCESS",
    title: "DHS discussion of F-1 extension processing",
    locator: "Final rule discussion of possible biometrics and interviews for F-1 extension applicants",
    url: ruleParagraph(704),
    lastVerified: "2026-07-19"
  },
  "FR-I539-PREMIUM": {
    id: "FR-I539-PREMIUM",
    title: "DHS discussion of premium processing for Form I-539",
    locator: "Final rule response explaining that premium processing is not currently available for this extension request",
    url: ruleParagraph(612),
    lastVerified: "2026-07-19"
  },
  "FR-F1-TEMPORARY-INTENT": {
    id: "FR-F1-TEMPORARY-INTENT",
    title: "DHS discussion of F-1 eligibility during extension review",
    locator: "Final rule response explaining that DHS reassesses the statutory F-1 requirements during an extension adjudication",
    url: ruleParagraph(476),
    lastVerified: "2026-07-20"
  },
  "FR-I140-OUT-OF-SCOPE": {
    id: "FR-I140-OUT-OF-SCOPE",
    title: "DHS treatment of I-140 comments in this rulemaking",
    locator: "Final rule section identifying I-140 and employment-based immigration comments as outside this rule's scope",
    url: ruleParagraph(1414),
    lastVerified: "2026-07-20"
  },
  "USCIS-OPT-STEM": {
    id: "USCIS-OPT-STEM",
    title: "USCIS Practical Training for F-1 Students",
    locator: "USCIS overview of post-completion OPT and the later 24-month STEM OPT extension",
    url: "https://www.uscis.gov/node/92821",
    lastVerified: "2026-07-19"
  },
  "NAFSA-DS-FINAL-RULE-HUB": {
    id: "NAFSA-DS-FINAL-RULE-HUB",
    title: "NAFSA DHS Final Rule Ending Duration of Status",
    locator: "NAFSA public analysis and link hub for the DHS final rule ending duration of status, dated July 18, 2026",
    url: "https://www.nafsa.org/regulatory-information/dhs-final-rule-ending-duration-status",
    published: "2026-07-18",
    lastVerified: "2026-07-19"
  }
};

export function source(id: string): SourceReference {
  return SOURCE_INDEX[id];
}

export function sourceLinkLabel(reference: SourceReference): string {
  if (reference.url.startsWith(`${FEDERAL_REGISTER_RULE}#p-`)) {
    return "Open the highlighted rule passage";
  }
  if (reference.id === "FR-2026-FINAL-RULE") {
    return "Open the official rule";
  }
  return "Open the cited source";
}
