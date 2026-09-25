import { normalizeVacancyUrl } from "../vacancy-identity.ts";

export type FirstScoreJob = {
  id: string;
  kind?: string;
  state?: string;
  status?: string;
  input?: string;
  reportN?: string;
};

export type FirstScoreApplication = {
  n: string;
  company: string;
  role: string;
  url?: string;
};

export type FirstScoreIdentity = {
  reportN: string;
  company: string;
  role: string;
  href: string;
};

const SEEN_PREFIX = "career-ops:first-score-seen:";

/** Select only the successful evaluation explicitly completed during this session. */
export function selectSessionEvaluation<T extends FirstScoreJob>(jobs: T[], completedId: string | null): T | null {
  if (!completedId) return null;
  const job = jobs.find((candidate) => candidate.id === completedId);
  return job?.kind === "evaluate" && job.state === "completed" && job.status === "done" ? job : null;
}

/** Resolve display data exclusively from the persisted applications tracker. */
export function resolveFirstScoreIdentity(
  job: FirstScoreJob,
  applications: FirstScoreApplication[],
): FirstScoreIdentity | null {
  let application: FirstScoreApplication | undefined;
  const reportN = job.reportN?.trim();
  if (reportN && /^\d+$/.test(reportN)) {
    application = applications.find((item) => item.n === reportN);
  }
  if (!application && job.input?.trim()) {
    const input = job.input.trim();
    if (/^\d+$/.test(input)) {
      application = applications.find((item) => item.n === input);
    } else {
      const normalizedInput = normalizeVacancyUrl(input);
      if (normalizedInput) {
        application = applications.find((item) => item.url && normalizeVacancyUrl(item.url) === normalizedInput);
      }
    }
  }
  if (!application || !/^\d+$/.test(application.n) || !application.company.trim() || !application.role.trim()) return null;
  return {
    reportN: application.n,
    company: application.company.trim(),
    role: application.role.trim(),
    href: `/pipeline/${application.n}`,
  };
}

export function firstScoreSeenKey(jobId: string): string {
  return `${SEEN_PREFIX}${encodeURIComponent(jobId)}`;
}
