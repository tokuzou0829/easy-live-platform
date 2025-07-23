"use server";
import BrowserEncoder from "./browseEncoder";
import { getLive } from "@/requests/live";
import { auth } from "@/auth";


export default async function EncoderLayout({ searchParams }: { searchParams: { stream_key: string } }) {
    const stream = await getLive({ id: searchParams.stream_key });
    const session = await auth();

    return (
      <>
        <BrowserEncoder streamTitle={stream.title} id={stream.id} session={session} />
      </>
    );
  }
  