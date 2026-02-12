"use client";
import React from 'react';

const IndustryCard = ({ industry, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="group bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col h-full"
    >
      <div className={`text-5xl mb-4 bg-slate-50 w-16 h-16 flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform`}>
        {industry.icon}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{industry.name}</h3>
      <p className="text-slate-500 text-sm mb-4 flex-1">{industry.description}</p>
      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{industry.agentName} Agent</span>
        <span className="text-indigo-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">Select &rarr;</span>
      </div>
    </div>
  );
};

export default IndustryCard;
