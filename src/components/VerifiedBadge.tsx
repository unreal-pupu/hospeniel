"use client";

import { BadgeCheck } from "lucide-react";

interface VerifiedBadgeProps {
  verified?: boolean;
  className?: string;
}

export default function VerifiedBadge({ verified, className }: VerifiedBadgeProps) {
  if (!verified) return null;

  return (
    <BadgeCheck
      className={className || "h-4 w-4 text-blue-600"}
      aria-label="Verified vendor"
    />
  );
}
