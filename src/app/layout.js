import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import ConditionalHeader from "@/components/ConditionalHeader";
import { ListsProvider } from "@/components/ListsProvider";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "Lets Doooo It",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/icon-192x192.png" />
      </head>
      <body>
      <div className="mx-auto max-w-[800px] border border-gray-300">
        <Suspense fallback={null}>
          <AuthProvider>
            <ListsProvider>
              <ConditionalHeader />
              {children}
              <Analytics />
              <Toaster
                position="top-center"
                toastOptions={{
                  classNames: {
                    toast:
                      "!text-green-600 !bg-green-50 !border !border-green-300 !text-base !px-6 !py-4 !rounded-xl !shadow-md !font-medium",
                    title: "!font-semibold !text-lg",
                  },
                }}
              />
            </ListsProvider>
          </AuthProvider>
        </Suspense>
        </div>
      </body>
    </html>
  );
}
