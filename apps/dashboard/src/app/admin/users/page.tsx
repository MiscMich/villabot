'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Users,
  Search,
  Loader2,
  Shield,
  User,
  Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminUsersPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [adminFilter, setAdminFilter] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', { searchQuery, adminFilter, page }],
    queryFn: () => api.getAdminUsers({
      search: searchQuery || undefined,
      isAdmin: adminFilter,
      page,
      limit: 20,
    }),
  });

  const toggleAdminMutation = useMutation({
    mutationFn: ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) =>
      api.toggleAdminStatus(userId, isAdmin),
    onSuccess: (_, { isAdmin }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: isAdmin ? 'Admin Access Granted' : 'Admin Access Revoked',
        description: `User has been ${isAdmin ? 'granted' : 'revoked'} platform admin access.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleToggleAdmin = (userId: string, currentStatus: boolean) => {
    // Prevent self-demotion
    if (userId === profile?.id && currentStatus) {
      toast({
        title: 'Action Not Allowed',
        description: 'You cannot remove your own admin status.',
        variant: 'destructive',
      });
      return;
    }

    toggleAdminMutation.mutate({ userId, isAdmin: !currentStatus });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between opacity-0 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-purple-500" />
            <h1 className="text-4xl font-display font-bold">Users</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Manage platform users and admin access
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search users by email or name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>

        <select
          value={adminFilter === undefined ? '' : String(adminFilter)}
          onChange={(e) => {
            setAdminFilter(e.target.value === '' ? undefined : e.target.value === 'true');
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg border border-border/50 bg-secondary/50 text-sm focus:bg-background focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        >
          <option value="">All Users</option>
          <option value="true">Admins Only</option>
          <option value="false">Regular Users</option>
        </select>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 md:grid-cols-3 opacity-0 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Users</p>
              <p className="text-2xl font-bold text-slate-100">{data?.total ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Crown className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Platform Admins</p>
              <p className="text-2xl font-bold text-slate-100">
                {data?.data.filter(u => u.isPlatformAdmin).length ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <User className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Regular Users</p>
              <p className="text-2xl font-bold text-slate-100">
                {data?.data.filter(u => !u.isPlatformAdmin).length ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : data?.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium mb-1">No users found</p>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'Try adjusting your search' : 'No users have registered yet'}
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-300">User</TableHead>
                  <TableHead className="text-slate-300">Role</TableHead>
                  <TableHead className="text-slate-300">Joined</TableHead>
                  <TableHead className="text-slate-300">Last Active</TableHead>
                  <TableHead className="text-slate-300 text-right">Admin Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((user) => (
                  <TableRow
                    key={user.id}
                    className="border-slate-700 hover:bg-slate-700/30"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center',
                            user.isPlatformAdmin
                              ? 'bg-gradient-to-br from-purple-400 to-purple-600'
                              : 'bg-slate-700'
                          )}
                        >
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.fullName || user.email}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <User className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-100">
                            {user.fullName || 'Unknown User'}
                          </p>
                          <p className="text-sm text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.isPlatformAdmin ? (
                        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          <Shield className="h-3 w-3 mr-1" />
                          Platform Admin
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400">
                          <User className="h-3 w-3 mr-1" />
                          User
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {user.lastSignInAt
                        ? new Date(user.lastSignInAt).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.id === profile?.id && (
                          <span className="text-xs text-slate-400">(You)</span>
                        )}
                        <Switch
                          checked={user.isPlatformAdmin}
                          onCheckedChange={() => handleToggleAdmin(user.id, user.isPlatformAdmin)}
                          disabled={
                            toggleAdminMutation.isPending ||
                            (user.id === profile?.id && user.isPlatformAdmin)
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-700">
                <p className="text-sm text-slate-400">
                  Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.total)} of {data.total} users
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-slate-400">
                    Page {page} of {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
