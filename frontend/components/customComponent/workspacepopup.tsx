'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X, Users } from 'lucide-react';
import { useNotifications } from '@/app/context/NotificationContext';

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
}

export function InviteDialog({ open, onClose }: InviteDialogProps) {
  const { invites, removeInvite , acceptInvite } = useNotifications();

  const handleAccept = (id: string,workspaceId: string,role : "admin" | "member") => {
    acceptInvite(id,workspaceId,role);
  };

  const handleReject = (id: string) => {
    removeInvite(id);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border border-slate-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Workspace Invites
          </DialogTitle>
        </DialogHeader>

        {invites.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            No pending invites
          </div>
        ) : (
          <div className="space-y-4">
            {invites.map((invite) => (
              //{console.log(invite.id);}
              <div
                key={invite.id}
                className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800"
              >
                <div>
                  <p className="font-medium text-white">
                    {invite.WorkspaceName}
                  </p>
                  <p className="text-xs text-gray-400">
                    Invited by {invite.invitedByEmail}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-green-400 hover:bg-green-400/10"
                    onClick={() => handleAccept(invite.id,invite.workspaceId,invite.role)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-400 hover:bg-red-400/10"
                    onClick={() => handleReject(invite.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
