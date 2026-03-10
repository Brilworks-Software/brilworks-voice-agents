"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Users,
  TrendingUp,
  Mail,
  Phone,
  Calendar,
} from "lucide-react";
import { authService } from "../../../services/authService";

export default function LeadsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) {
          router.push("/auth/login");
          return;
        }
        setUser(currentUser);

        // Fetch lead statistics
        const statsResponse = await fetch("/api/leads/stats");
        if (statsResponse.ok) {
          const data = await statsResponse.json();
          setStats(data.stats);
          setRecentLeads(data.recentLeads || []);
        }

        // Fetch agents to allow filtering
        const agentsResponse = await fetch("/api/agents");
        if (agentsResponse.ok) {
          const agentsData = await agentsResponse.json();
          setAgents(agentsData.agents || []);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  const loadLeadsForAgent = async (agentId) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/leads`);
      if (response.ok) {
        const data = await response.json();
        setRecentLeads(data.leads || []);
        setSelectedAgent(agentId);
      }
    } catch (error) {
      console.error("Error loading agent leads:", error);
    }
  };

  const getLeadScoreBadge = (score) => {
    const colors = {
      HOT: "bg-red-100 text-red-700 border-red-200",
      WARM: "bg-orange-100 text-orange-700 border-orange-200",
      COLD: "bg-blue-100 text-blue-700 border-blue-200",
    };
    return colors[score] || "bg-slate-100 text-slate-700 border-slate-200";
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-7 shadow-sm ring-1 ring-slate-100">
        <Link
          href="/dashboard"
          className="inline-flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-3 w-fit text-sm font-medium"
        >
          <ChevronLeft size={18} />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Lead Management</h1>
        <p className="text-slate-600 mt-1">
          Track and manage all captured leads from your voice agents
        </p>
      </div>

      <div className="space-y-6">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Leads</p>
                  <p className="text-xl font-bold text-slate-900">
                    {stats.total}
                  </p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Hot Leads</p>
                  <p className="text-xl font-bold text-red-600">{stats.hot}</p>
                </div>
                <div className="bg-red-100 rounded-full p-3">
                  <TrendingUp className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Warm Leads</p>
                  <p className="text-xl font-bold text-orange-600">
                    {stats.warm}
                  </p>
                </div>
                <div className="bg-orange-100 rounded-full p-3">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Cold Leads</p>
                  <p className="text-xl font-bold text-blue-600">
                    {stats.cold}
                  </p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Agent Filter */}
        {agents.length > 0 && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm ring-1 ring-slate-100 mb-6">
            <h2 className="text-md font-semibold text-slate-900 mb-4">
              Filter by Agent
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSelectedAgent(null);
                  // Reload all leads
                  fetch("/api/leads/stats")
                    .then((res) => res.json())
                    .then((data) => setRecentLeads(data.recentLeads || []));
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedAgent === null
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                All Agents
              </button>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => loadLeadsForAgent(agent.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedAgent === agent.id
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {agent.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Leads Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm ring-1 ring-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Leads
            </h2>
          </div>

          {recentLeads.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No leads captured yet</p>
              <p className="text-sm text-slate-500 mt-1">
                Leads will appear here after customers interact with your agents
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Lead Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      BANT
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Meeting
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Captured At
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {recentLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">
                          {lead.lead_name || "Anonymous"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {lead.email && (
                            <div className="flex items-center text-sm text-slate-600">
                              <Mail className="w-3 h-3 mr-1" />
                              {lead.email}
                            </div>
                          )}
                          {lead.phone && (
                            <div className="flex items-center text-sm text-slate-600">
                              <Phone className="w-3 h-3 mr-1" />
                              {lead.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {lead.lead_score && (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold border ${getLeadScoreBadge(lead.lead_score)}`}
                          >
                            {lead.lead_score}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs space-y-1">
                          {lead.budget && (
                            <div>
                              <span className="font-semibold">B:</span>{" "}
                              {lead.budget}
                            </div>
                          )}
                          {lead.timeline && (
                            <div>
                              <span className="font-semibold">T:</span>{" "}
                              {lead.timeline}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {lead.schedule_meeting_at && (
                          <div className="flex items-center text-sm text-slate-600">
                            <Calendar className="w-3 h-3 mr-1" />
                            {lead.schedule_meeting_at}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {formatDate(lead.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
