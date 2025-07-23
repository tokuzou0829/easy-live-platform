import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getLive } from "@/requests/live";

export const runtime = "edge";
export const revalidate = 0;

export async function GET(req: NextRequest): Promise<Response | ImageResponse> {
  const { searchParams } = new URL(req.url);
  const video_id = searchParams.get("video_id");

  if (video_id) {
    const live = await getLive({ id: video_id });

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            background: "#fff",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "250px",
            position: "relative",
          }}
        >
          <img
            style={{ height: "100%", width: "100%", objectFit: "cover" }}
            src={live.status == "online" ? `${process.env.NEXT_PUBLIC_THUMBNAIL_URL}?id=${live.stream_key}` : `${process.env.NEXT_PUBLIC_BASE_URL}/no_image_logo.png`}
          />
        </div>
      ),
      {
        width: 1200,
        height: 630,
        emoji: "fluent",
      }
    );
  } else {
    return new Response(`Failed to generate the image`, {
      status: 400,
    });
  }
}
