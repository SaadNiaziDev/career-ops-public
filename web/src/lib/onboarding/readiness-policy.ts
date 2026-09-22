export function authArgs(cliId: string): string[] | null {
  if (cliId === "claude") return ["auth", "status", "--json"];
  if (cliId === "codex") return ["login", "status"];
  if (cliId === "cursor") return ["status", "--format", "json"];
  return null;
}

export function cliProbePassed(exitCode: number | null, output: string): boolean {
  if (exitCode !== 0) return false;
  return !/(not logged in|not authenticated|unauthenticated|login required|signed out|"(?:loggedIn|isAuthenticated)"\s*:\s*false)/i.test(output);
}
