// ChatView.tsx
import { useEffect, useState } from "react";
import { Send, Paperclip, Smile, AtSign, FileText, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "@/app/context/WebSocketProvider";

interface Message {
  id: string;
  user: {
    name: string;
    avatar: string;
  };
  content: string;
  timestamp: string;
  attachments?: {
    type: "document" | "whiteboard";
    name: string;
  }[];
}

type ChatViewProps = {
  workspaceId: string;
  channelId: string;
};

const mockMessages: Message[] = [
  {
    id: "1",
    user: { name: "Sarah Chen", avatar: "from-green-400 to-emerald-500" },
    content: "Hey team! I've finished the initial wireframes for the new dashboard. Let me know your thoughts.",
    timestamp: "10:23 AM",
    attachments: [
      { type: "whiteboard", name: "Dashboard Wireframes" },
    ],
  },
  {
    id: "2",
    user: { name: "Alex Rivera", avatar: "from-orange-400 to-red-500" },
    content: "These look great, Sarah! I especially like the sidebar navigation. I've added some notes in the design doc.",
    timestamp: "10:28 AM",
    attachments: [
      { type: "document", name: "Design Feedback Notes" },
    ],
  },
  {
    id: "3",
    user: { name: "Jordan Kim", avatar: "from-blue-400 to-indigo-500" },
    content: "Quick question - are we still planning to launch the beta next week? I want to make sure the backend is ready.",
    timestamp: "10:34 AM",
  },
  {
    id: "4",
    user: { name: "Sarah Chen", avatar: "from-green-400 to-emerald-500" },
    content: "Yes! Let's sync up this afternoon to go over the timeline. I'll create a quick planning board.",
    timestamp: "10:36 AM",
  },
];

export const ChatView = ({ workspaceId, channelId }: ChatViewProps) => {
  const [message, setMessage] = useState("");
  const { sendMessage } = useWebSocket();

  const handleClick = () => {
    sendMessage({
      type: "message:send",
      data: {
        channelId,
        userId: "CURRENT_USER_ID", // get from auth context
        content: message,
      },
    });

    setMessage("");
  };


  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {mockMessages.map((msg, index) => (
          <div
            key={msg.id}
            className="flex gap-3 animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className={`w-10 h-10 rounded-full bg-linear-to-br ${msg.user.avatar} shrink-0 flex items-center justify-center text-white font-semibold text-sm`}>
              {msg.user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-white">{msg.user.name}</span>
                <span className="text-xs text-gray-400">{msg.timestamp}</span>
              </div>
              <p className="mt-1 text-gray-300">{msg.content}</p>

              {/* Attachments */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.attachments.map((attachment, i) => (
                    <button
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 transition-colors w-full max-w-md text-left group"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${attachment.type === "document"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-green-500/20 text-green-400"
                        }`}>
                        {attachment.type === "document" ? (
                          <FileText className="w-5 h-5" />
                        ) : (
                          <PenTool className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-white group-hover:text-purple-300 transition-colors">
                          {attachment.name}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">
                          {attachment.type}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-900 rounded-xl border border-slate-700 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
          <div className="flex items-center gap-2 px-4 py-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-transparent outline-none placeholder:text-gray-500 text-white"
            />
          </div>
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                <Paperclip className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                <AtSign className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-800">
                <Smile className="w-4 h-4" />
              </Button>
              <div className="w-px h-4 bg-slate-700 mx-1" />
              <Button variant="ghost" size="icon" className="text-blue-400 hover:bg-blue-500/10">
                <FileText className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-green-400 hover:bg-green-500/10">
                <PenTool className="w-4 h-4" />
              </Button>
            </div>
            <Button
              size="sm"
              disabled={!message.trim()}
              onClick={handleClick}
              className="bg-linear-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};