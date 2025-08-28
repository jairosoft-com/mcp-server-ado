# Azure DevOps MCP Server

This project provides an MCP (Model Context Protocol) server for interacting with Azure DevOps (ADO). It enables AI assistants to query work items, projects, and teams within your Azure DevOps organization.

## Features

- List all work items in the current iteration
- Query projects and teams within your organization
- Filter work items by project and team
- Secure authentication using Azure DevOps Personal Access Tokens (PAT)
- Support for fuzzy matching of project and team names

## Prerequisites

- Node.js 18+ and npm 9+
- Azure DevOps organization
- Personal Access Token (PAT) with the following scopes:
  - Work Items (Read)
  - Project and Team (Read)
  - Identity (Read)

## Configuration

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd mcp-ms-chat
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   ADO_ORGANIZATION=your-organization-name
   ADO_TOKEN=your_personal_access_token
   NODE_ENV=development
   PORT=8787
   ```

4. To get a Personal Access Token (PAT):
   - Sign in to your Azure DevOps organization
   - Go to User settings > Personal access tokens
   - Create a new token with the following scopes:
     - Work Items (Read)
     - Project and Team (Read)
     - Identity (Read)
   - Copy the token and use it as `ADO_TOKEN` in your `.env` file

## Running Locally

```bash
# Development mode with hot-reload
npm run dev

# Production build
npm run build
npm start
```

The server will be available at `http://localhost:8787`

## Available MCP Tools

### 1. listWorkItems
List work items assigned to the current user in the current iteration.

**Parameters:**
- `top` (number, optional): Number of work items to return (default: 50, max: 200)
- `skip` (number, optional): Number of work items to skip for pagination
- `project` (string, optional): Filter by project name or ID (fuzzy match supported)
- `team` (string, optional): Filter by team name or ID within the project (fuzzy match supported)

### 2. listProjects
List all projects in the organization.

**Parameters:**
- `top` (number, optional): Number of projects to return (default: 50, max: 200)
- `skip` (number, optional): Number of projects to skip for pagination

### 3. listTeams
List all teams in a project.

**Parameters:**
- `project` (string, required): Project name or ID to list teams from
- `top` (number, optional): Number of teams to return (default: 50, max: 200)
- `skip` (number, optional): Number of teams to skip for pagination

## Connecting Clients

### Cloudflare AI Playground
1. Go to [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)
2. Enter your MCP server URL (e.g., `http://localhost:8787/sse` for local development)
3. Start using the MCP tools directly in the playground

### Claude Desktop
1. Open Claude Desktop
2. Go to Settings > Developer > Edit Config
3. Add your MCP server configuration:

```json
{
  "mcpServers": {
    "teams-chat": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8787/sse?token=your_auth_token"
      ]
    }
  }
}
```

## Deployment

### Cloudflare Workers
[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yourusername/mcp-ms-chat)

Or deploy using Wrangler:
```bash
npm run deploy
```

### Docker
See [Docker README](README-docker.md) for container deployment options.

## Security Notes

- Never commit your `.env` file to version control
- Use environment variables for sensitive information
- Regularly rotate your Microsoft Graph tokens
- The server requires a valid token for all operations

## Troubleshooting

- **Invalid Token**: Ensure your Microsoft Graph token is valid and has the correct permissions
- **CORS Issues**: When running locally, ensure your client is configured to allow requests to your server
- **Rate Limiting**: Microsoft Graph API has rate limits; implement proper error handling in your client

## License

[MIT](LICENSE)

```json
{
  "mcpServers": {
    "calculator": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8787/sse?token=your-token" // or remote-mcp-server-authless.your-account.workers.dev/sse?token=your-token
      ]
    }
  }
}
```

Restart Claude and you should see the tools become available.
