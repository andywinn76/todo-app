// components/ConditionalHeader.jsx
"use client";
import { usePathname } from "next/navigation";
import Header from "@/components/Header";

export default function ConditionalHeader() {
  const pathname = usePathname();
  const hideOn = ["/login", "/reset"];
  if (hideOn.includes(pathname)) return null;

  return (
    <Header />
  );
}
