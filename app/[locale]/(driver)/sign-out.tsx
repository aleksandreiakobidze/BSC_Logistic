"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DriverSignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="iconSm"
      onClick={async () => {
        await signOut({ redirect: false });
        router.push("/login");
      }}
      aria-label="Sign out"
    >
      <LogOut className="h-4 w-4" />
    </Button>
  );
}
