"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { UserPlus, X } from "lucide-react";

/**
 * GuestBanner — displayed at the top of every dashboard page when in guest mode.
 * Provides a visual indicator that data is local-only and a CTA to sign up.
 */
export default function GuestBanner({ onSignUp }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-r from-[#3a2a16]/90 to-[#2f2418]/90 px-4 py-3.5 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-amber-500/90 flex items-center justify-center text-white">
            <span className="text-[10px] font-bold">!</span>
          </span>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-300 leading-tight">
              You are in guest mode
            </p>
            <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
              Your agents, leads, and conversations are stored locally in this
              browser only. Sign up to save your work permanently to the cloud.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-8 sm:ml-0">
          <button
            type="button"
            onClick={onSignUp}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <UserPlus size={15} />
            Sign Up &amp; Save
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-amber-300/80 hover:text-amber-100 hover:bg-amber-500/10 transition-colors"
            aria-label="Dismiss banner"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

GuestBanner.propTypes = {
  onSignUp: PropTypes.func.isRequired,
};
