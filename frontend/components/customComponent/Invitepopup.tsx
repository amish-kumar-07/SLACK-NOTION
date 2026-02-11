'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, User, Send, UserPlus, Shield } from 'lucide-react';

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  onInvite: (name: string, email: string, role: 'admin' | 'member') => void;
  roomName?: string;
}

export function InviteBox({ open, onClose, onInvite, roomName }: InviteDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    
    setIsSubmitting(true);
    await onInvite(name, email, role);
    
    // Reset form
    setName('');
    setEmail('');
    setRole('member');
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border border-slate-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-purple-400" />
            Invite to Room
          </DialogTitle>
          {roomName && (
            <p className="text-sm text-gray-400 mt-1">
              Invite someone to join <span className="text-purple-400 font-medium">{roomName}</span>
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name Input */}
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-300">
              Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter their name"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          {/* Email Input */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="their.email@example.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('member')}
                className={`p-3 rounded-xl border transition-all ${
                  role === 'member'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                    : 'bg-slate-950 border-slate-800 text-gray-400 hover:border-slate-700'
                }`}
              >
                <User className="w-4 h-4 mx-auto mb-1" />
                <span className="text-sm font-medium">Member</span>
              </button>
              
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`p-3 rounded-xl border transition-all ${
                  role === 'admin'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                    : 'bg-slate-950 border-slate-800 text-gray-400 hover:border-slate-700'
                }`}
              >
                <Shield className="w-4 h-4 mx-auto mb-1" />
                <span className="text-sm font-medium">Admin</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 bg-slate-800 text-gray-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim() || !email.trim()}
              className="flex-1 bg-linear-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Invite
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}