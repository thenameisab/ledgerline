import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPage } from "@/components/help/DocPage";
import { OpenInApp, RoleChip } from "@/components/help/doc";
import { features } from "@/lib/help/features";

export function generateStaticParams() {
  return features.map((f) => ({ slug: f.meta.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const f = features.find((x) => x.meta.slug === params.slug);
  return { title: f ? f.meta.title : "Feature" };
}

export default function FeaturePage({ params }: { params: { slug: string } }) {
  const feature = features.find((f) => f.meta.slug === params.slug);
  if (!feature) notFound();
  const { meta, Body } = feature;

  return (
    <DocPage
      crumbs={[{ href: "/help/features", label: "Features" }]}
      title={meta.title}
      lede={meta.summary}
      meta={
        <>
          <RoleChip role={meta.role} />
          {meta.routes?.map((r) => (
            <OpenInApp key={r} href={r} label={r} />
          ))}
        </>
      }
    >
      <Body />
    </DocPage>
  );
}
