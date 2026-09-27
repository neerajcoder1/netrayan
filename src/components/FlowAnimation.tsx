"use client";

export default function FlowAnimation() {
  return (
    <div className="w-full aspect-auto py-12 sm:py-20 bg-black/5 rounded-xl border border-[var(--border)] overflow-hidden relative flex items-center justify-center">
      <style>{`
        @keyframes moveDoc {
          0% { left: 0%; opacity: 0; transform: scale(0.8) translateY(-50%); }
          5% { opacity: 1; transform: scale(1) translateY(-50%); }
          20% { left: 25%; opacity: 1; transform: scale(1) translateY(-50%); }
          25% { left: 25%; opacity: 0; transform: scale(0.8) translateY(-50%); }
          30% { left: 25%; opacity: 1; transform: scale(1) translateY(-50%); }
          45% { left: 50%; opacity: 1; transform: scale(1) translateY(-50%); }
          50% { left: 50%; opacity: 0; transform: scale(0.8) translateY(-50%); }
          55% { left: 50%; opacity: 1; transform: scale(1) translateY(-50%); }
          70% { left: 75%; opacity: 1; transform: scale(1) translateY(-50%); }
          75% { left: 75%; opacity: 0; transform: scale(0.8) translateY(-50%); }
          80% { left: 75%; opacity: 1; transform: scale(1) translateY(-50%); }
          95% { left: 100%; opacity: 1; transform: scale(1) translateY(-50%); }
          100% { left: 100%; opacity: 0; transform: scale(0.8) translateY(-50%); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(100, 100, 100, 0.2); }
          50% { box-shadow: 0 0 15px 0 rgba(100, 100, 100, 0.6); }
        }
        .anim-doc {
          animation: moveDoc 12s infinite ease-in-out;
        }
        .anim-node-1 { animation: pulseGlow 3s infinite; }
        .anim-node-2 { animation: pulseGlow 3s infinite; animation-delay: 2.4s; }
        .anim-node-3 { animation: pulseGlow 3s infinite; animation-delay: 4.8s; }
        .anim-node-4 { animation: pulseGlow 3s infinite; animation-delay: 7.2s; }
        .anim-node-5 { animation: pulseGlow 3s infinite; animation-delay: 9.6s; }
      `}</style>
      
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
        backgroundSize: '24px 24px'
      }}></div>

      <div className="relative w-full max-w-5xl px-4 sm:px-12 z-10">
        
        {/* The Track for the Document Animation */}
        <div className="absolute top-1/2 left-[calc(1rem+32px)] right-[calc(1rem+32px)] sm:left-[calc(3rem+32px)] sm:right-[calc(3rem+32px)] h-px -translate-y-1/2 z-10">
           <div className="absolute top-1/2 -ml-3 sm:-ml-4 w-6 h-6 sm:w-8 sm:h-8 bg-foreground/10 border border-foreground/30 text-foreground text-[8px] sm:text-[10px] font-bold flex items-center justify-center rounded shadow-lg anim-doc backdrop-blur-md">
             DOC
           </div>
        </div>

        {/* Nodes and static paths */}
        <div className="flex items-center justify-between relative z-20">
          {/* Step 1 */}
          <div className="flex flex-col items-center gap-3 w-16">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-background border-2 border-muted flex items-center justify-center anim-node-1 bg-background z-20">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <span className="absolute -bottom-8 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted text-center leading-tight whitespace-nowrap">1. Encrypt</span>
          </div>

          <div className="h-px bg-[var(--border)] flex-1 -mx-2 z-0"></div>

          {/* Step 2 */}
          <div className="flex flex-col items-center gap-3 w-16">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-background border-2 border-accent flex items-center justify-center anim-node-2 text-accent bg-background z-20">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <span className="absolute -bottom-8 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted text-center leading-tight whitespace-nowrap">2. Mark</span>
          </div>

          <div className="h-px bg-[var(--border)] flex-1 -mx-2 z-0"></div>

          {/* Step 3 */}
          <div className="flex flex-col items-center gap-3 w-16">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-background border-2 border-accent-2 flex items-center justify-center anim-node-3 text-accent-2 bg-background z-20">
               <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <span className="absolute -bottom-8 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted text-center leading-tight whitespace-nowrap">3. Sign</span>
          </div>

          <div className="h-px bg-[var(--border)] flex-1 -mx-2 z-0"></div>

          {/* Step 4 */}
          <div className="flex flex-col items-center gap-3 w-16">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-background border-2 border-foreground flex items-center justify-center anim-node-4 text-foreground bg-background z-20">
               <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            </div>
            <span className="absolute -bottom-8 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted text-center leading-tight whitespace-nowrap">4. Commit</span>
          </div>

          <div className="h-px bg-[var(--border)] flex-1 -mx-2 z-0"></div>

          {/* Step 5 */}
          <div className="flex flex-col items-center gap-3 w-16">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-background border-2 border-danger flex items-center justify-center anim-node-5 text-danger bg-background z-20">
               <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <span className="absolute -bottom-8 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted text-center leading-tight whitespace-nowrap">5. Trace</span>
          </div>
        </div>

      </div>
      
      <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] sm:text-xs font-medium text-muted">
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
        End-to-End Cryptographic Roadmap
      </div>
    </div>
  );
}
