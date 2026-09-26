const DEFAULT_ISSUE_REPOSITORY = "SaadNiaziDev/career-ops-public";
const configuredIssueRepository = process.env.NEXT_PUBLIC_ISSUE_REPOSITORY?.trim() ?? "";

export const ISSUE_REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(configuredIssueRepository)
  ? configuredIssueRepository
  : DEFAULT_ISSUE_REPOSITORY;

export function issueSearchUrl(query) {
  const q = `repo:${ISSUE_REPOSITORY} is:issue is:open ${query}`;
  return `https://api.github.com/search/issues?per_page=4&q=${encodeURIComponent(q)}`;
}

export function newIssueUrl(params) {
  return `https://github.com/${ISSUE_REPOSITORY}/issues/new?${params.toString()}`;
}
