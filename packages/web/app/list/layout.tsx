import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Reading list",
  description: "ZIPs bookmarked in this browser.",
});

export default function ReadingListLayout({ children }: { children: ReactNode }) {
  return children;
}
