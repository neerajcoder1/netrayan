"use client";

import { useEffect, useState } from "react";
import Logo from "./Logo";

export default function CyberWelcome() {
  const [show, setShow] = useState(true);
  const [glitchText, setGlitchText] = useState("INITIALIZING SECURE PROTOCOL...");
  const [showBtn, setShowBtn] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {

    const texts = [
      "ESTABLISHING SECURE CONNECTION...",
      "VERIFYING CRYPTOGRAPHIC KEYS...",
      "LOADING IMMUTABLE LEDGER...",
      "ACCESS GRANTED."
    ];
    
    let currentStep = 0;
    
    const interval = setInterval(() => {
      if (currentStep < texts.length) {
        setGlitchText(texts[currentStep]);
        currentStep++;
      }
    }, 1500);

    // After 6 seconds, show the Enter button
    const btnTimeout = setTimeout(() => {
      setShowBtn(true);
    }, 6000);

    return () => {
      clearInterval(interval);
      clearTimeout(btnTimeout);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)] text-accent font-code overflow-hidden transition-opacity duration-1000" style={{ opacity: show ? 1 : 0 }}>
      {/* Cyber Grid Background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.15]" style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.25) 50%), linear-gradient(90deg, rgba(227,179,65,0.08), rgba(53,208,161,0.03), rgba(0,0,0,0))',
        backgroundSize: '100% 4px, 3px 100%'
      }}></div>
      
      <div className="text-center z-10 p-10 sm:p-12 border border-accent/30 bg-[var(--panel)] backdrop-blur-md rounded-xl shadow-[0_0_40px_#e3b34133] relative max-w-lg w-[90%]">
        {/* Corner Accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-accent rounded-tl-sm"></div>
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-accent rounded-tr-sm"></div>
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-accent rounded-bl-sm"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-accent rounded-br-sm"></div>
        
        <div className="flex items-center justify-center gap-4 mb-5">
           <div className="animate-pulse">
             <Logo size={48} />
           </div>
           <div className="text-3xl sm:text-5xl font-bold tracking-widest text-foreground">NETRAYAN</div>
        </div>
        
        <div className="text-xs sm:text-sm text-accent mb-6 tracking-widest h-5">{glitchText}</div>
        
        {!showBtn ? (
          <div className="w-full bg-accent/20 h-1.5 mt-5 rounded overflow-hidden">
             <div className="bg-accent h-full shadow-[0_0_12px_var(--accent)]" style={{ width: "100%", animation: "progress 6s cubic-bezier(0.4, 0, 0.2, 1)" }}></div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-2">
            <button 
              onClick={() => setShow(false)}
              className="w-full sm:w-auto px-6 py-3 bg-accent text-[#191100] font-bold tracking-widest rounded transition-all hover:bg-accent-2 hover:shadow-[0_0_20px_var(--accent-2)] hover:scale-105 active:scale-95 uppercase text-xs"
            >
              Enter System
            </button>
            <button 
              onClick={() => {
                setShow(false);
                window.location.hash = 'how';
              }}
              className="w-full sm:w-auto px-6 py-3 bg-transparent border border-accent/50 text-accent font-bold tracking-widest rounded transition-all hover:bg-accent/10 hover:border-accent hover:shadow-[0_0_20px_rgba(227,179,65,0.2)] hover:scale-105 active:scale-95 uppercase text-xs"
            >
              How To Use
            </button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes progress {
          0% { width: 0%; }
          40% { width: 45%; }
          70% { width: 80%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
