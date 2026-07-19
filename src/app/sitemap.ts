import type { MetadataRoute } from "next";
import { collections } from "@/db/collections";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cetu.vercel.app";

/** Dynamic sitemap: static routes + every college and branch detail page. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [colleges, branches] = await Promise.all([
    collections.colleges().find({ hidden: false }, { projection: { slug: 1 } }).toArray(),
    collections.branches().find({}, { projection: { slug: 1 } }).toArray(),
  ]);
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/colleges`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/branches`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/make-my-list`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/compare`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/discuss`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${base}/spot`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const collegeRoutes: MetadataRoute.Sitemap = colleges.map((c) => ({
    url: `${base}/colleges/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const branchRoutes: MetadataRoute.Sitemap = branches.map((b) => ({
    url: `${base}/branches/${b.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...collegeRoutes, ...branchRoutes];
}
