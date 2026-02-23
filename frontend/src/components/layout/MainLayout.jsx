import React from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function MainLayout({ status, context }) {

  return (
    <div className="flex h-screen w-full flex-col bg-bg text-txt font-body selection:bg-primary/30">
      <Navbar status={status} />
      <div className="flex flex-1 overflow-hidden p-4 lg:p-8 bg-black/20">
        <main className="relative flex-1 overflow-y-auto rounded-3xl border border-white/5 bg-card/40 backdrop-blur-md shadow-2xl flex flex-col h-full">
          <div className="flex-1">
            <Outlet context={context} />
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
