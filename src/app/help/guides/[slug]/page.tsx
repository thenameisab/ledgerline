import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPage } from "@/components/help/DocPage";
import { RoleChip } from "@/components/help/doc";
import { Clock } from "lucide-react";
import { guides } from "@/lib/help/guides";

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.meta.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const g = guides.find((x) => x.meta.slug === params.slug);
  return { title: g ? g.meta.title : "Guide" };
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = guides.find((g) => g.meta.slug === params.slug);
  if (!guide) notFound();
  const { meta, Body } = guide;

  return (
    <DocPage
      crumbs={[{ href: "/help/guides", label: "How-to guides" }]}
      title={meta.title}
      lede={meta.summary}
      meta={
        <>
          <RoleChip role={meta.role} />
          {meta.minutes != null && (
            <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
              <Clock size={11} aria-hidden /> ~{meta.minutes} min
            </span>
          )}
        </>
      }
    >
      <Body />
    </DocPage>
  );
}
