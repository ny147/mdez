import type { Metadata } from "next";

import { PublicSharedPage } from "@/components/mdez/PublicSharedPage";

export const metadata: Metadata = {
  title: "Shared page · Mdez",
  robots: { index: false, follow: false }
};

export default async function SharePage({
  params
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return <PublicSharedPage publicId={publicId} />;
}
