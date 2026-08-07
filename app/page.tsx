import HomeClient from "@/components/HomeClient";

// Data is fetched live from Notion on every load; a statically prerendered
// shell would get cached at the edge for up to a year (s-maxage), so deploys
// would silently not show up without a manual cache-busting reload.
export const dynamic = "force-dynamic";

export default function Page() {
  return <HomeClient />;
}
