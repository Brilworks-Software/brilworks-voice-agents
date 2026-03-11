"use client";
import React, { useState } from "react";

const Sidebar = ({
  industry,
  data,
  onUpdateData,
  onSubmitLead,
  isSubmitting,
}) => {
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState("");

  const isValidCapturedValue = (value) =>
    value !== undefined &&
    value !== null &&
    (typeof value !== "string" || value.trim() !== "");

  const fields = Object.entries(data).filter(([, value]) =>
    isValidCapturedValue(value),
  );
  const isRealEstate = industry.id === "real_estate";

  // Check if all required fields are captured (BANT + Name + Email + Schedule Meeting)
  const requiredFields = [
    "budget",
    "authority",
    "need",
    "timeline",
    "contact_name",
    "email",
    "schedule_meeting_at",
  ];
  const hasAllRequiredFields = requiredFields.every((field) => {
    const fieldKey = Object.keys(data).find(
      (key) => key.toLowerCase() === field.toLowerCase(),
    );
    return fieldKey && data[fieldKey] && String(data[fieldKey]).trim() !== "";
  });

  // Check if already submitted
  const isSubmitted = data["crm_sync"] === "Synced to Google Sheets ✅";

  const filterKeys = ["budget", "bedrooms", "location", "price_range"];
  const filters = fields.filter(([key]) =>
    filterKeys.includes(key.toLowerCase()),
  );

  const crmStatus = data["crm_sync"];
  const leadScore = data["lead_score"];
  const followUp = data["follow_up"];

  const otherData = fields.filter(
    ([key]) =>
      !filterKeys.includes(key.toLowerCase()) &&
      ![
        "crm_sync",
        "lead_score",
        "follow_up",
        "crm_lead_name",
        "last_search",
        "search_status",
      ].includes(key),
  );

  const startEditing = (key, value) => {
    setEditingKey(key);
    setEditValue(String(value));
  };

  const handleSave = () => {
    if (editingKey) {
      onUpdateData(editingKey, editValue);
      setEditingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* CRM Sync Indicator */}
      {isRealEstate && crmStatus && (
        <div
          className={`rounded-2xl p-4 shadow-lg border transition-all duration-500 ${
            crmStatus.includes("Synced")
              ? "bg-green-600 border-green-500 text-white"
              : "bg-amber-500 border-amber-400 text-white animate-pulse"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Brilworks CRM
            </h3>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
              Sheets Sync
            </span>
          </div>
          <p className="text-sm font-medium">{crmStatus}</p>

          {leadScore && (
            <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold opacity-80">
                Lead Score
              </span>
              <span
                className={`text-xs font-black px-2 py-1 rounded ${
                  leadScore === "HOT"
                    ? "bg-red-500"
                    : leadScore === "WARM"
                      ? "bg-orange-500"
                      : "bg-slate-400"
                }`}
              >
                {leadScore}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Property Search Filters (Editable) */}
      {isRealEstate && filters.length > 0 && (
        <div className="bg-blue-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-200/50">
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3 opacity-80">
            Search Filters
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {filters.map(([key, value]) => (
              <div
                key={key}
                className="bg-white/10 rounded-lg p-2 border border-white/10 flex justify-between items-center group"
              >
                <div className="flex-1 overflow-hidden mr-2">
                  <span className="text-[10px] font-bold uppercase opacity-60 block">
                    {key.replace(/_/g, " ")}
                  </span>
                  {editingKey === key ? (
                    <input
                      autoFocus
                      className="bg-white/20 text-xs font-semibold w-full rounded px-1 outline-none"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleSave}
                      onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    />
                  ) : (
                    <span className="text-xs font-semibold truncate">
                      {String(value)}
                    </span>
                  )}
                </div>
                {editingKey !== key && (
                  <button
                    onClick={() => startEditing(key, value)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] bg-white/20 px-1.5 py-0.5 rounded hover:bg-white/40"
                  >
                    Edit
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reference Knowledge (Agent Context Data) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Agent Knowledge Base
          </h3>
          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">
            Reference
          </span>
        </div>
        <div className="p-4 max-h-60 overflow-y-auto space-y-3 custom-scrollbar">
          {industry.inventory && industry.inventory.length > 0 ? (
            industry.inventory.map((item, idx) => (
              <div
                key={idx}
                className="border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <div className="text-xs font-bold text-slate-800">
                  {item.name ||
                    item.item ||
                    item.type ||
                    item.course ||
                    item.category}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  {Object.entries(item).map(
                    ([k, v]) =>
                      k !== "name" &&
                      k !== "item" &&
                      k !== "type" &&
                      k !== "course" &&
                      k !== "category" && (
                        <span
                          key={k}
                          className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded"
                        >
                          <span className="font-semibold">{k}:</span>{" "}
                          {String(v)}
                        </span>
                      ),
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 italic text-center py-4">
              Knowledge loaded in context.
            </p>
          )}
        </div>
      </div>

      {/* Captured Context (Editable) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-y-auto custom-scrollbar">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {isRealEstate ? "Client Profile" : "Captured Context"}
          </h3>
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-3">
            {fields.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-slate-300 text-xl mb-2">📊</div>
                <p className="text-xs text-slate-400">Capturing context...</p>
              </div>
            ) : otherData.length === 0 &&
              !data["last_search"] &&
              !data["search_status"] ? (
              <p className="text-xs text-slate-400 italic">
                Conversational details will appear here.
              </p>
            ) : (
              <>
                {data["search_status"] && (
                  <div className="bg-blue-50 text-blue-700 rounded-lg p-3 text-xs border border-blue-100 font-medium">
                    🔍 {data["search_status"]}
                  </div>
                )}
                {otherData.map(([key, value]) => (
                  <div
                    key={key}
                    className="bg-slate-50 rounded-lg p-3 border border-slate-100 group relative"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        {key.replace(/_/g, " ")}
                      </div>
                      {editingKey !== key && (
                        <button
                          onClick={() => startEditing(key, value)}
                          className="opacity-0 group-hover:opacity-100 text-[9px] font-bold text-blue-600 uppercase"
                        >
                          Update
                        </button>
                      )}
                    </div>

                    {editingKey === key ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          className="bg-white border border-blue-200 text-sm font-medium text-slate-700 w-full rounded px-2 py-1 outline-none shadow-sm"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSave}
                          onKeyDown={(e) => e.key === "Enter" && handleSave()}
                        />
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-slate-700">
                        {String(value)}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Submit Button */}
          {hasAllRequiredFields && !isSubmitted && onSubmitLead && (
            <div className="pt-4 border-t border-slate-200">
              <button
                onClick={onSubmitLead}
                disabled={isSubmitting}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 shadow-lg ${
                  isSubmitting
                    ? "bg-slate-400 text-white cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 active:scale-95"
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  "✓ Submit Requirements"
                )}
              </button>
              <p className="text-[10px] text-slate-500 text-center mt-2">
                Send your information to our specialist team
              </p>
            </div>
          )}

          {/* Missing Fields Indicator */}
          {!hasAllRequiredFields && fields.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-800 mb-2">
                  📋 Required Information
                </p>
                <div className="space-y-1">
                  {requiredFields.map((field) => {
                    const fieldKey = Object.keys(data).find(
                      (key) => key.toLowerCase() === field.toLowerCase(),
                    );
                    const isCaptured =
                      fieldKey &&
                      data[fieldKey] &&
                      String(data[fieldKey]).trim() !== "";
                    return (
                      <div
                        key={field}
                        className="flex items-center gap-2 text-[10px]"
                      >
                        <span
                          className={
                            isCaptured ? "text-green-600" : "text-amber-600"
                          }
                        >
                          {isCaptured ? "✓" : "○"}
                        </span>
                        <span
                          className={
                            isCaptured
                              ? "text-slate-600"
                              : "text-amber-700 font-medium"
                          }
                        >
                          {field
                            .replace("_", " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
