import React, { useEffect } from "react";
import Sidebar from "../layout/Sidebar";
import Topbar from "../layout/Topbar";
import { Outlet } from "react-router-dom";
import { finishCurtain } from "../lib/curtain";

export default function AppShell() {
  useEffect(() => {
    if (sessionStorage.getItem("kz-curtain-after-login") === "1") {
      sessionStorage.removeItem("kz-curtain-after-login");
      requestAnimationFrame(() => finishCurtain());
    }
  }, []);

  return (
    <div className="page-app h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <Topbar />
        <div className="p-4 sm:p-5 overflow-auto grow app-content">
          <div className="w-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
