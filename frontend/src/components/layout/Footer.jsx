import React from "react";
import { Link } from "react-router-dom";
import { NAV_ITEMS } from "../../utils/constants";

export function Footer() {
  return (
    <footer className="mt-8 border-t border-white/10 pt-8 pb-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col items-center md:items-start">
          <p className="text-secondary font-heading text-lg tracking-wide uppercase">Synapse OS</p>
          <p className="text-xs text-subtxt mt-1">AI Motion Analysis Platform v2.0</p>
        </div>
        
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="text-sm font-medium text-subtxt hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="text-xs text-subtxt/60 flex flex-col items-center md:items-end">
          <p>Powered by TensorFlow.js & Three.js</p>
          <p className="mt-1">Local Processing • Zero Latency</p>
        </div>
      </div>
      <div className="mt-6 text-center text-[10px] text-subtxt/40">
        <p>&copy; {new Date().getFullYear()} Synapse Sports Tech. All rights reserved.</p>
      </div>
    </footer>
  );
}
