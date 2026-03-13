"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { UserPlus } from "lucide-react";

/**
 * GuestBanner — displayed at the top of every dashboard page when in guest mode.
 * Provides a visual indicator that data is local-only and a CTA to sign up.
 */
export default function GuestBanner({ onSignUp }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-amber-400 flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">!</span>
        </span>
        <div>
          <p className="text-sm font-semibold text-amber-900">
            You are in guest mode
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Your agents, leads, and conversations are stored locally in this
            browser only. Sign up to save your work permanently to the cloud.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-8 sm:ml-0">
        <button
          type="button"
          onClick={onSignUp}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <UserPlus size={15} />
          Sign Up &amp; Save
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="px-3 py-2 text-amber-700 hover:text-amber-900 text-sm transition-colors"
          aria-label="Dismiss banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

GuestBanner.propTypes = {
  onSignUp: PropTypes.func.isRequired,
};
