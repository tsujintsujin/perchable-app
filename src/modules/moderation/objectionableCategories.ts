/** The seven objectionable-content reasons, in display order. Single source for the
 * report reason list (label) and the Terms text (description); keys match `reports_reason_check`. */
export const OBJECTIONABLE_CATEGORIES = [
  { key: "spam", label: "Spam or scam", description: "Ads, repeated messages, fake links or anything meant to trick people." },
  { key: "harassment", label: "Harassment or bullying", description: "Insulting, targeting or repeatedly bothering someone." },
  { key: "hate", label: "Hate speech", description: "Attacking people for their race, religion, gender, sexuality, disability or nationality." },
  { key: "sexual", label: "Sexual content", description: "Nudity or sexually explicit photos, captions or messages." },
  { key: "violence", label: "Violence or threats", description: "Threatening or encouraging harm, or graphic violence shown for shock." },
  { key: "impersonation", label: "Pretending to be someone else", description: "Using someone else's name, photo or identity to mislead people." },
  { key: "other", label: "Something else", description: "Anything else that is illegal or seriously harmful." },
] as const;

export type ReportReason = (typeof OBJECTIONABLE_CATEGORIES)[number]["key"];

/** Max length of the "Something else" details; matches `reports_details_length`. */
export const REPORT_DETAILS_MAX = 500;
