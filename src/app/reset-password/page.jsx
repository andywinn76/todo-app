export const metadata = {
  robots: { index: false, follow: false },
  title: "Reset Password",
};

import ResetPasswordClient from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}