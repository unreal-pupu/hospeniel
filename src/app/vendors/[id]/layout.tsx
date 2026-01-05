import { ReactNode } from "react";

export { generateMetadata } from "./metadata";

export default function VendorLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}

