import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ACTIVITY_OPTIONS } from "../utils/constants";
import { SessionModal } from "../components/shared/SessionModal";
import { User, Settings, Activity, Target, Zap, Clock, Shield, ChevronRight } from "lucide-react";

export function DashboardView() {
  const { 
    sessions, 
    avgScore, 
    coachMode, 
    activity 
  } = useOutletContext();
  
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  const bestScore = sessions.length
    ? Math.max(...sessions.map((s) => s.score)).toFixed(1)
    : "--";

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold flex items-center gap-3">
            <User className="text-primary w-8 h-8" />
            Athlete Dashboard
          </h1>
          <p className="text-subtxt mt-1">
            Your performance history, technique trends, and profile settings.
          </p>
        </div>
      </div>

      {sessions.length > 0 && showSummary && summaryData && (
        <SessionModal
          session={summaryData}
          onClose={() => setShowSummary(false)}
        />
      )}

      {/* Profile & Settings Summary */}
      <section className="rounded-3xl border border-white/10 bg-card/60 p-6 lg:p-8 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        
        <h2 className="font-heading text-xl font-bold mb-6 flex items-center gap-2">
          <Settings className="w-5 h-5 text-secondary" /> Profile Preferences
        </h2>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 relative z-10">
          <div className="rounded-2xl border border-white/10 bg-bg p-5 hover:border-primary/30 transition-colors group">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-primary group-hover:block" />
              <p className="text-xs font-semibold text-subtxt uppercase tracking-wider">Coaching Style</p>
            </div>
            <p className="text-lg font-bold text-white">Technical Focus</p>
          </div>
          
          <div className="rounded-2xl border border-white/10 bg-bg p-5 hover:border-secondary/30 transition-colors group">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-secondary group-hover:block" />
              <p className="text-xs font-semibold text-subtxt uppercase tracking-wider">Core Activity</p>
            </div>
            <p className="text-lg font-bold text-white">
              {ACTIVITY_OPTIONS.find((x) => x.key === activity)?.label || "Auto Detect"}
            </p>
          </div>
          
          <div className="rounded-2xl border border-white/10 bg-bg p-5 hover:border-[#FF4D4F]/30 transition-colors group">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-[#FF4D4F] group-hover:block" />
              <p className="text-xs font-semibold text-subtxt uppercase tracking-wider">Coach Mode</p>
            </div>
            <p className="text-lg font-bold text-white">{coachMode ? "Active" : "Disabled"}</p>
          </div>
          
          <div className="rounded-2xl border border-white/10 bg-bg p-5 hover:border-white/30 transition-colors group">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-white group-hover:block" />
              <p className="text-xs font-semibold text-subtxt uppercase tracking-wider">Sessions</p>
            </div>
            <p className="text-lg font-bold text-white">{sessions.length} Logged</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Insights / Trends */}
        <section className="col-span-1 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-card to-bg p-6 lg:p-8 relative overflow-hidden shadow-lg">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Target className="w-32 h-32 text-primary" />
            </div>
            <h2 className="font-heading text-xl font-bold mb-6 flex items-center gap-2 text-white">
               Insights
            </h2>
            <div className="space-y-4 relative z-10">
              <div className="rounded-2xl border border-white/10 bg-bg/80 backdrop-blur-md p-5 flex items-center justify-between group hover:border-secondary/30 transition-colors">
                <span className="text-sm font-medium text-subtxt">Personal Best</span>
                <span className="font-heading text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-secondary to-primary">{bestScore}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-bg/80 backdrop-blur-md p-5 flex items-center justify-between group hover:border-primary/30 transition-colors">
                <span className="text-sm font-medium text-subtxt">Historical Avg</span>
                <span className="font-heading text-3xl font-bold text-primary">{sessions.length ? avgScore.toFixed(1) : "--"}</span>
              </div>
            </div>
            <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-xs text-primary leading-relaxed font-medium">
                Maintain form consistency above 85 to minimize joint risk and maximize power transfer in your movements.
              </p>
            </div>
          </div>
        </section>

        {/* History / Sessions log */}
        <section className="col-span-1 md:col-span-2 rounded-3xl border border-white/10 bg-card p-6 lg:p-8 shadow-lg">
          <h2 className="font-heading text-xl font-bold mb-6 flex items-center gap-2">
             Recent Timeline
          </h2>
          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
            {sessions.map((s, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-bg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all shadow-md"
                onClick={() => {
                  setSummaryData(s);
                  setShowSummary(true);
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-white text-lg">{s.activity}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold tracking-wider text-subtxt uppercase">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-subtxt">
                    <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5"/> Consistency: {s.consistency}</span>
                    <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5"/> Risk: {s.risk}</span>
                    <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5"/> Power: {s.power}W</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-subtxt mb-1">Score</p>
                    <p className={`font-heading text-3xl font-bold ${s.score >= 80 ? 'text-secondary drop-shadow-[0_0_8px_rgba(0,255,157,0.5)]' : s.score >= 60 ? 'text-yellow-400' : 'text-warn'}`}>
                      {s.score}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-black transition-colors">
                    <ChevronRight className="w-5 h-5 opacity-50 group-hover:opacity-100" />
                  </div>
                </div>
              </div>
            ))}
            {!sessions.length && (
              <div className="text-center py-16 rounded-2xl border border-dashed border-white/10 bg-bg/50">
                 <Target className="w-12 h-12 text-subtxt/30 mx-auto mb-4" />
                <p className="text-subtxt font-medium text-lg">No training history available</p>
                <p className="text-sm text-subtxt/50 mt-1">Complete a live analysis or upload a video to log your first session.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
