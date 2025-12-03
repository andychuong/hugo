import { models } from '../../../../wailsjs/go/models';
import FileExplorer from '../../FileExplorer/FileExplorer';

type Project = models.Project;

interface FilesTabProps {
  project: Project;
}

export default function FilesTab({ project }: FilesTabProps) {
  return (
    <div className="h-full flex flex-col">
      <FileExplorer project={project} />
    </div>
  );
}

