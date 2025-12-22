'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Search,
  Filter,
  Plus,
  Loader2,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { CreateInternalModal } from '@/components/admin/create-internal-modal';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function AdminWorkspacesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [internalFilter, setInternalFilter] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-workspaces', { searchQuery, tierFilter, statusFilter, internalFilter, page }],
    queryFn: () => api.getAdminWorkspaces({
      search: searchQuery || undefined,
      tier: tierFilter || undefined,
      status: statusFilter || undefined,
      isInternal: internalFilter,
      page,
      limit: 20,
      sortBy: 'created_at',
      sortOrder: 'desc',
    }),
  });

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'business':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'pro':
        return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'trialing':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between opacity-0 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-8 h-8 text-purple-500" />
            <h1 className="text-4xl font-display font-bold">Workspaces</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Manage all platform workspaces and organizations
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Internal
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-border/50 bg-secondary/50 text-sm focus:bg-background focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        >
          <option value="">All Tiers</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-border/50 bg-secondary/50 text-sm focus:bg-background focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Canceled</option>
        </select>

        <select
          value={internalFilter === undefined ? '' : String(internalFilter)}
          onChange={(e) => setInternalFilter(e.target.value === '' ? undefined : e.target.value === 'true')}
          className="px-4 py-2 rounded-lg border border-border/50 bg-secondary/50 text-sm focus:bg-background focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        >
          <option value="">All Types</option>
          <option value="true">Internal Only</option>
          <option value="false">Customer Only</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg opacity-0 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : data?.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium mb-1">No workspaces found</p>
            <p className="text-sm text-muted-foreground">
              {searchQuery || tierFilter || statusFilter ? 'Try adjusting your filters' : 'No workspaces have been created yet'}
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-300">Workspace</TableHead>
                  <TableHead className="text-slate-300">Owner</TableHead>
                  <TableHead className="text-slate-300">Tier</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300 text-right">Members</TableHead>
                  <TableHead className="text-slate-300 text-right">Documents</TableHead>
                  <TableHead className="text-slate-300 text-right">Bots</TableHead>
                  <TableHead className="text-slate-300">Created</TableHead>
                  <TableHead className="text-slate-300"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((workspace) => (
                  <TableRow
                    key={workspace.id}
                    className="border-slate-700 hover:bg-slate-700/30"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            workspace.isInternal
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-violet-500/20 text-violet-400'
                          )}
                        >
                          {workspace.isInternal ? (
                            <Shield className="h-5 w-5" />
                          ) : (
                            <Building2 className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-100">{workspace.name}</p>
                          <p className="text-sm text-slate-400 font-mono">/{workspace.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-slate-100">{workspace.ownerName || 'Unknown'}</p>
                        <p className="text-xs text-slate-400">{workspace.ownerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getTierBadgeColor(workspace.tier)}>
                        {workspace.tier.charAt(0).toUpperCase() + workspace.tier.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(workspace.status)}>
                        {workspace.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-slate-100">{workspace.memberCount}</TableCell>
                    <TableCell className="text-right text-slate-100">{workspace.documentCount}</TableCell>
                    <TableCell className="text-right text-slate-100">{workspace.botCount}</TableCell>
                    <TableCell className="text-slate-400">
                      {new Date(workspace.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/workspaces/${workspace.id}`}>
                        <Button variant="ghost" size="sm" className="hover:text-purple-400">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-700">
                <p className="text-sm text-slate-400">
                  Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.total)} of {data.total} workspaces
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

      {/* Create Internal Workspace Modal */}
      <CreateInternalModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          refetch();
        }}
      />
    </div>
  );
}
