import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Space_Grotesk } from "next/font/google";
import { PreferencesProvider, type Theme } from "@/components/preferences";
import { DEFAULT_LANG, LANG_COOKIE, type Lang } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const grotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

// Every surface is authenticated — the shell is dynamic by design.
// Opt out of instant-prerender validation for the whole tree.
export const instant = false;

export const metadata: Metadata = {
  title: "Parley — procurement that negotiates",
  description:
    "An AI procurement agent that finds real products, negotiates with merchant agents, and pays via agentic escrow on PayPal — money only moves when goods arrive.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const store = await cookies();
  const lang = (store.get(LANG_COOKIE)?.value as Lang) || DEFAULT_LANG;
  const theme = (store.get("parley_theme")?.value as Theme) || "system";

  return (
    <html
      lang={lang}
      data-theme={theme}
      suppressHydrationWarning
      className={`${inter.variable} ${grotesk.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            // Resolve "system" before first paint so dark-OS users
            // never see a light flash.
            __html: `try{if(document.documentElement.dataset.theme==="system"){document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <PreferencesProvider initialLang={lang} initialTheme={theme}>
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}
