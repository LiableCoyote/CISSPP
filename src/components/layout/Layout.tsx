import type { ReactNode } from "react";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Onboarding from "./Onboarding";
import Search from "../Search";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <a href="#main-content" className="sr-only sr-only-focusable">
        Skip to main content
      </a>
      <Onboarding />
      <Search />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
