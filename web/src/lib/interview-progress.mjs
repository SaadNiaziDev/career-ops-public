/**
 * @param {string[]} trackerNums
 * @param {any} adapters — request-scoped file readers and interview reducers.
 * @returns {Map<string, {done: number, total: number}>}
 */
export function readInterviewProgressMap(trackerNums, adapters) {
  const requested = new Set(trackerNums.map(String));
  const applications = adapters.applications.filter((app) => requested.has(String(app.n)));
  const progress = new Map();
  if (!applications.length) return progress;

  const shared = {
    rounds: adapters.readRounds(),
    prepFiles: adapters.readPrepFiles(),
    sessionFiles: adapters.readSessionFiles(),
  };

  for (const app of applications) {
    const prepRounds = adapters.prepRoundsFor(app, shared.prepFiles);
    const ledgerRounds = adapters.ledgerRoundsFor(app.n, shared.rounds);
    const sessions = adapters.sessionsFor(app, shared.sessionFiles);
    const knownRounds = adapters.mergeRounds(prepRounds, ledgerRounds, []);
    const sessionRounds = adapters.roundsFromSessions(
      sessions.filter((session) => session.source === "debrief" || session.source === "manual"),
      knownRounds,
    );
    const rounds = adapters.mergeRounds(prepRounds, ledgerRounds, sessionRounds);
    const { done, total } = adapters.roundProgress(rounds);
    if (total > 0) progress.set(String(app.n), { done, total });
  }

  return progress;
}
