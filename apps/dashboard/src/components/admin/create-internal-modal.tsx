'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Shield, CheckCircle } from 'lucide-react';

interface CreateInternalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateInternalModal({ isOpen, onClose }: CreateInternalModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    ownerEmail: '',
    notes: '',
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const createMutation = useMutation({
    mutationFn: api.createInternalWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-workspaces'] });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        handleClose();
      }, 2000);
    },
  });

  const handleClose = () => {
    setFormData({ name: '', ownerEmail: '', notes: '' });
    setShowSuccess(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.ownerEmail) {
      createMutation.mutate(formData);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700">
        {showSuccess ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-100 mb-2">Workspace Created!</h3>
            <p className="text-sm text-slate-400">Internal workspace created successfully</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <DialogTitle className="text-slate-100">Create Internal Workspace</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Create a workspace for internal testing or demos
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">
                    Workspace Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g., Internal Testing, Demo Account"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ownerEmail" className="text-slate-300">
                    Owner Email <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="ownerEmail"
                    type="email"
                    placeholder="user@example.com"
                    value={formData.ownerEmail}
                    onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                    required
                    className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-400">
                    Email must exist in the system. User will become workspace owner.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-slate-300">
                    Internal Notes
                  </Label>
                  <textarea
                    id="notes"
                    placeholder="Purpose, team, or any relevant notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-md bg-slate-900/50 border border-slate-600 text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>

                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <h4 className="text-sm font-medium text-purple-400 mb-2">Internal Workspace Benefits</h4>
                  <ul className="text-xs text-slate-300 space-y-1">
                    <li>• No billing or subscription required</li>
                    <li>• Unlimited usage and features</li>
                    <li>• Perfect for testing and demos</li>
                    <li>• Clearly marked in admin panel</li>
                  </ul>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={createMutation.isPending}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !formData.name || !formData.ownerEmail}
                  className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Create Internal Workspace
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
