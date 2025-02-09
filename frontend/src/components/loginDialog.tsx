"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GithubIcon, LogIn } from "lucide-react";
import { signIn } from "next-auth/react";
import { usePathname } from "next/navigation";

interface LoginDialogProps {
  className?: string;
}

export function LoginDialog({ className }: LoginDialogProps) {
  const pathname = usePathname();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className={className} title="Login">
          <LogIn className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ログインしてライブ配信をより楽しもう！</DialogTitle>
          <DialogDescription className="pt-4 pb-5">
            ログインすることでチャットに自分の名前とアイコンを表示することができるようになります！
          </DialogDescription>
        </DialogHeader>
        <Button 
          variant="default" 
          className="w-full"
          onClick={() => signIn("github-custom", { callbackUrl: pathname })}
        >
        <GithubIcon className="h-4 w-4 mr-2" />
          Githubでログイン
        </Button>
      </DialogContent>
    </Dialog>
  );
}
