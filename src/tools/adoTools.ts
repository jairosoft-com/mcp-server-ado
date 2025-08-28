import { z } from "zod";
import { 
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

export function listTicketsTool(token: string, organization?: string) {
    return {
        token,
        name: "listTickets",
        schema: {
            top: z.number().optional().default(50).describe("Number of work items to return (default: 50, max: 200)"),
            skip: z.number().optional().describe("Number of work items to skip for pagination"),
            project: z.string().optional().describe("The name or ID of the Azure DevOps project"),
            team: z.string().optional().describe("The name or ID of the team"),
            workItemTypes: z.array(z.string()).optional().describe("Filter by work item types (e.g., ['Bug', 'User Story', 'Task'])"),
            states: z.array(z.string()).optional().describe("Filter by work item states (e.g., ['New', 'Active', 'Resolved'])")
        },
        handler: async ({
            top = 50,
            skip = 0,
            project,
            team,
            workItemTypes = [],
            states = []
        }: {
            top?: number;
            skip?: number;
            project?: string;
            team?: string;
            workItemTypes?: string[];
            states?: string[];
        }) => {
            try {
                const org = organization || process.env.ADO_ORGANIZATION;
                // Extract user information from the token
                const tokenPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                const userEmail = tokenPayload.unique_name || tokenPayload.upn;
                
                if (!userEmail) {
                    throw new Error('Could not determine user email from token');
                }

                // Build the WIQL (Work Item Query Language) query
                const selectClause = 'SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], [System.AssignedTo], ' +
                    '[System.CreatedDate], [System.ChangedDate], [System.Description], [System.Tags], ' +
                    '[Microsoft.VSTS.Common.Priority], [Microsoft.VSTS.Common.Severity]';
                
                let whereClause = `WHERE [System.AssignedTo] = '${userEmail.replace(/'/g, "''")}'`;
                
                // Add work item type filters if provided
                if (workItemTypes.length > 0) {
                    const types = workItemTypes.map(t => `'${t}'`).join(',');
                    whereClause += ` AND [System.WorkItemType] IN (${types})`;
                }
                
                // Add state filters if provided
                if (states.length > 0) {
                    const stateConditions = states.map(s => `'${s}'`).join(',');
                    whereClause += ` AND [System.State] IN (${stateConditions})`;
                }
                
                const orderByClause = 'ORDER BY [System.ChangedDate] DESC';
                const wiqlQuery = `${selectClause} FROM WorkItems ${whereClause} ${orderByClause}`;

                // Determine the organization URL from the token
                const baseUrl = `https://dev.azure.com/${organization}`;
                
                // If project is not provided, we'll search across all projects
                if (!project) {
                    // If no project is specified, we'll search across all projects
                    // by not including the project in the WIQL URL
                    project = '';
                }

                // Execute the WIQL query
                const projectPath = project ? `${project}/` : '';
                const wiqlUrl = `${baseUrl}/${projectPath}${team ? `${team}/` : ''}_apis/wit/wiql?api-version=7.1-preview.2`;
                const wiqlResponse = await fetch(wiqlUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        query: wiqlQuery
                    })
                });

                if (!wiqlResponse.ok) {
                    const error = await wiqlResponse.text();
                    throw new Error(`Failed to execute WIQL query: ${error}`);
                }

                const wiqlResult = await wiqlResponse.json() as WorkItemQueryResult;
                const workItemIds = wiqlResult.workItems?.map(wi => wi.id) || [];
                
                if (workItemIds.length === 0) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: "No work items found matching the criteria."
                        }]
                    };
                }

                // Get work item details
                const workItemsUrl = `${baseUrl}/_apis/wit/workitems?ids=${workItemIds.join(',')}&` +
                    `api-version=7.1-preview.3&$expand=all&$top=${top}&$skip=${skip}`;
                
                const workItemsResponse = await fetch(workItemsUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!workItemsResponse.ok) {
                    const error = await workItemsResponse.text();
                    throw new Error(`Failed to fetch work items: ${error}`);
                }

                const workItemsData = await workItemsResponse.json() as WorkItemsResponse;
                const workItems = workItemsData.value || [];

                // Format the response
                let responseText = `Found ${workItems.length} work items assigned to you\n\n`;
                
                if (workItems.length > 0) {
                    responseText += "Work Items Details:\n";
                    responseText += "=".repeat(50) + "\n\n";
                    
                    workItems.forEach((item, index) => {
                        const fields = item.fields;
                        responseText += `${index + 1}. [${fields['System.WorkItemType']}] ${fields['System.Title']}\n`;
                        responseText += `   ID: ${item.id}\n`;
                        responseText += `   State: ${fields['System.State']}\n`;
                        
                        if (fields['System.AssignedTo']) {
                            responseText += `   Assigned To: ${fields['System.AssignedTo'].displayName} (${fields['System.AssignedTo'].uniqueName})\n`;
                        }
                        
                        if (fields['Microsoft.VSTS.Common.Priority']) {
                            responseText += `   Priority: ${fields['Microsoft.VSTS.Common.Priority']}\n`;
                        }
                        
                        if (fields['Microsoft.VSTS.Common.Severity']) {
                            responseText += `   Severity: ${fields['Microsoft.VSTS.Common.Severity']}\n`;
                        }
                        
                        if (fields['System.CreatedDate']) {
                            responseText += `   Created: ${new Date(fields['System.CreatedDate']).toLocaleString()}\n`;
                        }
                        
                        if (fields['System.ChangedDate']) {
                            responseText += `   Last Updated: ${new Date(fields['System.ChangedDate']).toLocaleString()}\n`;
                        }
                        
                        if (fields['System.Tags']) {
                            responseText += `   Tags: ${fields['System.Tags']}\n`;
                        }
                        
                        if (fields['System.Description']) {
                            const description = fields['System.Description'].replace(/<[^>]*>?/gm, '').substring(0, 150);
                            responseText += `   Description: ${description}${fields['System.Description'].length > 150 ? '...' : ''}\n`;
                        }
                        
                        responseText += `   URL: ${item.url.replace('_apis/wit/workItems', '_workitems/edit')}\n`;
                        responseText += "\n" + "-".repeat(30) + "\n\n";
                    });
                }

                // Add pagination info if available
                if (workItemsData.count) {
                    responseText += `\nTotal Count: ${workItemsData.count}\n`;
                }
                
                if (workItemsData.continuationToken) {
                    responseText += `More items available. Use 'skip' parameter to get the next page.\n`;
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: responseText
                    }]
                };
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                return {
                    content: [{
                        type: "text" as const,
                        text: `Error fetching work items: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    };
}
