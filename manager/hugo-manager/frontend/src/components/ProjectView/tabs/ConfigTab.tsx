import { models } from '../../../../wailsjs/go/models';
import ConfigEditor from '../../ConfigEditor/ConfigEditor';

type Project = models.Project;

interface ConfigTabProps {
  project: Project;
}

export default function ConfigTab({ project }: ConfigTabProps) {
  return (
    <div className="space-y-6">
      <ConfigEditor projectId={project.id} />
    </div>
  );
}

