import { useState, useEffect } from 'react';
import { 
  GetAllProjectGroups,
  CreateProjectGroup,
  UpdateProjectGroup,
  DeleteProjectGroup,
  ExecuteBulkOperation,
  GetBulkOperation,
  GetAllProjectTemplates,
  CreateProjectTemplate,
  DeleteProjectTemplate,
  CloneProject,
  GetProjects
} from '../../../wailsjs/go/handlers/App';
import { models } from '../../../wailsjs/go/models';
import { useToast } from '../../hooks/useToast';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Input from '../ui/Input';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';

type ProjectGroup = models.ProjectGroup;
type BulkOperation = models.BulkOperation;
type ProjectTemplate = models.ProjectTemplate;
type Project = models.Project;

export default function MultiSiteManager() {
  const [activeTab, setActiveTab] = useState<'groups' | 'bulk' | 'templates' | 'clone'>('groups');
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsData, projectsData, templatesData] = await Promise.all([
        GetAllProjectGroups(),
        GetProjects(),
        GetAllProjectTemplates()
      ]);
      setGroups(groupsData || []);
      setProjects(projectsData || []);
      setTemplates(templatesData || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'groups' as const, label: 'Project Groups' },
    { id: 'bulk' as const, label: 'Bulk Operations' },
    { id: 'templates' as const, label: 'Templates' },
    { id: 'clone' as const, label: 'Clone Project' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-hugo-text-primary">Multi-Site Operations</h2>
        <p className="text-sm text-hugo-text-tertiary mt-1">
          Manage multiple projects, groups, and templates
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-hugo-border-default">
        <div className="flex gap-0">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${index === 0 ? 'pl-0' : 'pl-3'} pr-3 py-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-hugo-accent-teal text-hugo-accent-teal'
                  : 'text-hugo-text-tertiary hover:text-hugo-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'groups' && (
          <ProjectGroupsTab 
            groups={groups} 
            projects={projects}
            onUpdate={loadData}
          />
        )}
        {activeTab === 'bulk' && (
          <BulkOperationsTab 
            projects={projects}
          />
        )}
        {activeTab === 'templates' && (
          <TemplatesTab 
            templates={templates}
            onUpdate={loadData}
          />
        )}
        {activeTab === 'clone' && (
          <CloneProjectTab 
            projects={projects}
            onClone={loadData}
          />
        )}
      </div>
    </div>
  );
}

// Project Groups Tab
function ProjectGroupsTab({ groups, projects, onUpdate }: { groups: ProjectGroup[], projects: Project[], onUpdate: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const toast = useToast();

  const handleCreate = async () => {
    try {
      await CreateProjectGroup(groupName, groupDescription, selectedProjects);
      toast.success('Project group created');
      setShowCreate(false);
      setGroupName('');
      setGroupDescription('');
      setSelectedProjects([]);
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create group');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-hugo-text-primary">Project Groups</h3>
        <Button onClick={() => setShowCreate(true)} variant="primary">
          + New Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No project groups"
          description="Create a group to organize your projects"
          action={{
            label: "Create Group",
            onClick: () => setShowCreate(true)
          }}
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-semibold text-hugo-text-primary">{group.name}</h4>
                  {group.description && (
                    <p className="text-sm text-hugo-text-secondary mt-1">{group.description}</p>
                  )}
                  <div className="text-sm text-hugo-text-tertiary mt-2">
                    {group.projectIds.length} project{group.projectIds.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={async () => {
                  if (confirm('Delete this group?')) {
                    try {
                      await DeleteProjectGroup(group.id);
                      toast.success('Group deleted');
                      onUpdate();
                    } catch (err: any) {
                      toast.error(err.message || 'Failed to delete group');
                    }
                  }
                }}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-hugo-text-primary mb-4">Create Project Group</h3>
            <div className="space-y-4">
              <Input
                label="Group Name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <Input
                label="Description"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-hugo-text-secondary mb-2">
                  Select Projects
                </label>
                <div className="max-h-48 overflow-y-auto border border-hugo-border-default rounded p-2 space-y-2">
                  {projects.map((project) => (
                    <label key={project.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedProjects.includes(project.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProjects([...selectedProjects, project.id]);
                          } else {
                            setSelectedProjects(selectedProjects.filter(id => id !== project.id));
                          }
                        }}
                      />
                      <span className="text-sm text-hugo-text-primary">{project.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => setShowCreate(false)} variant="secondary">Cancel</Button>
                <Button onClick={handleCreate} variant="primary">Create</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Bulk Operations Tab
function BulkOperationsTab({ projects }: { projects: Project[] }) {
  const [operationType, setOperationType] = useState<'build' | 'deploy'>('build');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [executing, setExecuting] = useState(false);
  const toast = useToast();

  const handleExecute = async () => {
    if (selectedProjects.length === 0) {
      toast.error('Please select at least one project');
      return;
    }

    setExecuting(true);
    try {
      const operation = await ExecuteBulkOperation(operationType, selectedProjects, {});
      toast.success(`Bulk operation started: ${operation.id}`);
      // Poll for status
      const checkStatus = async () => {
        try {
          const status = await GetBulkOperation(operation.id);
          if (status.status === 'completed' || status.status === 'failed') {
            toast.success(`Bulk operation ${status.status}`);
            setExecuting(false);
          } else {
            setTimeout(checkStatus, 2000);
          }
        } catch (err) {
          setExecuting(false);
        }
      };
      setTimeout(checkStatus, 2000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to execute bulk operation');
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-hugo-text-primary">Bulk Operations</h3>
      
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-hugo-text-secondary mb-2">
              Operation Type
            </label>
            <select
              className="w-full px-3 py-2 bg-hugo-bg-secondary border border-hugo-border-default rounded text-hugo-text-primary"
              value={operationType}
              onChange={(e) => setOperationType(e.target.value as 'build' | 'deploy')}
            >
              <option value="build">Build</option>
              <option value="deploy">Deploy</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-hugo-text-secondary mb-2">
              Select Projects
            </label>
            <div className="max-h-64 overflow-y-auto border border-hugo-border-default rounded p-2 space-y-2">
              {projects.map((project) => (
                <label key={project.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedProjects.includes(project.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProjects([...selectedProjects, project.id]);
                      } else {
                        setSelectedProjects(selectedProjects.filter(id => id !== project.id));
                      }
                    }}
                  />
                  <span className="text-sm text-hugo-text-primary">{project.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Button
            onClick={handleExecute}
            variant="primary"
            disabled={executing || selectedProjects.length === 0}
          >
            {executing ? 'Executing...' : `Execute ${operationType} on ${selectedProjects.length} project(s)`}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Templates Tab
function TemplatesTab({ templates, onUpdate }: { templates: ProjectTemplate[], onUpdate: () => void }) {
  const toast = useToast();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-hugo-text-primary">Project Templates</h3>
        <Button variant="primary">+ New Template</Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates"
          description="Create templates to quickly set up new projects"
        />
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <Card key={template.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-hugo-text-primary">{template.name}</h4>
                  {template.description && (
                    <p className="text-sm text-hugo-text-secondary mt-1">{template.description}</p>
                  )}
                </div>
                <Button variant="danger" size="sm" onClick={async () => {
                  if (confirm('Delete this template?')) {
                    try {
                      await DeleteProjectTemplate(template.id);
                      toast.success('Template deleted');
                      onUpdate();
                    } catch (err: any) {
                      toast.error(err.message || 'Failed to delete template');
                    }
                  }
                }}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Clone Project Tab
function CloneProjectTab({ projects, onClone }: { projects: Project[], onClone: () => void }) {
  const [sourceProject, setSourceProject] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');
  const [copyContent, setCopyContent] = useState(true);
  const [copyConfig, setCopyConfig] = useState(true);
  const [cloning, setCloning] = useState(false);
  const toast = useToast();

  const handleClone = async () => {
    if (!sourceProject || !newName || !newPath) {
      toast.error('Please fill in all fields');
      return;
    }

    setCloning(true);
    try {
      const options = models.CloneOptions.createFrom({
        newName,
        newPath,
        copyContent,
        copyConfig,
      });
      await CloneProject(sourceProject, options);
      toast.success('Project cloned successfully');
      setSourceProject('');
      setNewName('');
      setNewPath('');
      onClone();
    } catch (err: any) {
      toast.error(err.message || 'Failed to clone project');
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-hugo-text-primary">Clone Project</h3>
      
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-hugo-text-secondary mb-2">
              Source Project
            </label>
            <select
              className="w-full px-3 py-2 bg-hugo-bg-secondary border border-hugo-border-default rounded text-hugo-text-primary"
              value={sourceProject}
              onChange={(e) => setSourceProject(e.target.value)}
            >
              <option value="">Select a project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <Input
            label="New Project Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />

          <Input
            label="New Project Path"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            helperText="Directory where the cloned project will be created"
          />

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={copyContent}
                onChange={(e) => setCopyContent(e.target.checked)}
              />
              <span className="text-sm text-hugo-text-primary">Copy content directory</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={copyConfig}
                onChange={(e) => setCopyConfig(e.target.checked)}
              />
              <span className="text-sm text-hugo-text-primary">Copy configuration files</span>
            </label>
          </div>

          <Button
            onClick={handleClone}
            variant="primary"
            disabled={cloning || !sourceProject || !newName || !newPath}
          >
            {cloning ? 'Cloning...' : 'Clone Project'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

