"use client";

import Image from "next/image";

const RESPONSIVE_PRESETS = {
  // Small nav/header
  sm: "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12",
  // Default header size
  md: "w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16",
  // Larger header or sidebar
  lg: "w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24",
  // Extra large (e.g., big sections)
  xl: "w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32",
  // Named presets you can use semantically if you like
  header: "w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16",
  hero: "w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48",
};

export default function Logo({
  type = "responsive",        // "responsive" | "static"
  size = "md",                // responsive preset name OR pixel number for static
  className = "",             // extra classes (e.g., margins)
  alt = "Logo",               // accessible alt text
  priority = false,           // pass true for above-the-fold usage
  src = "/letsdoooitlogo.png" // allow override if needed
}) {
  if (type === "static") {
    // Exact pixel square (e.g., <Logo type="static" size={200} />)
    const px = typeof size === "number" ? size : 200;
    return (
      <Image
        src={src}
        alt={alt}
        width={px}
        height={px}
        className={className}
        priority={priority}
      />
    );
  }

  // Responsive preset classes (defaults to "md")
  const preset =
    typeof size === "string" && RESPONSIVE_PRESETS[size]
      ? RESPONSIVE_PRESETS[size]
      : RESPONSIVE_PRESETS.md;

  // Use a sized, relative wrapper + fill for responsive behavior
  return (
    <div className={`relative ${preset} ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 6rem, (min-width: 768px) 4rem, 2.5rem"
        style={{ objectFit: "contain" }}
        priority={priority}
      />
    </div>
  );
}