import type { ReactNode } from "react";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
