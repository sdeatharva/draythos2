"use client";

import { useState, useEffect, useCallback } from "react";

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("draythos_theme") as Theme | null;
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
        if (saved === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      } else {
        // Default to light theme matching the warm paper palette
        setTheme("light");
        document.documentElement.classList.remove("dark");
        localStorage.setItem("draythos_theme", "light");
      }
    } catch { }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("draythos_theme", next);
        if (next === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      } catch { }
      return next;
    });
  }, []);

  const setSpecificTheme = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem("draythos_theme", newTheme);
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch { }
  }, []);

  return {
    theme,
    isDark: theme === "dark",
    toggleTheme,
    setTheme: setSpecificTheme,
  };
}
