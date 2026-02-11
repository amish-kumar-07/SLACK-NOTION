// DocumentsView.tsx
import { useState } from "react";
import { 
  Bold, Italic, Underline, List, ListOrdered, Quote, 
  Image, Link, Code, PenTool, MessageSquare, ChevronRight,
  MoreHorizontal, Clock, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Comment {
  id: string;
  user: string;
  text: string;
  time: string;
}

const mockComments: Comment[] = [
  { id: "1", user: "Alex", text: "Great section! Maybe add more details about the timeline?", time: "2h ago" },
  { id: "2", user: "Jordan", text: "I've added some technical specs below.", time: "1h ago" },
];

export const DocumentsView = () => {
  const [showComments, setShowComments] = useState(true);

  return (
    <div className="flex h-full bg-slate-950">
      {/* Document Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="border-b border-slate-800 p-3">
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-900">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                <Bold className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                <Italic className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                <Underline className="w-4 h-4" />
              </Button>
            </div>
            <div className="w-px h-6 bg-slate-700 mx-2" />
            <div className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-900">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                <List className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                <ListOrdered className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                <Quote className="w-4 h-4" />
              </Button>
            </div>
            <div className="w-px h-6 bg-slate-700 mx-2" />
            <div className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-900">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                <Link className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                <Image className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                <Code className="w-4 h-4" />
              </Button>
            </div>
            <div className="w-px h-6 bg-slate-700 mx-2" />
            <Button variant="ghost" size="sm" className="text-green-400 hover:bg-green-500/10 gap-2">
              <PenTool className="w-4 h-4" />
              Embed Whiteboard
            </Button>
            <div className="flex-1" />
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Last edited 5 min ago</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className={`text-gray-400 hover:text-white ${showComments ? "bg-slate-800" : ""}`}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Comments
            </Button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>Design</span>
              <ChevronRight className="w-4 h-4" />
              <span>Product Specs</span>
            </div>
            
            <h1 className="text-4xl font-bold tracking-tight text-white">
              Project Roadmap 2024
            </h1>
            
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-linear-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-xs font-semibold">
                  S
                </div>
                <span>Sarah Chen</span>
              </div>
              <span>•</span>
              <span>Jan 10, 2024</span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>3 collaborators</span>
              </div>
            </div>

            <div className="prose prose-lg max-w-none">
              <p className="text-lg text-gray-300 leading-relaxed">
                This document outlines our product roadmap for 2024, including key milestones, 
                feature releases, and strategic initiatives.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">Q1 Objectives</h2>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-gray-300">
                  <div className="w-5 h-5 rounded border-2 border-purple-500 mt-0.5" />
                  <span>Launch collaborative whiteboard feature</span>
                </li>
                <li className="flex items-start gap-2 text-gray-300">
                  <div className="w-5 h-5 rounded border-2 border-purple-500 mt-0.5 bg-purple-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="line-through text-gray-500">Complete design system overhaul</span>
                </li>
                <li className="flex items-start gap-2 text-gray-300">
                  <div className="w-5 h-5 rounded border-2 border-purple-500 mt-0.5" />
                  <span>Improve real-time sync performance</span>
                </li>
              </ul>

              {/* Embedded Whiteboard Preview */}
              <div className="my-8 rounded-xl border border-slate-700 overflow-hidden group cursor-pointer hover:border-slate-600 transition-colors">
                <div className="bg-slate-900 p-3 border-b border-slate-700 flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-white">System Architecture Diagram</span>
                  <span className="text-xs text-gray-400">• Whiteboard</span>
                </div>
                <div className="aspect-video bg-linear-to-br from-slate-900 to-slate-950 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <PenTool className="w-10 h-10 text-green-400" />
                      </div>
                      <p className="text-sm text-gray-400">Click to open whiteboard</p>
                    </div>
                  </div>
                  {/* Decorative shapes */}
                  <div className="absolute top-8 left-8 w-32 h-20 rounded-lg border-2 border-dashed border-blue-500/30" />
                  <div className="absolute top-16 right-16 w-24 h-24 rounded-full border-2 border-dashed border-green-500/30" />
                  <div className="absolute bottom-12 left-1/3 w-40 h-16 rounded-lg border-2 border-dashed border-purple-500/30" />
                </div>
              </div>

              <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">Timeline</h2>
              <p className="text-gray-300">
                Our development timeline is structured around bi-weekly sprints with major releases 
                planned for the end of each month.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comments Panel */}
      {showComments && (
        <div className="w-80 border-l border-slate-800 bg-slate-900 flex flex-col animate-fade-in">
          <div className="p-4 border-b border-slate-800">
            <h3 className="font-semibold text-white">Comments</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {mockComments.map((comment) => (
              <div key={comment.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-linear-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold">
                      {comment.user.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-white">{comment.user}</span>
                  </div>
                  <span className="text-xs text-gray-400">{comment.time}</span>
                </div>
                <p className="text-sm text-gray-300 pl-8">{comment.text}</p>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-800">
            <textarea
              placeholder="Add a comment..."
              className="w-full h-20 p-3 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white placeholder:text-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <Button className="w-full mt-2 bg-linear-to-r from-purple-500 to-pink-500 text-white hover:opacity-90" size="sm">
              Post Comment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};