// Type definitions for Hugo Manager

export interface Project {
  id: string;
  name: string;
  path: string;
  hugoVersion: string;
  config?: Config;
  status?: Status;
  lastBuild: string; // ISO date string
  createdAt: string; // ISO date string
  themes: Theme[];
}

export interface Config {
  baseURL: string;
  title: string;
  environment: string;
  publishDir: string;
  themes: string[];
  languages: string[];
  params: Record<string, any>;
  visualEditing?: VisualEditingConfig;
}

export interface VisualEditingConfig {
  enabled: boolean;
  apiEndpoint: string;
  injectAttrs: boolean;
  fieldMapping: Record<string, string>;
  excludeKinds: string[];
}

export interface Status {
  isBuilding: boolean;
  isServing: boolean;
  serverUrl: string;
  serverPort: number;
  hasErrors: boolean;
  errorMessage: string;
  visualEditing: boolean;
}

export interface Theme {
  id: string;
  name: string;
  path: string;
  githubPath: string;
  description: string;
  tags: string[];
  screenshot: string;
  minVersion: string;
  author: string;
  license: string;
  installed: boolean;
  version: string;
  installedAt: string;
  localPath: string;
}

export interface AppError {
  code: string;
  message: string;
  details?: string;
}

export interface Build {
  id: string;
  projectId: string;
  status: string; // "running", "success", "failed", "cancelled"
  startTime: string; // ISO date string
  endTime: string; // ISO date string
  duration: number; // milliseconds
  output: string;
  error: string;
  filesGenerated: number;
}

export interface BuildOptions {
  environment: string; // "development", "production"
  draft: boolean;
  future: boolean;
  expired: boolean;
  minify: boolean;
  verbose: boolean;
  extraArgs: string[];
}

export interface BuildStatusResponse {
  buildId: string;
  status: string; // "running", "success", "failed", "cancelled"
  progress: number; // 0-100
  logs: string[];
  startTime: string; // ISO date string
  endTime: string; // ISO date string
  error: string;
}

export interface ServerInfo {
  projectId: string;
  isRunning: boolean;
  url: string;
  port: number;
  pid: number;
  startTime: string; // ISO date string
}

export interface ServerOptions {
  port: number;
  baseURL: string;
  buildDrafts: boolean;
  buildFuture: boolean;
  buildExpired: boolean;
  disableLiveReload: boolean;
}

export interface Content {
  id: string;
  path: string;
  title: string;
  content: string;
  frontMatter: Record<string, any>;
  format: string; // "yaml", "toml", "json"
  isDraft: boolean;
  isFuture: boolean;
  isExpired: boolean;
  modTime: string; // ISO date string
  size: number;
}

export interface ContentList {
  items: Content[];
  total: number;
  path: string;
  isContentDir: boolean;
}

export interface ContentOptions {
  title: string;
  path: string;
  content: string;
  frontMatter: Record<string, any>;
  format: string; // "yaml", "toml", "json"
  isDraft: boolean;
  archetype: string;
}

export interface Archetype {
  name: string;
  path: string;
  frontMatter: Record<string, any>;
  content: string;
}

