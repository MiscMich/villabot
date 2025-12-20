'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Check,
  X,
  Trash2,
  Brain,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';

export default function KnowledgePage() {
  const queryClient = useQueryClient();

  const { data: facts, isLoading } = useQuery({
    queryKey: ['learnedFacts'],
    queryFn: api.getLearnedFacts,
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: boolean }) =>
      api.verifyFact(id, verified),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learnedFacts'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteFact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learnedFacts'] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-muted rounded-lg shimmer" />
          <div className="h-5 w-64 bg-muted rounded-lg shimmer" />
        </div>
        <div className="h-48 bg-muted rounded-xl shimmer" />
        <div className="h-64 bg-muted rounded-xl shimmer" />
      </div>
    );
  }

  const unverifiedFacts = facts?.facts.filter((f) => !f.is_verified) ?? [];
  const verifiedFacts = facts?.facts.filter((f) => f.is_verified) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="opacity-0 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="w-8 h-8 text-amber-500" />
          <h1 className="text-4xl font-display font-bold">Knowledge Base</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Review and manage facts learned from user corrections
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3 opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="premium-card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Review</p>
              <p className="text-3xl font-bold text-gradient">{unverifiedFacts.length}</p>
            </div>
          </div>
        </div>
        <div className="premium-card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Verified Facts</p>
              <p className="text-3xl font-bold text-gradient">{verifiedFacts.length}</p>
            </div>
          </div>
        </div>
        <div className="premium-card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600">
              <Lightbulb className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Knowledge</p>
              <p className="text-3xl font-bold text-gradient">{(facts?.facts.length ?? 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Review */}
      <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">Pending Review</h2>
              <p className="text-sm text-muted-foreground">Facts awaiting your approval</p>
            </div>
            <span className="ml-auto text-sm font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {unverifiedFacts.length} pending
            </span>
          </div>
        </div>
        <div className="p-6">
          {unverifiedFacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-lg font-medium mb-1">All caught up!</p>
              <p className="text-sm text-muted-foreground">No facts pending review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {unverifiedFacts.map((fact, index) => (
                <div
                  key={fact.id}
                  className="p-5 rounded-xl border-2 border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10 opacity-0 animate-fade-in"
                  style={{ animationDelay: `${250 + index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                          New Learning
                        </span>
                      </div>
                      <p className="text-foreground whitespace-pre-wrap leading-relaxed">{fact.fact}</p>
                      <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        Source: {fact.source} • {new Date(fact.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => verifyMutation.mutate({ id: fact.id, verified: true })}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="hover:border-red-500/50 hover:text-red-600"
                        onClick={() => {
                          if (confirm('Reject and delete this fact?')) {
                            deleteMutation.mutate(fact.id);
                          }
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Verified Facts */}
      <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">Verified Facts</h2>
              <p className="text-sm text-muted-foreground">Approved knowledge in use</p>
            </div>
            <span className="ml-auto text-sm font-medium px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {verifiedFacts.length} verified
            </span>
          </div>
        </div>
        <div className="divide-y divide-border/50">
          {verifiedFacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Brain className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium mb-1">No verified facts yet</p>
              <p className="text-sm text-muted-foreground">Approve pending facts to build your knowledge base</p>
            </div>
          ) : (
            verifiedFacts.map((fact, index) => (
              <div
                key={fact.id}
                className="p-5 hover:bg-secondary/30 transition-colors group opacity-0 animate-fade-in"
                style={{ animationDelay: `${350 + index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Verified
                      </span>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">{fact.fact}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Added {new Date(fact.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => {
                      if (confirm('Delete this fact?')) {
                        deleteMutation.mutate(fact.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
