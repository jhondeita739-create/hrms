import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicantReviewWorkspace } from "@/components/applicant-review-workspace";
import { getApplicantReviewData } from "@/lib/recruitment-data";

export const metadata: Metadata = { title: "Applicant review" };

export default async function ApplicantReviewPage({
  params,
}: {
  params: Promise<{ applicantId: string }>;
}) {
  const data = await getApplicantReviewData((await params).applicantId);
  if (!data) notFound();
  return <ApplicantReviewWorkspace initialData={data} />;
}

