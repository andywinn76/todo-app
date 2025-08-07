import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import ConditionalHeader from "@/components/ConditionalHeader";
import { Toaster } from "sonner";

export const metadata = {
  title: "ToDo App",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
        <ConditionalHeader />
          {children}
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
        </AuthProvider>
      </body>
    </html>
  );
}
