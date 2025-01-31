import Live from "./Live";
import { getLive } from "@/requests/live";

export const revalidate = 0;

export async function generateMetadata({ params }: { params: { id: string } }) {
  const live = await getLive({ id: params.id });

  return {
    title: live.title,
    description: live.overview,
    keywords: ["ライブ配信"],
    twitter: {
      card: "summary_large_image",
      images: ["https://live-platform.tokuzou.me/api/og?video_id=" + params.id],
    },
    openGraph: {
      title: live.title,
      description: live.overview,
      url: "https://live-platform.tokuzou.me/live/" + params.id,
      siteName: "Live Platform",
      images: {
        url: "https://live-platform.tokuzou.me/api/og?video_id=" + params.id,
        width: 1200,
        height: 630,
      },
    },
  };
}
export default async function LivePage({ params }: { params: { id: string } }) {
  await getLive({ id: params.id });

  return <Live id={params.id} />;
}
