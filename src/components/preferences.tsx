"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANG,
  LANG_COOKIE,
  translate,
  type I18nKey,
  type Lang,
} from "@/lib/i18n";

export type Theme = "light" | "dark" | "system";
const THEME_COOKIE = "parley_theme";

interface Prefs {
  lang: Lang;
  theme: Theme;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  t: (key: I18nKey, vars?: Record<string, string>) => string;
}

const Ctx = createContext<Prefs | null>(null);

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

function applyThemeAttr(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function PreferencesProvider({
  initialLang,
  initialTheme,
  children,
}: {
  initialLang: Lang;
  initialTheme: Theme;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeCookie(LANG_COOKIE, l);
    document.documentElement.lang = l;
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    writeCookie(THEME_COOKIE, t);
    applyThemeAttr(t);
  }, []);

  // Track OS preference while theme === "system".
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyThemeAttr("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);

  const t = useCallback(
    (key: I18nKey, vars?: Record<string, string>) => translate(lang, key, vars),
    [lang],
  );

  const value = useMemo(
    () => ({ lang, theme, setLang, setTheme, t }),
    [lang, theme, setLang, setTheme, t],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(Ctx);
  // Components rendered outside the provider (e.g. login during prerender)
  // fall back to English so nothing hard-crashes.
  if (!ctx)
    return {
      lang: DEFAULT_LANG,
      theme: "system",
      setLang: () => {},
      setTheme: () => {},
      t: (key, vars) => translate(DEFAULT_LANG, key, vars),
    };
  return ctx;
}
