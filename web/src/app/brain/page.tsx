import type { Metadata } from "next";
import { readBrain, type BrainState } from "@/lib/brain";
import { BrainView } from "@/components/brain/brain-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brain · career-ops" };

export default function BrainPage() {
  let initial: BrainState | null = null;
  let error = "";
  try {
    initial = readBrain();
  } catch (e) {
    error = e instanceof Error ? e.message : "Couldn't read your profile.";
  }
  return <BrainView initial={initial} loadError={error} />;
}
