import { z } from "zod";
import { 
    AdoListResponse,
    AdoProject,
    AdoTeam,
    ProjectsResponse, 
    WorkItemQueryResult, 
    WorkItemsResponse 
} from "../interface/adoInterfaces";

export function listProjectsTool(token: string, organization?: string) {
    const org = organization || process.env.ADO_ORGANIZATION;
    if (!org) throw new Error("Organization must be provided or set in ADO_ORGANIZATION");

    return {
        token,
        name: "listProjects",
        schema: {
            top: z.number().optional().default(50).describe("Number of projects to return (default: 50, max: 200)"),
            continuationToken: z.string().optional().describe("Continuation token for pagination"),
            stateFilter: z.string().optional().describe("Filter projects by state (e.g., 'all', 'wellFormed', 'createPending', 'deleted', 'new', 'unchanged')")
        },
        handler: async ({
            top = 50,
            continuationToken,
            stateFilter
        }: {
            top?: number;
            continuationToken?: string;
            stateFilter?: string;
        }) => {
            try {
                const baseUrl = `https://dev.azure.com/${org}`;
                let projectsUrl = `${baseUrl}/_apis/projects?api-version=7.1-preview.4&$top=${top}`;

                if (continuationToken) {
                    projectsUrl += `&continuationToken=${encodeURIComponent(continuationToken)}`;
                }
                if (stateFilter && stateFilter !== 'all') {
                    projectsUrl += `&stateFilter=${encodeURIComponent(stateFilter)}`;
                }

                const response = await fetch(projectsUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch projects: ${await response.text()}`);
                }

                const data = await response.json() as ProjectsResponse;
                const projects = data.value || [];

                let responseText = `Found ${projects.length} projects\n\n`;

                projects.forEach((project, index) => {
                    responseText += `${index + 1}. ${project.name} (${project.id})\n`;
                    responseText += `   State: ${project.state}\n`;
                    responseText += `   URL: ${project.url.replace('_apis/projects/', '_projects/')}\n`;
                    if (project.description) {
                        responseText += `   Description: ${project.description}\n`;
                    }
                    responseText += `   Last Updated: ${new Date(project.lastUpdateTime).toLocaleString()}\n`;
                    responseText += "\n" + "-".repeat(30) + "\n\n";
                });

                if (data.continuationToken) {
                    responseText += `\nMore projects available. Use continuationToken=${data.continuationToken} to get next page.\n`;
                }

                return { content: [{ type: "text" as const, text: responseText }] };
            } catch (error: unknown) {
                return {
                    content: [{ type: "text" as const, text: `Error fetching projects: ${error instanceof Error ? error.message : 'Unknown error occurred'}` }],
                    isError: true
                };
            }
        }
    };
}

export function listTeamsTool(token: string, organization?: string) {
    return {
      token,
      name: "listTeams",
      schema: {
        projectId: z.string().describe("The ID of the Azure DevOps project to list teams from")
      },
      handler: async ({ projectId }: { projectId: string }) => {
        try {
          const org = organization || process.env.ADO_ORGANIZATION;
          if (!org) {
            throw new Error("Organization name is required.");
          }
  
          const url = `https://dev.azure.com/${org}/_apis/projects/${projectId}/teams?api-version=7.1-preview.3`;
  
          const response = await fetch(url, {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          });
  
          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to fetch teams: ${error}`);
          }
  
          const data = await response.json() as {
            count: number;
            value: {
              id: string;
              name: string;
              description?: string;
              url: string;
            }[];
          };
  
          if (data.count === 0) {
            return {
              content: [{
                type: "text" as const,
                text: `No teams found for project ID: ${projectId}`
              }]
            };
          }
  
          let responseText = `Found ${data.count} teams in project ${projectId}:\n\n`;
          data.value.forEach((team, idx) => {
            responseText += `${idx + 1}. ${team.name}\n`;
            responseText += `   ID: ${team.id}\n`;
            if (team.description) {
              responseText += `   Description: ${team.description}\n`;
            }
            responseText += `   URL: ${team.url}\n\n`;
          });
  
          return {
            content: [{
              type: "text" as const,
              text: responseText
            }]
          };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          return {
            content: [{
              type: "text" as const,
              text: `Error fetching teams: ${errorMessage}`
            }],
            isError: true
          };
        }
      }
    };
  }

  // Simple fuzzy match: case-insensitive substring search
function findClosestMatch<T extends { name: string; id: string }>(list: T[], query: string): T | null {
    const lowerQuery = query.toLowerCase();
    return (
      list.find(item => item.name.toLowerCase().includes(lowerQuery)) ||
      list.find(item => item.id.toLowerCase() === query.toLowerCase()) ||
      null
    );
  }

  export function listWorkItemsTool(token: string, organization?: string) {
    return {
      token,
      name: "listWorkItems",
      schema: {
        top: z.number().optional().default(50).describe("Number of work items to return (default: 50, max: 200)"),
        skip: z.number().optional().describe("Number of work items to skip for pagination"),
        project: z.string().optional().describe("The name or ID of the Azure DevOps project (fuzzy match supported)"),
        team: z.string().optional().describe("The name or ID of the team inside the project (fuzzy match supported)")
      },
      handler: async ({
        top = 50,
        skip = 0,
        project,
        team
      }: {
        top?: number;
        skip?: number;
        project?: string;
        team?: string;
      }) => {
        try {
          const org = organization || process.env.ADO_ORGANIZATION;
          if (!org) {
            throw new Error("Organization name is required.");
          }
  
          const baseUrl = `https://dev.azure.com/${org}`;
  
          // 🔎 Resolve project if provided
        let projectId = project;
        if (project && !/^[0-9a-fA-F-]{36}$/.test(project)) {
        const projectsResp = await fetch(`${baseUrl}/_apis/projects?api-version=7.1-preview.4`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const projectsData = await projectsResp.json() as AdoListResponse<AdoProject>;
        const match = findClosestMatch(projectsData.value, project);
        if (!match) throw new Error(`No matching project found for "${project}"`);
        projectId = match.id;
        }

        // 🔎 Resolve team if provided
        let teamId = team;
        if (team && projectId) {
        const teamsResp = await fetch(`${baseUrl}/_apis/projects/${projectId}/teams?api-version=7.1-preview.3`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const teamsData = await teamsResp.json() as AdoListResponse<AdoTeam>;
        const match = findClosestMatch(teamsData.value, team);
        if (!match) throw new Error(`No matching team found for "${team}"`);
        teamId = match.id;
        }
  
          // Build WIQL query
          const wiqlQuery = `
            SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], 
                   [System.AssignedTo], [System.IterationPath]
            FROM WorkItems
            WHERE [System.AssignedTo] = @Me
              AND [System.WorkItemType] <> 'Task'
              AND [System.IterationPath] = @CurrentIteration
              AND [System.State] <> 'Closed'
            ORDER BY [System.State], [System.ChangedDate] DESC
          `;
  
          const projectPath = projectId ? `${projectId}/` : "";
          const teamPath = teamId ? `${teamId}/` : "";
          const wiqlUrl = `${baseUrl}/${projectPath}${teamPath}_apis/wit/wiql?api-version=7.1-preview.2`;
  
          const wiqlResponse = await fetch(wiqlUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ query: wiqlQuery })
          });
  
          if (!wiqlResponse.ok) {
            const error = await wiqlResponse.text();
            throw new Error(`Failed to execute WIQL query: ${error}`);
          }
  
          const wiqlResult = await wiqlResponse.json() as WorkItemQueryResult;
          const workItemIds = wiqlResult.workItems?.map(wi => wi.id) || [];
  
          if (workItemIds.length === 0) {
            return {
              content: [{ type: "text" as const, text: "No work items found matching the criteria." }]
            };
          }
  
          // Fetch details
          const workItemsUrl = `${baseUrl}/_apis/wit/workitems?ids=${workItemIds.join(",")}` +
            `&$expand=all&$top=${top}&$skip=${skip}&api-version=7.1-preview.3`;
  
          const workItemsResponse = await fetch(workItemsUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          });
  
          if (!workItemsResponse.ok) {
            const error = await workItemsResponse.text();
            throw new Error(`Failed to fetch work items: ${error}`);
          }
  
          const workItemsData = await workItemsResponse.json() as WorkItemsResponse;
          const workItems = workItemsData.value || [];
  
          let responseText = `Found ${workItems.length} work items in current iteration assigned to you\n\n`;
          responseText += "=".repeat(50) + "\n\n";
  
          workItems.forEach((item, index) => {
            const fields = item.fields;
            responseText += `${index + 1}. [${fields["System.WorkItemType"]}] ${fields["System.Title"]}\n`;
            responseText += `   ID: ${item.id}\n`;
            responseText += `   State: ${fields["System.State"]}\n`;
            responseText += `   Iteration: ${fields["System.IterationPath"]}\n`;
            responseText += `   URL: ${item.url.replace("_apis/wit/workItems", "_workitems/edit")}\n\n`;
          });
  
          return {
            content: [{ type: "text" as const, text: responseText }]
          };
  
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          return {
            content: [{ type: "text" as const, text: `Error fetching work items: ${errorMessage}` }],
            isError: true
          };
        }
      }
    };
  }
  
