"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./tab-bar.module.css";

export type AppTab = "log" | "history" | "stats" | "settings";

const TABS: { id: AppTab; href: string; label: string }[] = [
  { id: "log", href: "/", label: "Log" },
  { id: "history", href: "/history", label: "History" },
  { id: "stats", href: "/stats", label: "Stats" },
  { id: "settings", href: "/settings", label: "Settings" },
];

function tabFromPath(pathname: string): AppTab {
  if (pathname.startsWith("/history")) return "history";
  if (pathname.startsWith("/stats")) return "stats";
  if (pathname.startsWith("/settings")) return "settings";
  return "log";
}

export function TabBar({
  active,
  onSelect,
}: {
  active?: AppTab;
  onSelect?: (tab: AppTab) => void;
}) {
  const pathname = usePathname();
  const current: AppTab = active ?? tabFromPath(pathname);

  return (
    <nav className={styles.bar} aria-label="App">
      {TABS.map((tab) => {
        const className = current === tab.id ? styles.active : styles.tab;
        const currentAttr = current === tab.id ? "page" : undefined;
        if (onSelect) {
          return (
            <button
              key={tab.id}
              type="button"
              className={className}
              aria-current={currentAttr}
              onClick={() => onSelect(tab.id)}
            >
              {tab.label}
            </button>
          );
        }
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={className}
            aria-current={currentAttr}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
