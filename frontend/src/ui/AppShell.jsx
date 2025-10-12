import React, { useEffect } from "react";
import Sidebar from "../layout/Sidebar";
import Topbar from "../layout/Topbar";
import { Outlet, useLocation } from "react-router-dom";
import { finishCurtain } from "../lib/curtain";
import AOS from "aos";
import "aos/dist/aos.css";
import { AnimatePresence, motion } from "framer-motion";

export default function AppShell() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (sessionStorage.getItem("kz-curtain-after-login") === "1") {
      sessionStorage.removeItem("kz-curtain-after-login");
      requestAnimationFrame(() => finishCurtain());
    }
  }, []);

  useEffect(() => {
    AOS.init({ duration: 320, easing: "ease-out", once: true });
  }, []);

  useEffect(() => {
    AOS.refreshHard();
  }, [pathname]);

  return (
    <div className="page-app h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <Topbar />
        <div className="p-4 sm:p-5 overflow-auto grow app-content">
          <div className="w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
