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
        className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors"
      >
        Dashboard
      </Link>
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="text-sm font-semibold text-slate-600 hover:text-red-600 transition-colors disabled:opacity-60"
      >
        {isLoggingOut ? "Logging out..." : "Logout"}
      </button>
    </div>
  );
}
