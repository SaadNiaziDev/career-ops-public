export const ACTIVITY_CHANNELS = ["company-site", "linkedin", "x", "email", "gmail", "mail-app", "referral", "other", "unknown"] as const;
export type ActivityChannel = typeof ACTIVITY_CHANNELS[number];
export type ActivityKind = "application" | "email" | "followup" | "note" | "status";

export type ApplicationActivity = {
  id: string;
  n: string;
  kind: ActivityKind;
  at: string;
  channel: ActivityChannel;
  recipient?: string;
  subject?: string;
  body?: string;
  url?: string;
  cvFile?: string;
  note?: string;
  sourceKey?: string;
  legacy?: boolean;
};
export type ActivityInput = Omit<ApplicationActivity, "at" | "sourceKey" | "legacy"> & { confirmed: boolean; occurredAt?: string; overrideReason?: string };

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  application: "Application submitted", email: "Email sent", followup: "Follow-up sent", note: "Note", status: "Status changed",
};
export const CHANNEL_LABELS: Record<ActivityChannel, string> = {
  "company-site": "Company site", linkedin: "LinkedIn", x: "X", email: "Email", gmail: "Gmail", "mail-app": "Mail app", referral: "Referral", other: "Other", unknown: "Not recorded",
};

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validateActivityInput(raw: unknown): ActivityInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Activity details required.");
  const value = raw as Record<string, unknown>;
  const text = (key: string, max: number, preserve = false) => {
    const input = value[key];
    if (input == null) return undefined;
    if (typeof input !== "string" || input.length > max) throw new Error(`Invalid ${key}.`);
    return input.trim() ? (preserve ? input : input.trim()) : undefined;
  };
  const id = text("id", 36) ?? "";
  const n = text("n", 6) ?? "";
  if (!UUID.test(id) || !/^[1-9]\d{0,5}$/.test(n)) throw new Error("Invalid activity or application number.");
  if (!["application", "email", "followup", "note"].includes(String(value.kind))) throw new Error("Invalid activity type.");
  const kind = value.kind as ActivityInput["kind"];
  if (!(ACTIVITY_CHANNELS as readonly unknown[]).includes(value.channel)) throw new Error("Select how you applied or sent the message.");
  if (kind !== "note" && value.confirmed !== true) throw new Error("Confirm the application or message was sent before recording it.");
  const occurredAt = text("occurredAt", 40);
  if (occurredAt && (!Number.isFinite(Date.parse(occurredAt)) || Date.parse(occurredAt) > Date.now() + 60_000)) throw new Error("Enter a valid date in the past.");
  const url = text("url", 2000);
  if (url) {
    try { if (!["http:", "https:"].includes(new URL(url).protocol)) throw new Error(); }
    catch { throw new Error("Enter an HTTP or HTTPS application link."); }
  }
  const recipient = text("recipient", 500);
  const subject = text("subject", 500);
  const body = text("body", 20_000, true);
  const note = text("note", 2000);
  if ((kind === "email" || kind === "followup" || (kind === "application" && ["email", "gmail", "mail-app"].includes(String(value.channel)))) && (!recipient || !body)) throw new Error("Save the recipient and the exact message you sent.");
  if (kind === "note" && !note) throw new Error("Write a note first.");
  return { id, n, kind, channel: value.channel as ActivityChannel, confirmed: value.confirmed === true, occurredAt, recipient, subject, body, url, cvFile: text("cvFile", 500), note, overrideReason: text("overrideReason", 500) };
}
