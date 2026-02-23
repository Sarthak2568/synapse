import React from "react";
import { useOutletContext, useNavigate } from "react-router-dom";

export function UploadAnalyzeView() {
  const navigate = useNavigate();
  const {
    status, setStatus,
    fileInputRef, uploadVideoRef, uploadCanvasRef, analyzeUploadedVideo,
    kneeChartRef, trunkChartRef, timelineCanvasRef, timelineSliderRef,
    timelineMeta, stopTimelinePlayback, playTimeline, drawTimelineFrame,
    hasGoldenSkeleton, setCompareMode, uploadedVideoUrl, setUploadedVideoUrl
  } = useOutletContext();

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h2 className="font-heading text-xl">Video Analysis</h2>
        <p className="text-sm text-subtxt">
          Upload pre-recorded footage to extract professional kinetic data.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-card p-4 lg:p-6 card-hover flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-lg">Upload Match Footage</h3>
            <button
              className="btn-press rounded-xl border border-white/15 bg-bg px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Video
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const url = URL.createObjectURL(f);
              uploadVideoRef.current.src = url;
              setUploadedVideoUrl(url);
              setStatus(`loaded: ${f.name}`);
            }}
          />
          <div className="relative flex-1 min-h-[300px] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-inner">
            <video
              ref={uploadVideoRef}
              src={uploadedVideoUrl}
              controls
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-contain"
            />
            <canvas
              ref={uploadCanvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />
          </div>
          <button
            className="btn-press mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-black shadow-[0_0_15px_rgba(0,229,255,0.2)] transition-shadow hover:shadow-[0_0_25px_rgba(0,229,255,0.4)]"
            onClick={analyzeUploadedVideo}
          >
            Run Kinematic Analysis
          </button>
          
          {hasGoldenSkeleton && (
            <button
              className="btn-press mt-3 w-full rounded-xl bg-secondary py-3 text-sm font-bold text-black shadow-[0_0_15px_rgba(0,255,157,0.3)] transition-shadow hover:shadow-[0_0_25px_rgba(0,255,157,0.5)] border border-secondary/50 flex justify-center items-center gap-2"
              onClick={() => {
                setCompareMode(true);
                navigate('/live');
              }}
            >
               Launch Side-by-Side Live Practice ➜
            </button>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-card p-4 lg:p-6 card-hover flex flex-col">
          <h3 className="font-heading text-lg mb-4">Data Visualization</h3>
          
          <div className="grid grid-cols-1 gap-4 flex-1">
            <div className="rounded-2xl border border-white/10 bg-bg p-4 relative">
              <span className="absolute top-2 right-4 text-xs font-heading text-subtxt uppercase tracking-wider">Knee Flexion</span>
              <canvas ref={kneeChartRef} className="h-48 w-full" />
            </div>
            <div className="rounded-2xl border border-white/10 bg-bg p-4 relative">
              <span className="absolute top-2 right-4 text-xs font-heading text-subtxt uppercase tracking-wider">Trunk Lean</span>
              <canvas ref={trunkChartRef} className="h-48 w-full" />
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-card p-4 lg:p-6 card-hover">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h4 className="font-heading text-lg">Skeleton Time-Lapse</h4>
            <p className="text-sm text-subtxt">Activity-Aware 3D joint reconstruction</p>
          </div>
          <div className="flex items-center gap-3 text-sm font-medium">
            <span className="bg-bg px-3 py-1 rounded-lg border border-white/5">
              Frame <span className="text-primary">{timelineMeta.current + 1}</span> / {Math.max(1, timelineMeta.total)}
            </span>
            <span className="bg-bg px-3 py-1 rounded-lg border border-white/5">
              Phase: <span className="text-white">{timelineMeta.phase}</span>
            </span>
            <span className="bg-warn/10 text-warn px-3 py-1 rounded-lg border border-warn/20">
              Worst: #{timelineMeta.worst + 1}
            </span>
          </div>
        </div>

        <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#070d15] shadow-inner mb-4">
          <canvas
            ref={timelineCanvasRef}
            width="1200"
            height="400"
            className="w-full h-auto max-h-[400px] object-contain"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-bg/50 p-4 rounded-xl border border-white/5">
          <button
            className="btn-press min-w-[100px] rounded-lg bg-secondary py-2 text-sm font-bold text-black shadow-lg"
            onClick={() => {
              if (timelineMeta.playing) stopTimelinePlayback();
              else playTimeline();
            }}
            disabled={!timelineMeta.total}
          >
            {timelineMeta.playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            className="btn-press min-w-[140px] rounded-lg bg-primary py-2 text-sm font-bold text-black shadow-lg"
            onClick={() => {
              stopTimelinePlayback();
              drawTimelineFrame(timelineMeta.worst || 0);
            }}
            disabled={!timelineMeta.total}
          >
            ⚡ Jump To Worst
          </button>
          <div className="flex-1 min-w-[200px] px-2 flex items-center">
            <input
              ref={timelineSliderRef}
              type="range"
              min="0"
              max={Math.max(0, timelineMeta.total - 1)}
              defaultValue="0"
              className="w-full h-2 cursor-pointer accent-primary bg-white/10 rounded-full appearance-none outline-none"
              onChange={(e) => {
                stopTimelinePlayback();
                drawTimelineFrame(Number(e.target.value));
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
