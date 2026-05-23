"use client";

import { useState } from "react";
import Image from "next/image";
import { 
  Search, 
  MapPin, 
  Users, 
  BookOpen, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowRight,
  UserCircle
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { AnalysisResult } from "@/types";

export default function Home() {
  const [username, setUsername] = useState("");
  const [state, setState] = useState<"landing" | "loading" | "dashboard">("landing");
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setState("loading");
    setError("");
    
    const messages = [
      "Fetching repositories...",
      "Analyzing code patterns...",
      "Generating insights..."
    ];
    let step = 0;
    setLoadingMessage(messages[step]);
    
    const interval = setInterval(() => {
      step++;
      if (step < messages.length) {
        setLoadingMessage(messages[step]);
      }
    }, 2500);

    try {
      const res = await fetch(`/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      
      const data = await res.json();
      clearInterval(interval);
      
      if (!res.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setResult(data);
      setState("dashboard");
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || "An unexpected error occurred");
      setState("landing");
    }
  };

  if (state === "landing") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900 font-sans">
        <div className="max-w-2xl w-full space-y-10 text-center">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900">
              Developer Profile Analyzer
            </h1>
            <p className="text-xl text-slate-500 max-w-xl mx-auto">
              Get an instant, AI-powered evaluation of any GitHub developer's engineering skills, code quality, and career fit.
            </p>
          </div>
          
          <form onSubmit={handleAnalyze} className="relative max-w-md mx-auto">
            <div className="relative flex items-center shadow-sm">
              <Search className="absolute left-4 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter GitHub username"
                className="w-full bg-white border border-slate-300 rounded-lg py-4 pl-12 pr-32 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-lg"
              />
              <button
                type="submit"
                disabled={!username.trim()}
                className="absolute right-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-md font-medium transition-colors"
              >
                Analyze
              </button>
            </div>
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-left">{error}</span>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans flex flex-col">
        <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col justify-center items-center space-y-12 animate-pulse">
          
          <div className="text-2xl font-semibold text-blue-600 flex items-center gap-3">
            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            {loadingMessage}
          </div>

          <div className="w-full space-y-8 opacity-50">
            <div className="h-32 bg-slate-200 rounded-2xl w-full" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-8">
                <div className="h-64 bg-slate-200 rounded-2xl" />
                <div className="h-64 bg-slate-200 rounded-2xl" />
              </div>
              <div className="lg:col-span-2 space-y-8">
                <div className="h-24 bg-slate-200 rounded-2xl" />
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="h-48 bg-slate-200 rounded-2xl" />
                  <div className="h-48 bg-slate-200 rounded-2xl" />
                  <div className="h-48 bg-slate-200 rounded-2xl" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const { profile, scores, insights, user } = result;

  const radarData = [
    { subject: "Backend", A: scores.backend },
    { subject: "Frontend", A: scores.frontend },
    { subject: "DevOps", A: scores.devops },
    { subject: "Testing", A: scores.testing },
    { subject: "Consistency", A: scores.consistency },
    { subject: "Depth", A: scores.projectDepth },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (score >= 50) return "text-blue-600 bg-blue-50 border-blue-200";
    if (score >= 30) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <button 
          onClick={() => {
            setState("landing");
            setUsername("");
            setResult(null);
          }}
          className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1"
        >
          &larr; Analyze Another Profile
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative w-24 h-24 rounded-full border-4 border-slate-100 shadow-sm overflow-hidden bg-slate-100 shrink-0">
              <Image 
                src={user.avatar_url} 
                alt={user.name} 
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div className="text-center md:text-left space-y-2">
              <h1 className="text-3xl font-bold text-slate-900">{user.name}</h1>
              <p className="text-slate-500 flex items-center justify-center md:justify-start gap-1">
                <UserCircle className="w-4 h-4" /> @{profile.username}
              </p>
              <p className="text-slate-700 font-medium max-w-lg">{user.bio}</p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-sm text-slate-600">
                {user.location && (
                  <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400"/> {user.location}</span>
                )}
                <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-slate-400"/> {user.public_repos} Repos</span>
                <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-slate-400"/> {user.followers} Followers &middot; {user.following} Following</span>
              </div>
            </div>
          </div>
          
          <div className="text-center bg-slate-50 border border-slate-100 p-6 rounded-2xl min-w-[160px]">
            <div className={`text-5xl font-black ${getScoreColor(scores.overallScore).split(' ')[0]}`}>
              {scores.overallScore}
            </div>
            <div className="text-sm font-semibold text-slate-500 mt-2 uppercase tracking-wide">Overall Score</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-4 space-y-8">
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Skill Analysis</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Score"
                      dataKey="A"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="#3b82f6"
                      fillOpacity={0.2}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#0f172a', fontWeight: 600 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {profile.topLanguages.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Language Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profile.topLanguages} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 14, fontWeight: 500 }} />
                      <Tooltip 
                        cursor={{fill: '#f1f5f9'}} 
                        contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }} 
                        formatter={(value) => [`${value}%`, 'Usage']}
                      />
                      <Bar dataKey="percentage" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Engineering Maturity</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                {[
                  { label: "Automated Tests", value: profile.hasTests },
                  { label: "Docker Config", value: profile.hasDockerfile },
                  { label: "CI/CD Pipelines", value: profile.hasCICD },
                  { label: "Documentation", value: profile.hasReadme },
                  { label: "Live Deployments", value: profile.hasDeployment },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    {item.value ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-slate-300 shrink-0" />
                    )}
                    <span className={`text-sm font-medium ${item.value ? 'text-slate-700' : 'text-slate-400'}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="lg:col-span-8 space-y-8">
            
            <div className="bg-blue-600 text-white rounded-2xl shadow-md p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
              <h3 className="text-blue-100 font-semibold mb-2 uppercase tracking-wide text-sm">AI Executive Summary</h3>
              <p className="text-2xl font-medium leading-relaxed relative z-10">{insights.summary}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 shadow-sm">
                <h4 className="text-emerald-800 font-bold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Strengths
                </h4>
                <ul className="space-y-4">
                  {insights.strengths.map((str, i) => (
                    <li key={i} className="text-emerald-900/80 text-sm leading-relaxed flex items-start gap-2">
                      <span className="text-emerald-500 font-bold shrink-0">&bull;</span> {str}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 shadow-sm">
                <h4 className="text-rose-800 font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" /> Weaknesses
                </h4>
                <ul className="space-y-4">
                  {insights.weaknesses.map((wk, i) => (
                    <li key={i} className="text-rose-900/80 text-sm leading-relaxed flex items-start gap-2">
                      <span className="text-rose-500 font-bold shrink-0">&bull;</span> {wk}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 shadow-sm">
                <h4 className="text-blue-800 font-bold mb-4 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-blue-600" /> Action Items
                </h4>
                <ul className="space-y-4">
                  {insights.recommendations.map((rec, i) => (
                    <li key={i} className="text-blue-900/80 text-sm leading-relaxed flex items-start gap-2">
                      <span className="text-blue-500 font-bold shrink-0">&bull;</span> {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Career Role Alignment</h3>
              <div className="space-y-6">
                {insights.careerFit.map((fit, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="font-semibold text-slate-700">{fit.role}</span>
                      <span className="text-sm font-bold text-slate-500">{fit.confidence}% Match</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${fit.confidence}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
