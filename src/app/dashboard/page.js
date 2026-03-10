"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Edit2, Play, Plus, Users, Sparkles } from "lucide-react";
import { authService } from "../../services/authService";
import { customAgentsService } from "../../services/customAgentsService";

export default function DashboardPage() {
  const router = useRouter();
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);

  useEffect(() => {
    const checkAuthAndLoadAgents = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) {
          router.push("/auth/login");
          return;
        }
        setUser(currentUser);
        await loadAgents();
      } catch (error) {
        console.error("Error checking auth:", error);
        router.push("/auth/login");
      }
    };

    checkAuthAndLoadAgents();
  }, [router]);

  const loadAgents = async () => {
    try {
      setIsLoading(true);
      const userAgents = await customAgentsService.getUserAgents();
      setAgents(userAgents);
    } catch (error) {
      console.error("Error loading agents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (agentId) => {
    if (!confirm("Are you sure you want to delete this agent?")) {
      return;
    }

    try {
      setIsDeleting(agentId);
      await customAgentsService.deleteAgent(agentId);
      setAgents(agents.filter((agent) => agent.id !== agentId));
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {cardSkeletons.map((skeleton) => (
          <div
            key={skeleton}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-pulse"
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
      <div className="bg-white rounded-2xl p-10 md:p-12 text-center border-2 border-dashed border-slate-300 shadow-sm">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
          <Sparkles size={22} />
        </div>
        <div className="text-slate-700 mb-3 text-lg font-medium">
          No agents yet. Create your first custom voice agent!
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Set up voice persona, tools, and prompts in a few steps.
        </p>
        <Link
          href="/dashboard/create-agent"
          className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span>Create Agent</span>
        </Link>
      </div>
    );
  } else {
    renderContent = (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-lg transition-shadow"
          >
            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-900">{agent.name}</h3>
              <div className="flex items-center space-x-2 mt-2">
                <span className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium border border-blue-200">
                  {agent.industry}
                </span>
                <span className="inline-block bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-medium border border-slate-200">
                  {agent.language}
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Created {formatDate(agent.created_at)}
            </p>

            <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-200">
              <p className="text-xs font-medium text-slate-600 mb-2">
                Voice Persona
              </p>
              <p className="text-sm text-slate-700">{agent.voice_persona}</p>
            </div>

            <div className="flex items-center space-x-2">
              <Link
                href={`/dashboard/agent/${agent.id}`}
                className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Play size={16} />
                <span>Launch</span>
              </Link>
              <Link
                href={`/dashboard/agents/${agent.id}/edit`}
                className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-transparent hover:border-slate-200"
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            Your Agents
          </h1>
          <p className="text-slate-600 mt-2">Manage your custom voice agents</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            href="/dashboard/leads"
            className="inline-flex items-center justify-center space-x-2 bg-white text-slate-700 px-5 py-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-300 shadow-sm"
          >
            <Users size={20} />
            <span>View Leads</span>
          </Link>
          <Link
            href="/dashboard/create-agent"
            className="inline-flex items-center justify-center space-x-2 bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            <span>Create New Agent</span>
          </Link>
        </div>
      </div>

      {/* Agents Grid */}
      {renderContent}
    </div>
  );
}
