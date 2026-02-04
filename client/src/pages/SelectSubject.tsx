import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { coursesApi, type Subject } from "../services/coursesApi";

const SelectSubject: React.FC = () => {
  const { semesterId } = useParams();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSubjects = async () => {
      if (!semesterId) return;

      try {
        setLoading(true);
        const response = await coursesApi.getSubjects(semesterId);
        if (response.success && response.semester) {
          setSubjects(response.semester.subjects);
        } else {
          setError("Failed to load subjects");
        }
      } catch (err) {
        console.error("Error fetching subjects:", err);
        setError("Connection failed");
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, [semesterId]);

  return (
    <div className="min-h-screen bg-black text-white font-mono p-8 flex flex-col items-center justify-center overflow-hidden relative">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className="max-w-4xl w-full z-10">
        <button
          onClick={() => navigate("/select-semester")}
          className="cursor-target absolute top-8 left-8 text-white/40 hover:text-white font-mono text-sm tracking-widest transition-colors z-20 flex items-center gap-2 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">
            &lt;&lt;
          </span>{" "}
          BACK_TO_LEVELS
        </button>

        <header className="mb-12 border-b border-white/20 pb-4">
          <h1 className="text-2xl md:text-4xl tracking-widest mb-2">
            SUBJECT_SELECTION
          </h1>
          <div className="flex gap-4 text-xs md:text-sm opacity-60">
            <span>SYS_REL: v2.0.4</span>
            <span>TARGET: SEMESTER_{semesterId || "UNKNOWN"}</span>
            <span>USER: GUEST</span>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-xl tracking-widest animate-pulse">
              LOADING_MODULES...
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">
            <div className="text-xl tracking-widest">{error}</div>
          </div>
        ) : (
          <div className="space-y-2">
            {subjects.map((subject, index) => (
              <button
                key={subject.id}
                onClick={() => navigate(`/chat/${semesterId}/${subject.id}`)}
                className="cursor-target group w-full text-left relative overflow-hidden
                           bg-white/5 hover:bg-white/10 border-l-2 border-transparent hover:border-white
                           p-4 md:p-6 transition-all duration-200"
              >
                <div className="flex justify-between items-center relative z-10">
                  <div className="flex items-center gap-4 md:gap-8">
                    <span className="text-white/40 text-xs w-8">
                      {(index + 1).toString().padStart(2, "0")}
                    </span>
                    <div>
                      <div className="text-xs text-white/40 mb-1 group-hover:text-white/80 transition-colors">
                        [{subject.id.toUpperCase()}]
                      </div>
                      <div className="text-lg md:text-2xl font-bold tracking-wider group-hover:translate-x-2 transition-transform duration-200">
                        {subject.name.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:flex items-center gap-4 text-xs font-mono">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      &lt;INITIATE_CHAT&gt;
                    </span>
                    <span className="text-green-500 border border-green-500/30 px-2 py-1 bg-green-500/10">
                      ONLINE
                    </span>
                  </div>
                </div>

                <div className="absolute inset-0 bg-white/5 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out pointer-events-none" />
              </button>
            ))}
          </div>
        )}

        <footer className="mt-12 text-xs opacity-30 text-center">
          SYSTEM_READY... WAITING_FOR_INPUT...
        </footer>
      </div>
    </div>
  );
};

export default SelectSubject;
