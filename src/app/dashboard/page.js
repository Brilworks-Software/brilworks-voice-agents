"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Edit2, Play, Plus, Users, Sparkles } from "lucide-react";
import { authService } from "../../services/authService";
import { customAgentsService } from "../../services/customAgentsService";
import { useGuestMode } from "../../lib/guest/GuestModeContext";
import GuestBanner from "./components/GuestBanner";
import UpgradeAccountModal from "./components/UpgradeAccountModal";

const accentByIndustry = {
  healthcare: {
    card: "border-emerald-400/30 hover:border-emerald-400",
    chip: "dialora-chip-emerald",
  },
  finance: {
    card: "border-amber-400/30 hover:border-amber-400",
    chip: "dialora-chip-amber",
  },
  banking: {
    card: "border-amber-400/30 hover:border-amber-400",
    chip: "dialora-chip-amber",
  },
  real: {
    card: "border-sky-400/30 hover:border-sky-400",
    chip: "dialora-chip-blue",
  },
  beauty: {
    card: "border-pink-400/30 hover:border-pink-400",
    chip: "dialora-chip-pink",
  },
  retail: {
    card: "border-cyan-400/30 hover:border-cyan-400",
    chip: "dialora-chip-cyan",
  },
  legal: {
    card: "border-violet-400/30 hover:border-violet-400",
    chip: "dialora-chip-violet",
  },
};

const getAccent = (industry = "") => {
  const normalized = String(industry).toLowerCase();
  return (
    Object.entries(accentByIndustry).find(([key]) =>
      normalized.includes(key),
    )?.[1] || {
      card: "border-sky-400/30 hover:border-sky-400",
      chip: "dialora-chip-blue",
    }
  );
};

export default function DashboardPage() {
  const router = useRouter();
  const { isGuest } = useGuestMode();
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);
  const [showMigrateModal, setShowMigrateModal] = useState(false);

  useEffect(() => {
    const checkAuthAndLoadAgents = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) {
          router.push("/auth/login");
          return;
        }

        setUser(currentUser);
        setAgents(await customAgentsService.getUserAgents());
      } catch (error) {
        console.error("Error checking auth:", error);
        if (!isGuest) {
          router.push("/auth/login");
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndLoadAgents();
  }, [router, isGuest]);

  const handleDelete = async (agentId) => {
    if (!confirm("Are you sure you want to delete this agent?")) {
      return;
    }

    try {
      setIsDeleting(agentId);

      await customAgentsService.deleteAgent(agentId);

      setAgents((prev) => prev.filter((agent) => agent.id !== agentId));
    } catch (error) {
      console.error("Error deleting agent:", error);
      alert("Failed to delete agent");
    } finally {
      setIsDeleting(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const cardSkeletons = Array.from({ length: 6 }, (_, index) => index);

  let renderContent;

  if (isLoading) {
    renderContent = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cardSkeletons.map((skeleton) => (
          <div
            key={skeleton}
            className="dialora-panel rounded-2xl p-6 animate-pulse"
          >
            <div className="h-6 w-40 bg-slate-200 rounded mb-4" />
            <div className="flex gap-2 mb-4">
              <div className="h-6 w-24 bg-slate-200 rounded-full" />
              <div className="h-6 w-20 bg-slate-200 rounded-full" />
            </div>
            <div className="h-4 w-32 bg-slate-200 rounded mb-4" />
            <div className="bg-slate-100 rounded-xl p-4 mb-4">
              <div className="h-3 w-24 bg-slate-200 rounded mb-2" />
              <div className="h-4 w-32 bg-slate-200 rounded" />
            </div>
            <div className="h-10 w-full bg-slate-200 rounded-xl" />
          </div>
        ))}
      </div>
    );
  } else if (agents.length === 0) {
    renderContent = (
      <div className="dialora-panel rounded-2xl p-10 md:p-12 text-center border-2 border-dashed border-slate-300">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-gradient-to-br from-sky-500/20 to-violet-500/20 text-blue-600 flex items-center justify-center border border-sky-400/20">
          <Sparkles size={22} />
        </div>
        <div className="text-slate-700 mb-3 text-md font-medium">
          No agents yet. Create your first custom voice agent!
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Set up voice persona, tools, and prompts in a few steps.
        </p>
        <Link
          href="/dashboard/create-agent"
          className="dialora-primary-btn inline-flex items-center space-x-2 px-6 py-3 rounded-xl"
        >
          <Plus size={20} />
          <span>Create Agent</span>
        </Link>
      </div>
    );
  } else {
    renderContent = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`dialora-panel dialora-glow-card rounded-2xl p-6 transition-all flex flex-col h-full hover:-translate-y-1 ${getAccent(agent.industry).card}`}
          >
            <div className="mb-4">
              <h3 className="text-md font-bold text-slate-900">{agent.name}</h3>
              <div className="flex items-center space-x-2 mt-2">
                <span
                  className={`dialora-chip ${getAccent(agent.industry).chip}`}
                >
                  {agent.industry}
                </span>
                <span className="dialora-chip">{agent.language}</span>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Created {formatDate(agent.created_at)}
            </p>

            <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-2">
                Voice Persona
              </p>
              <p className="text-sm text-slate-800">{agent.voice_persona}</p>
            </div>

            <div className="flex items-center space-x-2 mt-auto">
              <Link
                href={`/dashboard/agent/${agent.id}`}
                className="flex-1 dialora-primary-btn flex items-center justify-center space-x-2 py-2.5 rounded-xl text-sm font-medium"
              >
                <Play size={16} />
                <span>Launch</span>
              </Link>
              <Link
                href={`/dashboard/agents/${agent.id}/edit`}
                className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                title="Edit agent"
              >
                <Edit2 size={18} />
              </Link>
              <button
                onClick={() => handleDelete(agent.id)}
                disabled={isDeleting === agent.id}
                className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 border border-transparent hover:border-red-200"
                title="Delete agent"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isGuest && <GuestBanner onSignUp={() => setShowMigrateModal(true)} />}

      <div className="dialora-panel rounded-2xl p-6 md:p-7">
        <h1 className="text-xl font-bold text-slate-800">Your Agents</h1>
        <p className="text-slate-500 mt-2">
          {isGuest
            ? "Manage your guest agents"
            : "Manage your custom voice agents"}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-end gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            href="/dashboard/leads"
            className="dialora-secondary-btn inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl"
          >
            <Users size={20} />
            <span>View Leads</span>
          </Link>
          <Link
            href="/dashboard/create-agent"
            className="dialora-primary-btn inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl"
          >
            <Plus size={20} />
            <span>Create New Agent</span>
          </Link>
        </div>
      </div>

      {renderContent}

      <UpgradeAccountModal
        isOpen={showMigrateModal}
        onClose={() => setShowMigrateModal(false)}
      />
    </div>
  );
}
