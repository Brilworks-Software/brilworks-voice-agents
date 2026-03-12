"use client";
import React from "react";
import PropTypes from "prop-types";
import {
  Laptop,
  Home,
  Hospital,
  Sparkles,
  Wrench,
  DollarSign,
  Shield,
  Package,
  Plane,
  Car,
  Scale,
  Handshake,
  ShoppingBag,
  GraduationCap,
  UtensilsCrossed,
} from "lucide-react";

const iconMap = {
  Laptop,
  Home,
  Hospital,
  Sparkles,
  Wrench,
  DollarSign,
  Shield,
  Package,
  Plane,
  Car,
  Scale,
  Handshake,
  ShoppingBag,
  GraduationCap,
  UtensilsCrossed,
};

const accentMap = {
  indigo: {
    card: "border-indigo-400/30 hover:border-indigo-400",
    chip: "dialora-chip-violet",
    iconBg: "from-indigo-500/20 to-violet-500/10",
    iconColor: "text-indigo-300",
  },
  blue: {
    card: "border-sky-400/30 hover:border-sky-400",
    chip: "dialora-chip-blue",
    iconBg: "from-sky-500/20 to-cyan-500/10",
    iconColor: "text-sky-300",
  },
  emerald: {
    card: "border-emerald-400/30 hover:border-emerald-400",
    chip: "dialora-chip-emerald",
    iconBg: "from-emerald-500/20 to-teal-500/10",
    iconColor: "text-emerald-300",
  },
  pink: {
    card: "border-pink-400/30 hover:border-pink-400",
    chip: "dialora-chip-pink",
    iconBg: "from-pink-500/20 to-rose-500/10",
    iconColor: "text-pink-300",
  },
  orange: {
    card: "border-amber-400/30 hover:border-amber-400",
    chip: "dialora-chip-amber",
    iconBg: "from-amber-500/20 to-orange-500/10",
    iconColor: "text-amber-300",
  },
  red: {
    card: "border-rose-400/30 hover:border-rose-400",
    chip: "dialora-chip-rose",
    iconBg: "from-rose-500/20 to-red-500/10",
    iconColor: "text-rose-300",
  },
  cyan: {
    card: "border-cyan-400/30 hover:border-cyan-400",
    chip: "dialora-chip-cyan",
    iconBg: "from-cyan-500/20 to-sky-500/10",
    iconColor: "text-cyan-300",
  },
};

const IndustryCard = ({ industry, onClick }) => {
  const IconComponent = iconMap[industry.icon] || Laptop;
  const accent = accentMap[industry.color] || accentMap.blue;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group dialora-panel dialora-glow-card rounded-2xl p-6 transition-all cursor-pointer flex flex-col h-full text-left hover:-translate-y-1 ${accent.card}`}
    >
      <div
        className={`mb-4 dialora-icon-shell bg-gradient-to-br ${accent.iconBg} group-hover:scale-110 transition-transform`}
      >
        <IconComponent
          className={`w-8 h-8 ${accent.iconColor}`}
          strokeWidth={2}
        />
      </div>
      <h3 className="text-md font-bold text-slate-900 mb-2">{industry.name}</h3>
      <p className="text-slate-500 text-sm mb-4 flex-1">
        {industry.description}
      </p>
      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
        <span
          className={`dialora-chip ${accent.chip} text-xs uppercase tracking-widest`}
        >
          {industry.agentName} Agent
        </span>
        <span className="text-indigo-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Select &rarr;
        </span>
      </div>
    </button>
  );
};

IndustryCard.propTypes = {
  onClick: PropTypes.func.isRequired,
  industry: PropTypes.shape({
    icon: PropTypes.string,
    color: PropTypes.string,
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    agentName: PropTypes.string.isRequired,
  }).isRequired,
};

export default IndustryCard;
