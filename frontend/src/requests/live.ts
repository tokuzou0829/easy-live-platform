import * as fetch from "@/utils/fetch";
import { notFound } from "next/navigation";
import type { Live } from "@/types/live";

type getLiveProps = {
  id: string;
};

type Lives = {
  lives: Live[];
};


export async function getOnlineLiveList(): Promise<Lives> {
  return await fetch.get<Lives>(`/streams`);
}

export async function getLive(param: getLiveProps): Promise<Live> {
  try {
    return await fetch.get<Live>(`/streams/${param.id}`, {
      headers: {},
    });
  } catch (e) {
    notFound();
  }
}
