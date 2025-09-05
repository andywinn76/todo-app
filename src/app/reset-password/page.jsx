export const metadata = {
  robots: { index: false, follow: false },
  title: "Reset Password",
};

import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading…</div>}>
      <ResetPasswordClient />
    </Suspense>
  );
}
