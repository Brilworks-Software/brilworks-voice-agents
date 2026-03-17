"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { authService } from "../../../../../services/authService";
import { customAgentsService } from "../../../../../services/customAgentsService";
import { useGuestMode } from "../../../../../lib/guest/GuestModeContext";
import GuestBanner from "../../../components/GuestBanner";
import UpgradeAccountModal from "../../../components/UpgradeAccountModal";
import { LANGUAGES } from "../../../../components/VoiceAgents/constants";
import {
  formatBytes,
  KNOWLEDGE_UPLOAD_LIMITS,
  validateKnowledgeFiles,
} from "@/lib/knowledgeUploadLimits";

const VOICE_PERSONAS = [
  "Professional",
  "Friendly",
  "Sales Expert",
  "Customer Support",
  "Consultant",
];

const INDUSTRIES = [
  "Healthcare",
  "Finance",
  "Real Estate",
  "Education",
  "Retail",
  "Technology",
  "Hospitality",
  "Legal",
  "Manufacturing",
  "Other",
];

export default function EditAgentPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id;
  const { isGuest } = useGuestMode();
  const knowledgeFileInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [knowledgeFiles, setKnowledgeFiles] = useState([]);
  const [isDraggingKnowledgeFiles, setIsDraggingKnowledgeFiles] =
    useState(false);
  const [existingKnowledgeDocs, setExistingKnowledgeDocs] = useState([]);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [knowledgeProgress] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    industry: "",
    voice_persona: "",
    system_prompt: "",
    language: "en-US",
    tools_enabled: {
      capture_information: true,
      log_to_crm: true,
    },
    require_customer_info: false,
    collect_bant_info: false,
    custom_fields: [],
  });

  useEffect(() => {
    const checkAuthAndLoadAgent = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) {
          router.push("/auth/login");
          return;
        }
        setUser(currentUser);

        const agent = await customAgentsService.getAgentById(agentId);
        if (!agent) {
          router.push("/dashboard");
          return;
        }

        // Load custom fields from API
        let customFields = [];
        try {
          const session = await authService.getSession();
          if (session?.access_token) {
            const response = await fetch(
              `/api/agents/${agentId}/custom-fields`,
              {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              },
            );
            if (response.ok) {
              const data = await response.json();
              customFields = data.customFields || [];
            }
          }
        } catch (err) {
          console.error("Failed to load custom fields:", err);
        }

        try {
          const docs = await customAgentsService.getKnowledgeDocuments(agentId);
          setExistingKnowledgeDocs(docs);
        } catch (err) {
          console.error("Failed to load knowledge documents:", err);
        }

        setFormData({
          name: agent.name,
          industry: agent.industry,
          voice_persona: agent.voice_persona,
          system_prompt: agent.system_prompt,
          language: agent.language,
          tools_enabled: agent.tools_enabled || {
            capture_information: true,
            log_to_crm: true,
          },
          require_customer_info: agent.require_customer_info || false,
          collect_bant_info: agent.collect_bant_info || false,
          custom_fields: customFields,
        });
      } catch (error) {
        console.error("Error loading agent:", error);
        router.push("/dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndLoadAgent();
  }, [agentId, router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleToolToggle = (toolName) => {
    setFormData((prev) => ({
      ...prev,
      tools_enabled: {
        ...prev.tools_enabled,
        [toolName]: !prev.tools_enabled[toolName],
      },
    }));
  };

  const handleRequireCustomerInfoToggle = () => {
    setFormData((prev) => ({
      ...prev,
      require_customer_info: !prev.require_customer_info,
    }));
  };

  const handleCollectBantInfoToggle = () => {
    setFormData((prev) => ({
      ...prev,
      collect_bant_info: !prev.collect_bant_info,
    }));
  };

  const handleAddCustomField = () => {
    setFormData((prev) => ({
      ...prev,
      custom_fields: [
        ...prev.custom_fields,
        {
          field_name: "",
          field_description: "",
          field_type: "text",
          is_required: false,
        },
      ],
    }));
  };

  const handleRemoveCustomField = (index) => {
    setFormData((prev) => ({
      ...prev,
      custom_fields: prev.custom_fields.filter((_, i) => i !== index),
    }));
  };

  const handleCustomFieldChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      custom_fields: prev.custom_fields.map((f, i) =>
        i === index ? { ...f, [field]: value } : f,
      ),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.name.trim()) {
      setError("Agent name is required");
      return;
    }
    if (!formData.industry) {
      setError("Industry is required");
      return;
    }
    if (!formData.voice_persona) {
      setError("Voice persona is required");
      return;
    }
    if (!formData.system_prompt.trim()) {
      setError("System prompt is required");
      return;
    }

    // Validate custom fields
    for (let i = 0; i < formData.custom_fields.length; i++) {
      const field = formData.custom_fields[i];
      if (!field.field_name.trim()) {
        setError(`Custom field ${i + 1} name is required`);
        return;
      }
    }

    setIsSaving(true);

    try {
      await customAgentsService.updateAgent(agentId, formData);

      if (formData.custom_fields.length > 0) {
        try {
          const session = await authService.getSession();
          if (!session?.access_token) {
            throw new Error("User session is not available");
          }
          await fetch(`/api/agents/${agentId}/custom-fields`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ customFields: formData.custom_fields }),
          });
        } catch (err) {
          console.error("Failed to save custom fields:", err);
        }
      }

      if (knowledgeFiles.length > 0) {
        await customAgentsService.uploadKnowledgeFiles(agentId, knowledgeFiles);
      }

      router.push("/dashboard?success=Agent updated successfully");
    } catch (err) {
      setError(err.message || "Failed to update agent");
    } finally {
      setIsSaving(false);
    }
  };

  const updateKnowledgeFiles = (files) => {
    const { isValid, errors, acceptedFiles } = validateKnowledgeFiles(files);

    if (!isValid) {
      setError(errors[0] || "Invalid knowledge files");
      setKnowledgeFiles([]);
      return;
    }

    setError("");
    setKnowledgeFiles(acceptedFiles);
  };

  const handleKnowledgeFilesChange = (e) => {
    updateKnowledgeFiles(e.target.files);
  };

  const handleKnowledgeFilesDragOver = (e) => {
    e.preventDefault();
    setIsDraggingKnowledgeFiles(true);
  };

  const handleKnowledgeFilesDragLeave = (e) => {
    e.preventDefault();
    setIsDraggingKnowledgeFiles(false);
  };

  const handleKnowledgeFilesDrop = (e) => {
    e.preventDefault();
    setIsDraggingKnowledgeFiles(false);
    updateKnowledgeFiles(e.dataTransfer.files);
  };

  const openKnowledgeFilePicker = () => {
    knowledgeFileInputRef.current?.click();
  };

  if (isLoading || !user) {
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
    <div className="max-w-5xl mx-auto space-y-6">
      {isGuest && <GuestBanner onSignUp={() => setShowMigrateModal(true)} />}

      {/* Header */}
      <div className="dialora-panel rounded-2xl p-6 md:p-7">
        <Link
          href="/dashboard"
          className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-4 text-sm font-medium"
        >
          <ChevronLeft size={20} />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="text-xl md:text-xl font-bold text-slate-900">
          Edit Agent
        </h1>
        <p className="text-slate-600 mt-2">Update your custom voice agent</p>
      </div>

      {/* Form */}
      <div className="dialora-panel rounded-2xl p-6 md:p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {knowledgeProgress && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
            {knowledgeProgress}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-9">
          {/* Agent Identity Section */}
          <div className="border-b border-slate-200 pb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Agent Identity
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Agent Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Sales Assistant, Support Bot"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Industry *
                </label>
                <select
                  name="industry"
                  value={formData.industry}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select an industry</option>
                  {INDUSTRIES.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Voice Persona *
                </label>
                <select
                  name="voice_persona"
                  value={formData.voice_persona}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a persona</option>
                  {VOICE_PERSONAS.map((persona) => (
                    <option key={persona} value={persona}>
                      {persona}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Language
                </label>
                <select
                  name="language"
                  value={formData.language}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* System Prompt Section */}
          <div className="border-b border-slate-200 pb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Conversation Behavior
            </h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                System Prompt *
              </label>
              <p className="text-sm text-slate-600 mb-3">
                Define how your agent should behave and respond to users
              </p>
              <textarea
                name="system_prompt"
                value={formData.system_prompt}
                onChange={handleInputChange}
                placeholder="Example: You are a helpful AI assistant for a fitness coaching business. You help users with workout recommendations, nutrition advice, and scheduling sessions."
                rows={6}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
          </div>

          {/* Tools Section */}
          <div className="border-b border-slate-200 pb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Tools & Features
            </h2>

            <p className="text-sm text-slate-600 mb-4">
              Enable tools to capture information and integrate with systems
            </p>

            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.tools_enabled.capture_information}
                  onChange={() => handleToolToggle("capture_information")}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                />
                <div>
                  <span className="text-slate-700 font-medium">
                    Capture Information
                  </span>
                  <p className="text-xs text-slate-600">
                    Extract and save user information from conversations
                  </p>
                </div>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.tools_enabled.log_to_crm}
                  onChange={() => handleToolToggle("log_to_crm")}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                />
                <div>
                  <span className="text-slate-700 font-medium">Log to CRM</span>
                  <p className="text-xs text-slate-600">
                    Automatically log interactions to your CRM system
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Customer Information Toggle */}
          <div className="border-b border-slate-200 pb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Customer Information Collection
            </h2>

            <p className="text-sm text-slate-600 mb-4">
              Configure what customer information is required
            </p>

            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.require_customer_info}
                  onChange={handleRequireCustomerInfoToggle}
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-slate-700 font-semibold">
                    Require Customer Name & Email
                  </span>
                  <p className="text-xs text-slate-600 mt-1">
                    When enabled, the agent will ask for and require the
                    customer's name and email address during conversations.
                    These fields will be marked as required in the capture tool.
                  </p>
                </div>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.collect_bant_info}
                  onChange={handleCollectBantInfoToggle}
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-slate-700 font-semibold">
                    Collect BANT Information
                  </span>
                  <p className="text-xs text-slate-600 mt-1">
                    When enabled, the agent will capture Budget, Authority,
                    Need, Timeline, and meeting schedule fields during the
                    conversation. These will be included in the capture and CRM
                    sync tools as required fields.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Custom Fields Section */}
          <div className="border-b border-slate-200 pb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Custom Fields
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Define specific information fields you want to capture from
                  customers
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddCustomField}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
              >
                + Add Field
              </button>
            </div>

            {formData.custom_fields.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                <p className="text-slate-500 text-sm">
                  No custom fields defined yet. Click "Add Field" to create one.
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  Standard fields (Budget, Authority, Need, Timeline) are always
                  available
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.custom_fields.map((field, index) => (
                  <div
                    key={index}
                    className="p-4 border border-slate-200 rounded-lg space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">
                        Custom Field {index + 1}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(index)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Field Name *
                        </label>
                        <input
                          type="text"
                          value={field.field_name}
                          onChange={(e) =>
                            handleCustomFieldChange(
                              index,
                              "field_name",
                              e.target.value,
                            )
                          }
                          placeholder="e.g., company_size, industry_type"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Field Type
                        </label>
                        <select
                          value={field.field_type}
                          onChange={(e) =>
                            handleCustomFieldChange(
                              index,
                              "field_type",
                              e.target.value,
                            )
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="text">Text</option>
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={field.field_description}
                          onChange={(e) =>
                            handleCustomFieldChange(
                              index,
                              "field_description",
                              e.target.value,
                            )
                          }
                          placeholder="What information should be captured?"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.is_required}
                            onChange={(e) =>
                              handleCustomFieldChange(
                                index,
                                "is_required",
                                e.target.checked,
                              )
                            }
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                          />
                          <span className="text-xs font-medium text-slate-700">
                            This field is required
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Knowledge Base Section */}
          <div className="border-b border-slate-200 pb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Knowledge Base
            </h2>

            <p className="text-sm text-slate-600 mb-4">
              Upload additional PDF files for this agent knowledge base.
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Limits: up to {KNOWLEDGE_UPLOAD_LIMITS.maxFilesPerRequest} PDFs
              per upload, max{" "}
              {formatBytes(KNOWLEDGE_UPLOAD_LIMITS.maxFileSizeBytes)} per PDF.
            </p>

            {existingKnowledgeDocs.length > 0 && (
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs font-medium text-slate-700 mb-1">
                  Existing PDFs ({existingKnowledgeDocs.length})
                </p>
                <ul className="text-xs text-slate-600 space-y-2">
                  {existingKnowledgeDocs.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate">{doc.fileName}</p>
                        {doc.createdAt && (
                          <p className="text-[11px] text-slate-500">
                            Uploaded{" "}
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        disabled={!doc.viewUrl}
                        className="shrink-0 px-3 py-1.5 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        View
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={openKnowledgeFilePicker}
              onDragOver={handleKnowledgeFilesDragOver}
              onDragLeave={handleKnowledgeFilesDragLeave}
              onDrop={handleKnowledgeFilesDrop}
              className={`w-full block px-4 py-8 border-2 border-dashed rounded-lg text-sm cursor-pointer transition-colors ${
                isDraggingKnowledgeFiles
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-300 hover:border-blue-400 hover:bg-slate-50 text-slate-600"
              }`}
            >
              <div className="text-center">
                <p className="font-medium">Drag & drop PDF files here</p>
                <p className="mt-1 text-xs">or click to choose files</p>
              </div>
            </button>
            <input
              ref={knowledgeFileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleKnowledgeFilesChange}
              className="hidden"
              aria-label="Upload additional knowledge base PDF files"
            />

            {knowledgeFiles.length > 0 && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs font-medium text-slate-700 mb-1">
                  Selected PDFs ({knowledgeFiles.length})
                </p>
                <ul className="text-xs text-slate-600 space-y-1">
                  {knowledgeFiles.map((file) => (
                    <li key={file.name}>{file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center space-x-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 dialora-primary-btn py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Updating Agent..." : "Update Agent"}
            </button>
            <Link
              href="/dashboard"
              className="dialora-secondary-btn px-6 py-3 rounded-lg"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="dialora-panel rounded-xl w-full max-w-5xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 truncate">
                  {previewDoc.fileName}
                </h3>
                <p className="text-xs text-slate-500">PDF Preview</p>
              </div>

              <div className="flex items-center gap-2">
                {previewDoc.viewUrl && (
                  <a
                    href={previewDoc.viewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 border border-slate-300 rounded-md text-xs text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Open in New Tab
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-xs hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 p-3">
              {previewDoc.viewUrl ? (
                <iframe
                  title={`Preview ${previewDoc.fileName}`}
                  src={previewDoc.viewUrl}
                  className="w-full h-full rounded-lg border border-slate-200"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm text-slate-600 border border-slate-200 rounded-lg">
                  Preview is unavailable for this file.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <UpgradeAccountModal
        isOpen={showMigrateModal}
        onClose={() => setShowMigrateModal(false)}
      />
    </div>
  );
}
