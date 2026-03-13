import Link from "next/link";
import Image from "next/image";
import PropTypes from "prop-types";
import DashboardHeaderActions from "./DashboardHeaderActions";
import { GuestModeProvider } from "../../lib/guest/GuestModeContext";

export default function DashboardLayout({ children }) {
  return (
    <GuestModeProvider>
      <div className="dialora-page-shell text-slate-900">
        {/* Dashboard Header */}
        <header className="sticky top-0 z-20 bg-[#1f232c]/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <Link href="/" className="shrink-0 mx-2 sm:mx-4">
              <div className="header_logo">
                <Image
                  src="/logo-white.svg"
                  alt="Brilworks Logo"
                  width={155}
                  height={46}
                />
              </div>
            </Link>
            <div className="mx-2 sm:mx-4">
              <DashboardHeaderActions />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 md:px-8 py-8">
          {children}
        </main>
      </div>
    </GuestModeProvider>
  );
}

DashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
};
