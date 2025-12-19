'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Check, X, Trash2, Brain } from 'lucide-react';

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
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const unverifiedFacts = facts?.facts.filter((f) => !f.is_verified) ?? [];
  const verifiedFacts = facts?.facts.filter((f) => f.is_verified) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Knowledge Base</h1>
        <p className="text-muted-foreground">
          Review and manage facts learned from user corrections
        </p>
      </div>

      {/* Pending Review */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Pending Review ({unverifiedFacts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unverifiedFacts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No facts pending review
            </p>
          ) : (
            <div className="space-y-4">
              {unverifiedFacts.map((fact) => (
                <div
                  key={fact.id}
                  className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap">{fact.fact}</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Source: {fact.source} &bull;{' '}
                        {new Date(fact.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          verifyMutation.mutate({ id: fact.id, verified: true })
                        }
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
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
        </CardContent>
      </Card>

      {/* Verified Facts */}
      <Card>
        <CardHeader>
          <CardTitle>Verified Facts ({verifiedFacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {verifiedFacts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No verified facts yet
            </p>
          ) : (
            <div className="space-y-4">
              {verifiedFacts.map((fact) => (
                <div
                  key={fact.id}
                  className="p-4 rounded-lg border flex items-start justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="success">Verified</Badge>
                    </div>
                    <p className="whitespace-pre-wrap">{fact.fact}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {new Date(fact.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm('Delete this fact?')) {
                        deleteMutation.mutate(fact.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
