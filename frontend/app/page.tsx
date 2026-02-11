'use client'
import { useRouter } from "next/navigation";
import { MessageSquare, FileText, Pencil, ArrowRight, Sparkles, Layers } from 'lucide-react';

// Landing Page Component
function LandingPage () {
  const router = useRouter(); 

  const onNavigate = (page : string) =>{
    router.push(page)
  }

  return(
  <div className="min-h-screen bg-slate-950">
    {/* Hero Section */}
    <div className="relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-linear-to-brrom-purple-900/20 via-transparent to-pink-900/20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl" />

      {/* Navbar */}
      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-linear-to-br from-purple-500 to-pink-500">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">CollabAI</span>
        </div>
        <button
          onClick={() => onNavigate('pages/auth/login')}
          className="px-6 py-2.5 bg-linear-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 font-medium"
        >
          Get Started
          <ArrowRight className="w-4 h-4" />
        </button>
      </nav>

      {/* Hero Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm mb-8">
          <Sparkles className="w-4 h-4" />
          Real-time collaboration for modern teams
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          One workspace.
          <br />
          <span className="bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Infinite possibilities.
          </span>
        </h1>

        <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          Chat, documents, and whiteboards — unified in one powerful platform. 
          Stop switching between apps and start collaborating.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={() => onNavigate('pages/auth/signup')}
            className="px-8 py-4 bg-linear-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 text-lg font-semibold"
          >
            Start for free
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>

    {/* Features Section */}
    <div className="max-w-7xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Everything you need, unified
        </h2>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          No more juggling between Slack, Notion, and Miro. CollabAI brings it all together.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {[
          { icon: MessageSquare, title: 'Real-time Chat', desc: 'Channel-based messaging with instant updates. Keep your team connected.' },
          { icon: FileText, title: 'Rich Documents', desc: 'Collaborative docs with rich formatting. Write together in real-time.' },
          { icon: Pencil, title: 'Visual Whiteboard', desc: 'Brainstorm and diagram together. Freehand drawing and shapes.' },
        ].map((feature, i) => (
          <div
            key={i}
            className="p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/30 transition-colors group"
          >
            <div className="p-3 rounded-xl bg-purple-500/10 w-fit mb-4 group-hover:bg-purple-500/20 transition-colors">
              <feature.icon className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
            <p className="text-gray-400">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Footer */}
    <footer className="border-t border-slate-800 py-8">
      <div className="max-w-7xl mx-auto px-6 text-center text-gray-500 text-sm">
        © 2025 CollabAI. Built for modern teams.
      </div>
    </footer>
  </div>
  );
}
export default LandingPage