import React from "react";
import { Link, useOutletContext } from "react-router-dom";
import { 
  Activity, 
  Zap, 
  Box, 
  ArrowRight, 
  ShieldCheck, 
  BarChart, 
  Users, 
  Trophy 
} from "lucide-react";

export function HomeView() {
  const { sessions } = useOutletContext();
  const sessionCount = sessions?.length || 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-card/60 p-8 md:p-12 lg:p-20 backdrop-blur-xl">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-secondary/20 blur-[120px] pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary shadow-[0_0_15px_rgba(0,229,255,0.2)]">
            <span className="pulse-dot h-2 w-2 rounded-full bg-primary" />
            Synapse OS 2.0 Released
          </div>
          
          <h1 className="font-heading text-5xl font-extrabold tracking-tight text-white md:text-6xl lg:text-7xl leading-[1.1]">
            Master your motion <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary drop-shadow-sm">
              in real-time.
            </span>
          </h1>
          
          <p className="mt-6 text-lg text-subtxt md:text-xl max-w-xl leading-relaxed font-light">
            Professional biomechanics and posture analysis powered by 60fps local AI models. Extract golden skeletons from any video, compare your form, and perfect your game instantly.
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
            <Link
              to="/live"
              className="group flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-secondary p-[1px] shadow-[0_0_30px_rgba(0,255,157,0.3)] transition-all hover:shadow-[0_0_40px_rgba(0,255,157,0.5)] hover:scale-[1.02]"
            >
              <div className="flex h-full w-full items-center justify-center gap-2 rounded-2xl bg-black px-8 py-4 transition-colors group-hover:bg-transparent">
                <span className="font-bold text-white group-hover:text-black transition-colors text-lg">
                  Start Live Analysis
                </span>
                <ArrowRight className="h-5 w-5 text-primary group-hover:text-black transition-colors" />
              </div>
            </Link>
            
            <Link
              to="/upload"
              className="flex w-full sm:w-auto px-8 py-4 items-center justify-center rounded-2xl border border-white/20 bg-white/5 text-lg font-bold text-white transition-all hover:bg-white/10 hover:border-white/30"
            >
              Compare Pro Video
            </Link>
          </div>
        </div>

        {/* Floating Mockup / Graphic (CSS based) */}
        <div className="absolute right-[-10%] top-[20%] hidden lg:block w-[500px] h-[500px] pointer-events-none">
           <div className="absolute inset-0 border border-white/10 rounded-full animate-spin-slow" style={{ animationDuration: '40s' }} />
           <div className="absolute inset-8 border border-white/5 rounded-full animate-spin-reverse-slow" style={{ animationDuration: '30s' }} />
           <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent rounded-full blur-3xl mix-blend-screen" />
        </div>
      </section>

      {/* Stats Section */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Sessions", value: `${sessionCount > 0 ? sessionCount : '1.2k+'}`, text: "Recorded offline" },
          { label: "Latency", value: "<16ms", text: "Zero network lag" },
          { label: "Keypoints", value: "17", text: "Full body tracking" },
          { label: "AI Models", value: "60fps", text: "Local inference" },
        ].map((stat, i) => (
          <div key={i} className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-card p-6 text-center shadow-lg transition-transform hover:-translate-y-1">
            <h3 className="font-heading text-3xl font-bold text-white mb-1">{stat.value}</h3>
            <p className="text-sm font-semibold text-primary">{stat.label}</p>
            <p className="text-xs text-subtxt mt-1">{stat.text}</p>
          </div>
        ))}
      </section>

      {/* Bento Grid Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="col-span-1 md:col-span-2 flex flex-col justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-card to-bg p-8 hover:border-white/20 transition-all relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity className="w-64 h-64 text-primary" />
          </div>
          <div className="flex items-center gap-3 text-primary mb-4">
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
              <Activity className="h-6 w-6" />
            </div>
            <h2 className="font-heading text-2xl font-bold text-white">Universal Tracking</h2>
          </div>
          <p className="text-subtxt text-[15px] leading-relaxed max-w-md">
            Instantly map 17 structural keypoints to track joint severity, limb velocity, and spinal alignment across various activities. 
            Identify form breakdowns the millisecond they happen.
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-card p-8 hover:border-secondary/30 transition-all shadow-lg group">
          <div className="flex items-center gap-3 text-secondary mb-4">
            <div className="p-3 bg-secondary/10 rounded-xl border border-secondary/20">
              <Zap className="h-6 w-6" />
            </div>
            <h2 className="font-heading text-xl font-bold text-white">Zero Latency</h2>
          </div>
          <p className="text-subtxt text-[15px] leading-relaxed">
            Bypass server round-trips entirely. All pose data and complex trigonometry are calculated securely on your device's GPU for immediate coaching feedback.
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-card p-8 hover:border-[#FF4D4F]/30 transition-all shadow-lg group">
          <div className="flex items-center gap-3 text-[#FF4D4F] mb-4">
            <div className="p-3 bg-[#FF4D4F]/10 rounded-xl border border-[#FF4D4F]/20">
              <Box className="h-6 w-6" />
            </div>
            <h2 className="font-heading text-xl font-bold text-white">3D Environment</h2>
          </div>
          <p className="text-subtxt text-[15px] leading-relaxed">
            Step into the 3D Interactive Stadium. Your physical batting swing perfectly synthesizes and controls a virtual cricket bat with precise spatial awareness.
          </p>
        </section>

        <section className="col-span-1 md:col-span-2 rounded-3xl border border-white/10 bg-card p-8 hover:border-white/20 transition-all relative overflow-hidden flex flex-col md:flex-row gap-6 items-center">
           <div className="flex-1">
             <div className="flex items-center gap-3 text-white mb-4">
                <div className="p-3 bg-white/10 rounded-xl border border-white/20">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h2 className="font-heading text-2xl font-bold">Privacy First</h2>
              </div>
              <p className="text-subtxt text-[15px] leading-relaxed">
                Your video streams never leave your device. The entire Synapse OS pipeline runs locally in your browser, guaranteeing absolute privacy for your kinematic data and personal footage.
              </p>
           </div>
           <div className="hidden md:flex flex-col gap-3 w-48 shrink-0">
             <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-primary w-full" /></div>
             <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-secondary w-full" /></div>
             <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-white w-full" /></div>
           </div>
        </section>
      </div>

      {/* CTA Section */}
      <section className="rounded-3xl border border-white/10 bg-gradient-to-t from-primary/5 to-transparent p-10 text-center relative overflow-hidden">
        <h2 className="font-heading text-3xl font-bold text-white mb-4">Ready to perfect your mechanics?</h2>
        <p className="text-subtxt max-w-2xl mx-auto mb-8">
          Join professional athletes and coaches replacing expensive studio setups with Synapse OS.
        </p>
        <Link
          to="/live"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3 text-sm font-bold text-black transition-all hover:bg-gray-200 hover:scale-105"
        >
          <Camera className="w-4 h-4" />
          Launch Camera Engine
        </Link>
      </section>
    </div>
  );
}

function Camera({ className }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
      <circle cx="12" cy="13" r="3"/>
    </svg>
  );
}
