import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FORMS, getForm } from "@/lib/forms";
import { InspectionForm } from "@/components/InspectionForm";
import { SiteHeader } from "@/components/SiteHeader";

export function generateStaticParams() {
  return FORMS.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const form = getForm(slug);
  if (!form) return { title: "Formulir tidak ditemukan" };
  return { title: form.title, description: form.description };
}

export default async function FormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = getForm(slug);
  if (!form) notFound();

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main>
        <InspectionForm form={form} />
      </main>
    </div>
  );
}
