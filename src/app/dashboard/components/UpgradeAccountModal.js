"use client";

import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, UserPlus, CheckCircle } from "lucide-react";
import { authService } from "../../../services/authService";
import { useGuestMode } from "../../../lib/guest/GuestModeContext";

export default function UpgradeAccountModal({ isOpen, onClose }) {
  const { deactivateGuestMode } = useGuestMode();
  const [isMounted, setIsMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  if (!isOpen || !isMounted) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsUpgrading(true);

    try {
      await authService.upgradeAnonymousAccount(email.trim(), password);
      deactivateGuestMode();
      setSuccess(true);

      // Auto-close after a short delay
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      }, 2500);
    } catch (err) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleClose = () => {
    if (isUpgrading) return;
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess(false);
    onClose();
  };

  const handleBackdropKeyDown = (e) => {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        onKeyDown={handleBackdropKeyDown}
        aria-label="Close dialog"
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto p-6 md:p-8">
        <button
          onClick={handleClose}
          disabled={isUpgrading}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40"
        >
          <X size={18} />
        </button>

        {success ? (
          <div className="text-center py-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
              <CheckCircle size={28} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Account Created!
            </h2>
            <p className="text-slate-500 text-sm">
              Account created and confirmation sent to {email}. You can now log
              in with your new account. your agents, leads, and conversations
              are already stored in the account.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-sky-400/20">
                <UserPlus size={20} className="text-sky-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Save Your Work
                </h2>
                <p className="text-xs text-slate-500">
                  Your user ID stays the same — all data is already saved.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="upgrade-email"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="upgrade-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                  disabled={isUpgrading}
                  autoComplete="email"
                />
              </div>

              <div>
                <label
                  htmlFor="upgrade-password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Password
                </label>
                <input
                  id="upgrade-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                  disabled={isUpgrading}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label
                  htmlFor="upgrade-confirm-password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Confirm password
                </label>
                <input
                  id="upgrade-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                  disabled={isUpgrading}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={isUpgrading}
                className="w-full dialora-primary-btn py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
              >
                {isUpgrading ? "Creating account…" : "Create Account & Save"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-400">
              All your agents, leads, and conversations are already stored in
              the cloud — this just adds a login.
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

UpgradeAccountModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
