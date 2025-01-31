"use client";
import { signIn, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { type Session } from "next-auth";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogIn } from "lucide-react";

type Props = {
  session: Session | null;
};
export default function AccountDropdownMenu(props: Props) {
  const { session } = props;
  const pathname = usePathname();

  return (
    <>
      {session?.user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full mr-[10px]"
              style={{ marginTop: "10px" }}
            >
              <div>
                <Avatar className="h-[36px] w-[36px]">
                  <AvatarImage src={`${session.user.image}`} />
                  <AvatarFallback>{session.user.name}</AvatarFallback>
                </Avatar>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount side="right">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {session.user.name}
                </p>
                <p className="text-muted-foreground text-xs leading-none">
                  {session.user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/" })}
              className="cursor-pointer	"
            >
              サインアウト
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button onClick={() => signIn("github-custom", { callbackUrl: pathname })} className="w-[36px] h-[36px] p-0">
          <LogIn size={14} />
        </Button>
      )}
    </>
  );
}
