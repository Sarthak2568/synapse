import React from "react";
import { Link } from "react-router-dom";

export function AboutView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl">About Synapse OS</h1>
          <p className="text-subtxt mt-1">
            Next-generation biomechanics analysis engine.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-card p-6 lg:p-8 card-hover relative overflow-hidden">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-[80px] pointer-events-none" />
        
        <h2 className="font-heading text-2xl mb-4 text-primary">The Vision</h2>
        <p className="text-lg text-subtxt leading-relaxed mb-6">
          Synapse Sports Tech aims to democratize professional sports science. Historically, 
          real-time kinematic tracking required thousands of dollars in optical markers, specialized 
          cameras, and massive processing servers.
        </p>
        <p className="text-lg text-subtxt leading-relaxed">
          Synapse OS 2.0 changes the game by running <strong>60fps skeletal detection</strong> 
          entirely on-device through WebGL and TensorFlow.js. Zero latency, complete privacy, 
          and immediate coaching feedback—all from your standard webcam.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-white/10 bg-card p-6 card-hover">
          <h3 className="font-heading text-xl mb-4 flex items-center gap-2">
            <span className="text-secondary">◈</span> Core Features
          </h3>
          <ul className="space-y-4 text-subtxt">
            <li>
              <strong className="text-white block mb-1">Live AI Tracking</strong>
              Real-time pose estimation calculating joint angles for Knee Flexion, Trunk Lean, and Hip Extension instantly.
            </li>
            <li>
              <strong className="text-white block mb-1">Universal Pro-Compare</strong>
              Upload any professional video to extract its golden skeleton. Synapse syncs your live feed against the pro footage to score your exact form similarity.
            </li>
            <li>
              <strong className="text-white block mb-1">3D Stadium Integration</strong>
              Translates your real physical cricket swing into a 3D environment with physics-based bowling and ball collisions.
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-card p-6 card-hover flex flex-col">
          <h3 className="font-heading text-xl mb-4 flex items-center gap-2">
            <span className="text-warn">⚡</span> Technology Stack
          </h3>
          <div className="space-y-3 flex-1">
            <div className="flex justify-between items-center bg-bg p-3 rounded-xl border border-white/5">
              <span className="text-sm">Machine Learning</span>
              <strong className="text-xs text-white bg-white/10 px-2 py-1 rounded">TensorFlow.js</strong>
            </div>
            <div className="flex justify-between items-center bg-bg p-3 rounded-xl border border-white/5">
              <span className="text-sm">Model Architecture</span>
              <strong className="text-xs text-white bg-white/10 px-2 py-1 rounded">MoveNet Multipose</strong>
            </div>
            <div className="flex justify-between items-center bg-bg p-3 rounded-xl border border-white/5">
              <span className="text-sm">3D Rendering Engine</span>
              <strong className="text-xs text-white bg-white/10 px-2 py-1 rounded">Three.js</strong>
            </div>
            <div className="flex justify-between items-center bg-bg p-3 rounded-xl border border-white/5">
              <span className="text-sm">User Interface</span>
              <strong className="text-xs text-white bg-white/10 px-2 py-1 rounded">React + Tailwind</strong>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <Link to="/live" className="inline-block w-full py-3 rounded-xl bg-primary/10 border border-primary/30 text-primary font-bold hover:bg-primary/20 transition-colors">
              Begin Live Analysis
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
