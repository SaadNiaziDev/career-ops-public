"use client";

// Back-compat: mobile-nav and older imports still expect WorkerPills.
// Desktop progress lives in WorkerSheet (rail badge + side sheet).
export { WorkerTray as WorkerPills } from "@/components/jobs/worker-sheet";
export { pillTone, TONE } from "@/components/jobs/worker-card";
