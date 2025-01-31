"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Nav } from "@/app/(main)/nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePathname } from 'next/navigation';
import { Session } from "next-auth";

export default function LayoutContent({
  children,
  session
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  const pathname = usePathname();
  const firstLocation = pathname.startsWith('/video/') || pathname.startsWith('/live/');
  const [isCollapsed, setIsCollapsed] = useState(firstLocation ? true : false);
  const [isWatch, setIsWatch] = useState(false);
  const panelRef = useRef<any>(null);
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const isPhone = window.innerWidth < 1150;
    setIsPhone(isPhone);
    if(isPhone) {
      setIsCollapsed(true);
      panelRef.current?.collapse();
    }
  }, []);

  useEffect(() => {
    const isLocation = pathname.startsWith('/video/') || pathname.startsWith('/live/');
    if (isLocation) {
      panelRef.current?.collapse();
      setIsCollapsed(true);
      setIsWatch(true);
    }else{
      setIsWatch(false);
    }
    if(pathname === '/' && window.innerWidth > 1150) {
      panelRef.current?.expand();
      setIsCollapsed(false);
    }
  }, [pathname]);

  return (
      <TooltipProvider delayDuration={0}>
        <ResizablePanelGroup
          onLayout={(sizes: number[]) => {
            document.cookie = `react-resizable-panels:layout=${JSON.stringify(
              sizes
            )}`;
          }}
          direction="horizontal"
          className="items-stretch"
        >
          {!((isWatch) && isPhone) ? (
            <>
              <ResizablePanel
                defaultSize={firstLocation? 4 : 15}
                collapsedSize={4}
                ref={panelRef}
                collapsible={true}
                minSize={!isPhone ? 15 : 4}
                maxSize={!isPhone ? 15 : 4}
                onCollapse={() => {
                  setIsCollapsed(true);
                  document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
                    true
                  )}`;
                }}
                onExpand={() => {
                  setIsCollapsed(false);
                  document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
                    false
                  )}`;
                }}
                className={cn(
                  "bg-white sticky top-[0px] z-20",
                  isCollapsed &&
                    "min-w-[50px] transition-all duration-300 ease-in-out"
                )}
              >
              <Nav
                isCollapsed={isCollapsed}
                session={session}
                links={[
                ]}
              />
              </ResizablePanel>
              <ResizableHandle withHandle={!isPhone ? true : false} />
            </>
          ):(
            <></>
          )}
          <ResizablePanel defaultSize={85}>{children}</ResizablePanel>
        </ResizablePanelGroup>
      </TooltipProvider>
    );
}
