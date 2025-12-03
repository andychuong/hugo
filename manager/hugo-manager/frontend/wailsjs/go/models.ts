export namespace models {
	
	export class Archetype {
	    name: string;
	    path: string;
	    frontMatter: Record<string, any>;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new Archetype(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.frontMatter = source["frontMatter"];
	        this.content = source["content"];
	    }
	}
	export class Build {
	    id: string;
	    projectId: string;
	    status: string;
	    // Go type: time
	    startTime: any;
	    // Go type: time
	    endTime: any;
	    duration: number;
	    output: string;
	    error: string;
	    filesGenerated: number;
	
	    static createFrom(source: any = {}) {
	        return new Build(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.projectId = source["projectId"];
	        this.status = source["status"];
	        this.startTime = this.convertValues(source["startTime"], null);
	        this.endTime = this.convertValues(source["endTime"], null);
	        this.duration = source["duration"];
	        this.output = source["output"];
	        this.error = source["error"];
	        this.filesGenerated = source["filesGenerated"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BuildOptions {
	    environment: string;
	    draft: boolean;
	    future: boolean;
	    expired: boolean;
	    minify: boolean;
	    verbose: boolean;
	    extraArgs: string[];
	
	    static createFrom(source: any = {}) {
	        return new BuildOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.environment = source["environment"];
	        this.draft = source["draft"];
	        this.future = source["future"];
	        this.expired = source["expired"];
	        this.minify = source["minify"];
	        this.verbose = source["verbose"];
	        this.extraArgs = source["extraArgs"];
	    }
	}
	export class BulkOperation {
	    id: string;
	    type: string;
	    projectIds: string[];
	    status: string;
	    results: Record<string, any>;
	    createdAt: string;
	    completedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new BulkOperation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.projectIds = source["projectIds"];
	        this.status = source["status"];
	        this.results = source["results"];
	        this.createdAt = source["createdAt"];
	        this.completedAt = source["completedAt"];
	    }
	}
	export class CloneOptions {
	    newName: string;
	    newPath: string;
	    copyContent: boolean;
	    copyConfig: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CloneOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.newName = source["newName"];
	        this.newPath = source["newPath"];
	        this.copyContent = source["copyContent"];
	        this.copyConfig = source["copyConfig"];
	    }
	}
	export class VisualEditingConfig {
	    enabled: boolean;
	    apiEndpoint: string;
	    injectAttrs: boolean;
	    fieldMapping: Record<string, string>;
	    excludeKinds: string[];
	
	    static createFrom(source: any = {}) {
	        return new VisualEditingConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.apiEndpoint = source["apiEndpoint"];
	        this.injectAttrs = source["injectAttrs"];
	        this.fieldMapping = source["fieldMapping"];
	        this.excludeKinds = source["excludeKinds"];
	    }
	}
	export class Config {
	    baseURL: string;
	    title: string;
	    environment: string;
	    publishDir: string;
	    themes: string[];
	    languages: string[];
	    params: Record<string, any>;
	    visualEditing?: VisualEditingConfig;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.baseURL = source["baseURL"];
	        this.title = source["title"];
	        this.environment = source["environment"];
	        this.publishDir = source["publishDir"];
	        this.themes = source["themes"];
	        this.languages = source["languages"];
	        this.params = source["params"];
	        this.visualEditing = this.convertValues(source["visualEditing"], VisualEditingConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ConfigFileInfo {
	    path: string;
	    format: string;
	    isDir: boolean;
	    environment?: string;
	
	    static createFrom(source: any = {}) {
	        return new ConfigFileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.format = source["format"];
	        this.isDir = source["isDir"];
	        this.environment = source["environment"];
	    }
	}
	export class Content {
	    id: string;
	    path: string;
	    title: string;
	    content: string;
	    frontMatter: Record<string, any>;
	    format: string;
	    isDraft: boolean;
	    isFuture: boolean;
	    isExpired: boolean;
	    // Go type: time
	    modTime: any;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new Content(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.path = source["path"];
	        this.title = source["title"];
	        this.content = source["content"];
	        this.frontMatter = source["frontMatter"];
	        this.format = source["format"];
	        this.isDraft = source["isDraft"];
	        this.isFuture = source["isFuture"];
	        this.isExpired = source["isExpired"];
	        this.modTime = this.convertValues(source["modTime"], null);
	        this.size = source["size"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ContentList {
	    items: Content[];
	    total: number;
	    path: string;
	    isContentDir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ContentList(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], Content);
	        this.total = source["total"];
	        this.path = source["path"];
	        this.isContentDir = source["isContentDir"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ContentOptions {
	    title: string;
	    path?: string;
	    content: string;
	    frontMatter: Record<string, any>;
	    format: string;
	    isDraft: boolean;
	    archetype?: string;
	
	    static createFrom(source: any = {}) {
	        return new ContentOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.path = source["path"];
	        this.content = source["content"];
	        this.frontMatter = source["frontMatter"];
	        this.format = source["format"];
	        this.isDraft = source["isDraft"];
	        this.archetype = source["archetype"];
	    }
	}
	export class Deployment {
	    id: string;
	    projectId: string;
	    type: string;
	    config: Record<string, any>;
	    status: string;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Deployment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.projectId = source["projectId"];
	        this.type = source["type"];
	        this.config = source["config"];
	        this.status = source["status"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class DeploymentHistory {
	    id: string;
	    deploymentId: string;
	    projectId: string;
	    status: string;
	    url?: string;
	    buildTime: number;
	    deployTime: number;
	    logs: string[];
	    error?: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new DeploymentHistory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.deploymentId = source["deploymentId"];
	        this.projectId = source["projectId"];
	        this.status = source["status"];
	        this.url = source["url"];
	        this.buildTime = source["buildTime"];
	        this.deployTime = source["deployTime"];
	        this.logs = source["logs"];
	        this.error = source["error"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class DeploymentOptions {
	    buildOptions: BuildOptions;
	    environment: string;
	    branch?: string;
	    commit?: string;
	
	    static createFrom(source: any = {}) {
	        return new DeploymentOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.buildOptions = this.convertValues(source["buildOptions"], BuildOptions);
	        this.environment = source["environment"];
	        this.branch = source["branch"];
	        this.commit = source["commit"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EditableRegion {
	    id: string;
	    type: string;
	    selector: string;
	    value: any;
	    path: string;
	    field: string;
	    label: string;
	
	    static createFrom(source: any = {}) {
	        return new EditableRegion(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.selector = source["selector"];
	        this.value = source["value"];
	        this.path = source["path"];
	        this.field = source["field"];
	        this.label = source["label"];
	    }
	}
	export class FileInfo {
	    name: string;
	    path: string;
	    isDir: boolean;
	    size: number;
	    // Go type: time
	    modTime: any;
	    extension: string;
	
	    static createFrom(source: any = {}) {
	        return new FileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isDir = source["isDir"];
	        this.size = source["size"];
	        this.modTime = this.convertValues(source["modTime"], null);
	        this.extension = source["extension"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PageMetadata {
	    path: string;
	    permalink: string;
	    title: string;
	    description: string;
	    content: string;
	    frontMatter: Record<string, any>;
	    kind: string;
	
	    static createFrom(source: any = {}) {
	        return new PageMetadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.permalink = source["permalink"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.content = source["content"];
	        this.frontMatter = source["frontMatter"];
	        this.kind = source["kind"];
	    }
	}
	export class SiteMetadata {
	    title: string;
	    baseURL: string;
	    language?: string;
	
	    static createFrom(source: any = {}) {
	        return new SiteMetadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.baseURL = source["baseURL"];
	        this.language = source["language"];
	    }
	}
	export class PageStructure {
	    page: PageMetadata;
	    regions: EditableRegion[];
	    site: SiteMetadata;
	
	    static createFrom(source: any = {}) {
	        return new PageStructure(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.page = this.convertValues(source["page"], PageMetadata);
	        this.regions = this.convertValues(source["regions"], EditableRegion);
	        this.site = this.convertValues(source["site"], SiteMetadata);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Theme {
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
	    localPath: string;
	    installedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Theme(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.githubPath = source["githubPath"];
	        this.description = source["description"];
	        this.tags = source["tags"];
	        this.screenshot = source["screenshot"];
	        this.minVersion = source["minVersion"];
	        this.author = source["author"];
	        this.license = source["license"];
	        this.installed = source["installed"];
	        this.version = source["version"];
	        this.localPath = source["localPath"];
	        this.installedAt = source["installedAt"];
	    }
	}
	export class Status {
	    isBuilding: boolean;
	    isServing: boolean;
	    serverUrl: string;
	    serverPort: number;
	    hasErrors: boolean;
	    errorMessage: string;
	    visualEditing: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.isBuilding = source["isBuilding"];
	        this.isServing = source["isServing"];
	        this.serverUrl = source["serverUrl"];
	        this.serverPort = source["serverPort"];
	        this.hasErrors = source["hasErrors"];
	        this.errorMessage = source["errorMessage"];
	        this.visualEditing = source["visualEditing"];
	    }
	}
	export class Project {
	    id: string;
	    name: string;
	    path: string;
	    hugoVersion: string;
	    config?: Config;
	    status?: Status;
	    themes: Theme[];
	    lastBuild: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.hugoVersion = source["hugoVersion"];
	        this.config = this.convertValues(source["config"], Config);
	        this.status = this.convertValues(source["status"], Status);
	        this.themes = this.convertValues(source["themes"], Theme);
	        this.lastBuild = source["lastBuild"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ProjectGroup {
	    id: string;
	    name: string;
	    description: string;
	    projectIds: string[];
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ProjectGroup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.projectIds = source["projectIds"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class TemplateFile {
	    path: string;
	    content: string;
	    isDir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TemplateFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.content = source["content"];
	        this.isDir = source["isDir"];
	    }
	}
	export class ProjectTemplate {
	    id: string;
	    name: string;
	    description: string;
	    config: Record<string, any>;
	    files: TemplateFile[];
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ProjectTemplate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.config = source["config"];
	        this.files = this.convertValues(source["files"], TemplateFile);
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SectionMetadata {
	    path: string;
	    title: string;
	    description: string;
	    frontMatter: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new SectionMetadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.frontMatter = source["frontMatter"];
	    }
	}
	export class ServerInfo {
	    projectId: string;
	    isRunning: boolean;
	    url: string;
	    port: number;
	    pid: number;
	    startTime: string;
	
	    static createFrom(source: any = {}) {
	        return new ServerInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.projectId = source["projectId"];
	        this.isRunning = source["isRunning"];
	        this.url = source["url"];
	        this.port = source["port"];
	        this.pid = source["pid"];
	        this.startTime = source["startTime"];
	    }
	}
	export class ServerOptions {
	    port: number;
	    baseURL: string;
	    buildDrafts: boolean;
	    buildFuture: boolean;
	    buildExpired: boolean;
	    disableLiveReload: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ServerOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.port = source["port"];
	        this.baseURL = source["baseURL"];
	        this.buildDrafts = source["buildDrafts"];
	        this.buildFuture = source["buildFuture"];
	        this.buildExpired = source["buildExpired"];
	        this.disableLiveReload = source["disableLiveReload"];
	    }
	}
	
	export class SiteStructure {
	    site: SiteMetadata;
	    pages: PageStructure[];
	    sections: SectionMetadata[];
	
	    static createFrom(source: any = {}) {
	        return new SiteStructure(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.site = this.convertValues(source["site"], SiteMetadata);
	        this.pages = this.convertValues(source["pages"], PageStructure);
	        this.sections = this.convertValues(source["sections"], SectionMetadata);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class ThemeMetadata {
	    name: string;
	    description: string;
	    tags: string[];
	    minVersion: string;
	    author: string;
	    license: string;
	    githubUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new ThemeMetadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.tags = source["tags"];
	        this.minVersion = source["minVersion"];
	        this.author = source["author"];
	        this.license = source["license"];
	        this.githubUrl = source["githubUrl"];
	    }
	}

}

export namespace services {
	
	export class BuildStatusResponse {
	    buildId: string;
	    status: string;
	    progress: number;
	    logs: string[];
	    // Go type: time
	    startTime: any;
	    // Go type: time
	    endTime: any;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new BuildStatusResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.buildId = source["buildId"];
	        this.status = source["status"];
	        this.progress = source["progress"];
	        this.logs = source["logs"];
	        this.startTime = this.convertValues(source["startTime"], null);
	        this.endTime = this.convertValues(source["endTime"], null);
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

