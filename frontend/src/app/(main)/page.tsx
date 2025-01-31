import TopLive from "./toplive";
import { getOnlineLiveList } from "@/requests/live";

export const revalidate = 0;

export default async function Home() {
  const lives = await getOnlineLiveList();

  return (
    <div className="h-full w-full">
        <>
          <TopLive lives={lives.lives}></TopLive>
        </>
    </div>
  );
}
