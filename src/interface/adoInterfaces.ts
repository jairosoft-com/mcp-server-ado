// Define environment variable types
export interface Env {
    AUTH_TOKEN?: string;
}

export interface WorkItem {
    id: number;
    url: string;
    fields: {
        'System.Title': string;
        'System.WorkItemType': string;
        'System.State': string;
        'System.AssignedTo'?: {
            displayName: string;
            uniqueName: string;
        };
        'System.CreatedDate'?: string;
        'System.ChangedDate'?: string;
        'System.Description'?: string;
        'System.Tags'?: string;
        'Microsoft.VSTS.Common.Priority'?: number;
        'Microsoft.VSTS.Common.Severity'?: string;
        'Microsoft.VSTS.Common.AcceptanceCriteria'?: string;
        'System.History'?: string;
        'System.IterationPath'?: string;
    };
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    url: string;
    state: string;
    revision: number;
    visibility: string;
    lastUpdateTime: string;
}

export interface ProjectsResponse {
    count: number;
    value: Project[];
    continuationToken?: string;
}

export interface WorkItemReference {
    id: number;
    url: string;
}

export interface WorkItemQueryResult {
    queryType: string;
    queryResultType: string;
    asOf: string;
    workItems: WorkItemReference[];
    workItemRelations?: any[];
}

export interface WorkItemsResponse {
    count: number;
    value: WorkItem[];
    continuationToken?: string;
}

// Types for ADO responses
export type AdoListResponse<T> = {
    count: number;
    value: T[];
  };
  
export type AdoProject = {
    id: string;
    name: string;
    description?: string;
    url: string;
  };
  
export type AdoTeam = {
    id: string;
    name: string;
    description?: string;
    url: string;
    projectName: string;
    projectId: string;
  };
  