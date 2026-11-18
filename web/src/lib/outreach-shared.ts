/** Pure outreach types + helpers shared by server and client (no node imports). */

export type EmailConfidence = "found" | "pattern" | "none";

export type OutreachPerson = {
  name: string;
  title: string;
  email: string;
  emailConfidence: EmailConfidence;
  emailEvidence?: string;
  linkedin?: string;
  x?: string;
  sourceUrl?: string;
  why?: string;
};

export type OutreachFollowup = {
  day: number;
  body: string;
  dueAt?: string;
  sentAt?: string;
};

export type OutreachStatus = "ready" | "sent" | "replied" | "dismissed";
export type SentVia = "gmail" | "mail-app" | "linkedin" | "x" | "other";

export type OutreachRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  trackerNum?: string;
  company: string;
  role: string;
  jobUrl?: string;
  companyDomain?: string;
  contact: OutreachPerson;
  alternates: OutreachPerson[];
  subject: string;
  body: string;
  linkedinNote?: string;
  followups: OutreachFollowup[];
  status: OutreachStatus;
  sentAt?: string;
  sentVia?: SentVia;
  tone?: string;
};

export const FOLLOWUP_DAYS = [3, 5, 7] as const;

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Gmail web compose, prefilled. Opens in the signed-in account; nothing is sent until the user clicks Send. */
export function gmailComposeUrl(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function mailtoUrl(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The next follow-up not yet sent, if the thread is still open. */
export function nextFollowup(record: OutreachRecord): OutreachFollowup | undefined {
  if (record.status !== "sent") return undefined;
  return record.followups.find((f) => !f.sentAt);
}

export function isFollowupDue(record: OutreachRecord, today = new Date().toISOString().slice(0, 10)): boolean {
  const next = nextFollowup(record);
  return Boolean(next?.dueAt && next.dueAt <= today);
}

export function followupSubject(subject: string): string {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}
