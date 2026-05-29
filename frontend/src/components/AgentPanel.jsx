import { motion } from "framer-motion";

const statusMap = {
  INACTIVE: {
    label: "Ready",
    dot: "bg-slate-400"
  },
  ACTIVE: {
    label: "Interview Live",
    dot: "bg-emerald-400"
  },
  FINISHED: {
    label: "Evaluation Ready",
    dot: "bg-cyan-400"
  }
};

const AgentPanel = ({ userName, callStatus, isSpeaking, lastMessage }) => {
  const status = statusMap[callStatus] || statusMap.INACTIVE;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-8 rounded-2xl border border-cyan-500/30 bg-[#081326]/75 p-6 backdrop-blur"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-2xl">
              AI
              {isSpeaking && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300/40" />}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan-200/80">Interviewer</p>
              <p className="text-lg font-bold text-cyan-100">AI Interviewer</p>
            </div>
          </div>
          <p className="text-sm text-slate-200">Adaptive interview system is active with progressive difficulty flow.</p>
        </div>

        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-500 text-xl font-bold text-white">
              {(userName || "U").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-purple-200/80">Candidate</p>
              <p className="text-lg font-bold text-purple-100">{userName || "Guest"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${status.dot}`} />
            <span>{status.label}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Live Transcript Preview</p>
        <p className="text-sm text-slate-200">
          {lastMessage || "Your latest answer preview will appear here as you type."}
        </p>
      </div>
    </motion.section>
  );
};

export default AgentPanel;
