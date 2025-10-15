import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { projectService } from '../services/api';
import { handleApiError } from '../lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { FolderPlus, Copy, RefreshCw, Trash2 } from 'lucide-react';

export default function ProjectsPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: projectService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully');
      setProjectName('');
      setShowCreateForm(false);
    },
    onError: (error) => {
      toast.error(handleApiError(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: projectService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted successfully');
      setDeleteConfirm(null);
    },
    onError: (error) => {
      toast.error(handleApiError(error));
    },
  });

  const regenerateKeyMutation = useMutation({
    mutationFn: projectService.regenerateApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('API key regenerated successfully');
    },
    onError: (error) => {
      toast.error(handleApiError(error));
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    createMutation.mutate(projectName);
  };

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      deleteMutation.mutate(id);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-gray-500 mt-1">Manage your BugSpotter projects</p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <FolderPlus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex gap-2">
              <Input
                placeholder="Project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" isLoading={createMutation.isPending}>
                Create
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects?.map((project) => (
            <Card key={project.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{project.name}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">API Key:</span>
                        <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">
                          {project.api_key}
                        </code>
                        <button
                          onClick={() => copyToClipboard(project.api_key)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-gray-600">
                        Created: {new Date(project.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-gray-600">
                        Reports: {project.report_count}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => regenerateKeyMutation.mutate(project.id)}
                      disabled={regenerateKeyMutation.isPending}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Regenerate Key
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(project.id)}
                      isLoading={deleteMutation.isPending && deleteConfirm === project.id}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      {deleteConfirm === project.id ? 'Confirm Delete?' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {projects?.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                No projects yet. Create your first project to get started.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
