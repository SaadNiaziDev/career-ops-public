import { notFound } from "next/navigation";
import { findApplication } from "@/lib/career-ops";
import { loadInterviewBundle } from "@/lib/interview";
import { InterviewWorkspace } from "@/components/interview/interview-workspace";

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const app = findApplication(id);
  if (!app) notFound();

  const bundle = loadInterviewBundle(id);
  if (!bundle) notFound();

  return <InterviewWorkspace id={id} initial={bundle} />;
}
