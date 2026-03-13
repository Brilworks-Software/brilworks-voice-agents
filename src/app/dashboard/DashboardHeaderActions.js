"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authService } from "../../services/authService";
import { useGuestMode } from "../../lib/guest/GuestModeContext";
import UpgradeAccountModal from "./components/UpgradeAccountModal";

export default function DashboardHeaderActions() {
  const router = useRouter();
  const { isGuest } = useGuestMode();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showMigrateModal, setShowMigrateModal] = useState(false);

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

  if (isGuest) {
    return (
      <>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-semibold">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-amber-400"
            />
            <span>Guest Mode</span>
          </span>
          <button
            onClick={() => setShowMigrateModal(true)}
            className="dialora-secondary-btn text-sm text-amber-300 border-amber-400/30 hover:bg-amber-500/10"
          >
            Sign Up &amp; Save
          </button>
        </div>
        <UpgradeAccountModal
          isOpen={showMigrateModal}
          onClose={() => setShowMigrateModal(false)}
        />
      </>
    );
  }

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
