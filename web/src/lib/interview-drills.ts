import type { InterviewRound } from "@/lib/interview-shared";

export type InterviewDrill = {
  id: string;
  title: string;
  difficulty: "Warm-up" | "Core" | "Stretch";
  minutes: number;
  prompt: string;
  constraints: string[];
  hints: string[];
  rubric: string[];
  roundTypes: InterviewRound["type"][];
};

const DRILLS: InterviewDrill[] = [
  {
    id: "dedupe-window",
    title: "Deduplicate a noisy event stream",
    difficulty: "Core",
    minutes: 25,
    prompt:
      "Design a function that receives events shaped as { id, timestamp, payload }. Return each event only once within a rolling five-minute window, while preserving arrival order. Explain the data structure, cleanup strategy, and complexity before writing pseudocode or code.",
    constraints: [
      "Events may arrive out of timestamp order.",
      "The same ID can legitimately appear again after five minutes.",
      "Traffic can reach 10,000 events per second.",
    ],
    hints: [
      "Separate fast membership checks from expiry ordering.",
      "Be explicit about whether the window uses arrival time or event time.",
      "Consider what happens when an old event arrives late.",
    ],
    rubric: [
      "States assumptions before choosing a structure.",
      "Achieves near O(1) membership checks and bounded cleanup.",
      "Handles late events and memory growth explicitly.",
      "Explains tests and failure cases.",
    ],
    roundTypes: ["technical", "onsite", "final"],
  },
  {
    id: "hot-key-cache",
    title: "Protect a service from a hot cache key",
    difficulty: "Stretch",
    minutes: 35,
    prompt:
      "A read-heavy product becomes unstable when one key suddenly receives 100 times its normal traffic. Design the read path so the system stays available without serving dangerously stale data. Talk through the bottleneck, cache policy, request coalescing, and degraded behavior.",
    constraints: [
      "The backing database cannot absorb the spike.",
      "Most values may be 60 seconds stale; a small subset may not.",
      "The service runs in three regions.",
    ],
    hints: [
      "Start with the request path before naming technologies.",
      "A cache miss stampede is a coordination problem, not only a TTL problem.",
      "Describe observability and a safe fallback.",
    ],
    rubric: [
      "Identifies the first bottleneck and defines success metrics.",
      "Uses layered caching or request coalescing deliberately.",
      "Separates ordinary and freshness-critical data.",
      "Covers regional failure and recovery.",
    ],
    roundTypes: ["system-design", "technical", "onsite", "final"],
  },
  {
    id: "reliable-jobs",
    title: "Make background jobs safe to retry",
    difficulty: "Core",
    minutes: 30,
    prompt:
      "Design a background job that charges no money but sends an important customer notification and updates an audit record. The worker may crash at any point and the queue provides at-least-once delivery. Explain how you prevent duplicates and recover partial work.",
    constraints: [
      "The notification provider has no idempotency key.",
      "Workers can be restarted during deployment.",
      "Operators need to explain what happened after an incident.",
    ],
    hints: [
      "List each side effect and its commit boundary.",
      "Exactly-once execution is not the same as exactly-once effect.",
      "Think about an outbox, dedupe record, and reconciliation path.",
    ],
    rubric: [
      "Names the delivery guarantee and does not promise magic exactly-once execution.",
      "Makes each side effect idempotent or reconcilable.",
      "Defines retry, poison-message, and observability behavior.",
      "Explains the most dangerous crash points.",
    ],
    roundTypes: ["system-design", "technical", "onsite"],
  },
  {
    id: "agent-patch-review",
    title: "Review an unsafe agent-generated patch",
    difficulty: "Core",
    minutes: 20,
    prompt:
      "An AI coding agent fixes a timeout by increasing it from 30 seconds to 10 minutes, adds three broad catch blocks, and removes a failing test. Walk through how you would review the change, what evidence you would request, and the smallest responsible fix you would accept.",
    constraints: [
      "The production incident is active.",
      "You did not write the surrounding service.",
      "A rollback is available but loses queued work.",
    ],
    hints: [
      "Separate incident containment from the durable fix.",
      "Treat deleted tests and swallowed errors as evidence, not style disagreements.",
      "Say what you would measure before and after the change.",
    ],
    rubric: [
      "Rejects unsupported changes without rejecting agent use itself.",
      "Builds an evidence chain from symptom to cause.",
      "Preserves or improves tests and observability.",
      "Balances immediate mitigation with a reversible durable fix.",
    ],
    roundTypes: ["technical", "behavioral", "onsite", "final"],
  },
  {
    id: "ownership-conflict",
    title: "Resolve a high-stakes ownership conflict",
    difficulty: "Warm-up",
    minutes: 15,
    prompt:
      "Tell a concise story about a project where responsibilities were unclear and delivery was at risk. Show how you created clarity without blaming another person, what changed, and what you would do differently now.",
    constraints: [
      "Keep the spoken answer under two minutes.",
      "Use only a story you can defend from your CV or story bank.",
      "Include a measurable or observable result.",
    ],
    hints: [
      "Open with the result, not the chronology.",
      "Name your decision and the tradeoff you accepted.",
      "End with reflection, not a victory lap.",
    ],
    rubric: [
      "Uses a specific, defensible example.",
      "Makes the candidate's action distinct from the team's work.",
      "Shows outcome, judgment, and reflection.",
      "Fits comfortably within two minutes.",
    ],
    roundTypes: ["behavioral", "hiring-manager", "onsite", "final", "screen"],
  },
];

export function drillsForRound(round: InterviewRound): InterviewDrill[] {
  const exact = DRILLS.filter((drill) => drill.roundTypes.includes(round.type));
  if (exact.length >= 3) return exact;

  const fallback = DRILLS.filter((drill) =>
    round.audience === "peer-tech"
      ? drill.roundTypes.includes("technical")
      : drill.roundTypes.includes("behavioral"),
  );
  return [...new Map([...exact, ...fallback].map((drill) => [drill.id, drill])).values()].slice(0, 4);
}
