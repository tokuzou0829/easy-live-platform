import { FC } from "react";

import { Gavatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type Props = {
  avatarDataList: {
    image: string;
    name: string;
  }[];
  max?: number | undefined;
};

export const AvatarGroup: FC<Props> = ({ avatarDataList, max }) => {
  const avatarDataListWithinMax =
    max !== undefined ? avatarDataList.slice(0, max) : avatarDataList;
  const excess = max !== undefined ? avatarDataList.length - max : 0;

  const reversetDataList = [...avatarDataListWithinMax].reverse();

  return (
    <div className="flex space-x-reverse -space-x-2 flex-row-reverse justify-end">
      {excess > 0 && (
        <Gavatar>
          <AvatarFallback> {`+${excess}`}</AvatarFallback>
        </Gavatar>
      )}
      {reversetDataList.map((user, i) => (
        <Gavatar key={i} >
          <AvatarImage src={user.image} alt={user.name} />
          <AvatarFallback>{(user.name)}</AvatarFallback>
        </Gavatar>
      ))}
    </div>
  );
};
