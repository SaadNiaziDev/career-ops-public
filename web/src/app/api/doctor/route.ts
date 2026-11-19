import { doctorState, ensureOnboardingTemplates } from "@/lib/career-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Setup check: copies starter files when missing and reports what is still needed.
export async function GET() {
  ensureOnboardingTemplates();
  const { onboardingNeeded, missing } = doctorState();
  return Response.json({ available: true, onboardingNeeded, missing, warnings: [] });
}
