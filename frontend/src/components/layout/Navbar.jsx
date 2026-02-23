import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Activity, UploadCloud, LayoutDashboard, Info, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { path: "/", label: "Home", icon: Home },
  { path: "/live", label: "Live Analysis", icon: Activity },
  { path: "/upload", label: "Upload Video", icon: UploadCloud },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/about", label: "About", icon: Info },
];

export function Navbar({ status }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={`sticky top-0 z-50 transition-all duration-300 border-b ${
        scrolled ? "bg-card/90 backdrop-blur-xl border-white/10 shadow-xl" : "bg-transparent border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 lg:px-6">
        <div className="flex items-center gap-8">
          <Link to="/" className="group block">
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary transition-colors group-hover:text-secondary mb-0.5">
              Synapse Sports Tech
            </p>
            <h1 className="font-heading text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-[0_0_10px_rgba(0,255,157,0.4)]">
                <span className="w-2.5 h-2.5 bg-black rounded-full" />
              </span>
              Synapse OS
            </h1>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1.5 rounded-full bg-black/40 border border-white/10 px-2 py-1.5 backdrop-blur-md">
            {NAV_LINKS.map((item) => {
              const active = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    active
                      ? "bg-primary text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]"
                      : "text-subtxt hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white shadow-inner">
            <span className="pulse-dot h-2 w-2 rounded-full bg-secondary" />
            <span className="hidden sm:inline">{status}</span>
          </span>

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-black/40 text-white hover:bg-white/10 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      <div 
        className={`lg:hidden absolute top-full left-0 right-0 border-b border-white/10 bg-card/95 backdrop-blur-2xl shadow-2xl transition-all duration-300 overflow-hidden ${
          mobileMenuOpen ? "max-h-[400px] py-4" : "max-h-0 py-0 border-transparent"
        }`}
      >
        <nav className="flex flex-col gap-2 px-4">
          {NAV_LINKS.map((item) => {
            const active = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-semibold transition-all ${
                  active
                    ? "bg-primary text-black shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                    : "text-subtxt hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
