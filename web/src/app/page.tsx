import { redirect } from "next/navigation";
import { doctorState, ensureOnboardingTemplates } from "@/lib/career-ops";
import { beginOnboarding } from "@/lib/onboarding/readiness";
import { FirstRunHome } from "@/components/home/first-run-home";

export const dynamic = "force-dynamic";
export default function Home() {
  ensureOnboardingTemplates();
  const state = doctorState();
  if (!state.hasCv && !state.verificationPending) beginOnboarding();
  if (doctorState().phase === "first-run") return <FirstRunHome hasCv={state.hasCv} />;
  redirect("/explore");
}
