import "../globals.css";
import type { Metadata } from "next";
import { auth } from "@/auth";
import LayoutContent from "./layout-content";

export const revalidate = 0;

export const metadata: Metadata = {
  title: {
    template: "%s | Live Platform",
    absolute: "Live Platform",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost"),
  description: "誰でもすぐにライブ配信を",
  robots: {
    index: false,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session] = await Promise.all([
    auth(),
  ]);

  return (
    <div className="h-full">
      <LayoutContent session={session} >{children}</LayoutContent>
    </div>
  );
}
