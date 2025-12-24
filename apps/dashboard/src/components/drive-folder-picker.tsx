'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Check,
  Home,
  AlertCircle,
} from 'lucide-react';

export interface SelectedFolder {
  id: string;
  name: string;
  path?: string;
}

interface DriveFolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folders: SelectedFolder[]) => void;
  selectedFolders?: SelectedFolder[];
  maxSelections?: number;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export function DriveFolderPicker({
  isOpen,
  onClose,
  onSelect,
  selectedFolders = [],
  maxSelections = 10,
}: DriveFolderPickerProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [selected, setSelected] = useState<Map<string, SelectedFolder>>(
    new Map(selectedFolders.map(f => [f.id, f]))
  );

  // Fetch folders in current directory
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['drive-folders', currentFolderId],
    queryFn: () => api.getDriveFolders(currentFolderId),
    enabled: isOpen,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Navigate into a folder
  const handleNavigate = useCallback((folder: { id: string; name: string }) => {
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
  }, []);

  // Navigate back using breadcrumbs
  const handleBreadcrumbClick = useCallback((index: number) => {
    if (index === -1) {
      // Home/root
      setBreadcrumbs([]);
      setCurrentFolderId(undefined);
    } else {
      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
      setBreadcrumbs(newBreadcrumbs);
      setCurrentFolderId(newBreadcrumbs[index].id);
    }
  }, [breadcrumbs]);

  // Navigate up one level
  const handleGoBack = useCallback(() => {
    if (breadcrumbs.length === 0) return;
    const newBreadcrumbs = breadcrumbs.slice(0, -1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolderId(newBreadcrumbs.length > 0 ? newBreadcrumbs[newBreadcrumbs.length - 1].id : undefined);
  }, [breadcrumbs]);

  // Toggle folder selection
  const handleToggleSelect = useCallback((folder: { id: string; name: string }) => {
    setSelected(prev => {
      const newSelected = new Map(prev);
      if (newSelected.has(folder.id)) {
        newSelected.delete(folder.id);
      } else if (newSelected.size < maxSelections) {
        // Build the full path from breadcrumbs
        const path = breadcrumbs.map(b => b.name).join(' / ');
        newSelected.set(folder.id, {
          id: folder.id,
          name: folder.name,
          path: path ? `${path} / ${folder.name}` : folder.name,
        });
      }
      return newSelected;
    });
  }, [breadcrumbs, maxSelections]);

  // Confirm selection
  const handleConfirm = useCallback(() => {
    onSelect(Array.from(selected.values()));
    onClose();
  }, [selected, onSelect, onClose]);

  // Cancel and reset
  const handleCancel = useCallback(() => {
    setSelected(new Map(selectedFolders.map(f => [f.id, f])));
    setBreadcrumbs([]);
    setCurrentFolderId(undefined);
    onClose();
  }, [selectedFolders, onClose]);

  const folders = data?.folders ?? [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-blue-500" />
            Select Google Drive Folders
          </DialogTitle>
          <DialogDescription>
            Choose folders to sync with your bot&apos;s knowledge base.
            {maxSelections > 1 && ` You can select up to ${maxSelections} folders.`}
          </DialogDescription>
        </DialogHeader>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1 px-1 py-2 bg-secondary/50 rounded-lg text-sm overflow-x-auto">
          <button
            onClick={() => handleBreadcrumbClick(-1)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-secondary transition-colors shrink-0"
          >
            <Home className="h-4 w-4" />
            <span>My Drive</span>
          </button>
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className="px-2 py-1 rounded hover:bg-secondary transition-colors truncate max-w-[150px]"
                title={crumb.name}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        {/* Folder List */}
        <div className="flex-1 overflow-y-auto min-h-[300px] border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">
                {error instanceof Error && error.message.includes('expired')
                  ? 'Google Drive authorization expired. Please reconnect in Settings.'
                  : 'Failed to load folders. Please try again.'}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
              <Folder className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No folders found</p>
            </div>
          ) : (
            <div className="divide-y">
              {breadcrumbs.length > 0 && (
                <button
                  onClick={handleGoBack}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-secondary/50 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground">Go back</span>
                </button>
              )}
              {folders.map((folder) => {
                const isSelected = selected.has(folder.id);
                return (
                  <div
                    key={folder.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                  >
                    {/* Selection checkbox */}
                    <button
                      onClick={() => handleToggleSelect(folder)}
                      className={`flex items-center justify-center w-5 h-5 rounded border transition-colors ${
                        isSelected
                          ? 'bg-violet-600 border-violet-600 text-white'
                          : 'border-border hover:border-violet-400'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </button>

                    {/* Folder icon and name */}
                    <Folder className="h-5 w-5 text-blue-500 shrink-0" />
                    <span className="flex-1 truncate" title={folder.name}>
                      {folder.name}
                    </span>

                    {/* Navigate into folder */}
                    <button
                      onClick={() => handleNavigate(folder)}
                      className="p-1 rounded hover:bg-secondary transition-colors"
                      title="Open folder"
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected folders summary */}
        {selected.size > 0 && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selected.size}</span> folder{selected.size !== 1 ? 's' : ''} selected
            {selected.size >= maxSelections && (
              <span className="text-amber-500 ml-2">(maximum reached)</span>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
          >
            Select {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
