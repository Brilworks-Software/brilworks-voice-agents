"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { LANGUAGES } from "./constants";

const Header = ({ onHomeClick, selectedLanguage, onLanguageChange }) => {
  return (
    <header className="bg-white border-b border-slate-200 px-4 md:px-14 2xl:px-[300px] py-4 flex items-center justify-between z-10 shadow-sm">
      <div className="header_logo">
        <Link href="/">
          <Image
            src="/logo-black.svg"
            alt="Brilworks Logo"
            width={155}
            height={46}
            priority={true}
          />
        </Link>
      </div>

      <div className="hidden md:flex items-center space-x-6">
        <nav className="flex items-center space-x-4">
          <button
            onClick={onHomeClick}
            className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
          >
            Agents
          </button>

          <div className="relative group/lang ml-2">
            <button className="flex items-center space-x-2 text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-300 transition-all">
              <span>{selectedLanguage.flag}</span>
              <span>{selectedLanguage.name}</span>
              <span className="text-[10px] opacity-40">▼</span>
            </button>
            <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover/lang:opacity-100 group-hover/lang:visible transition-all z-50 p-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => onLanguageChange(lang)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    selectedLanguage.code === lang.code
                      ? "bg-blue-50 text-blue-700 font-bold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-base">{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Header;
