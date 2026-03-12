"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authService } from "../../services/authService";

export default function DashboardHeaderActions() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      await authService.signOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Error logging out:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <Link
        href="/dashboard"
        className="dialora-secondary-btn text-sm border-sky-400/20"
      >
        Dashboard
      </Link>
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="dialora-secondary-btn text-sm text-red-400 border-red-400/20 disabled:opacity-60"
      >
        {isLoggingOut ? "Logging out..." : "Logout"}
      </button>
    </div>
  );
}
