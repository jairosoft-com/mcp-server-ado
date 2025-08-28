# Azure DevOps MCP Server - Docker Setup

This document explains how to deploy the Azure DevOps MCP server using Docker for interacting with Azure DevOps services.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed on your system
- Azure DevOps organization
- Personal Access Token (PAT) with required permissions

## Quick Start

1. Build the Docker image:

   ```bash
   docker build -t mcp-ado-server .
   ```

2. Run the container:
   ```bash
   docker run -p 8787:8787 \
     -e ADO_ORGANIZATION=your-organization \
     -e ADO_TOKEN=your_personal_access_token \
     mcp-ado-server
   ```

## Configuration

### Environment Variables

- `ADO_ORGANIZATION` (required): Your Azure DevOps organization name
- `ADO_TOKEN` (required): Your Personal Access Token (PAT) with appropriate scopes
- `PORT` (optional): Port to run the server on (default: 8787)
- `NODE_ENV` (optional): Environment mode (development/production)

Create a `.env` file in the project root with the following variables:

```env
# Required
ADO_ORGANIZATION=your_azure_devops_organization

# Optional
NODE_ENV=production
PORT=8787
LOG_LEVEL=info
```

### Getting Microsoft Graph Token

1. Go to [Microsoft Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with your Microsoft 365 account
3. Request the following permissions:
   - Chat.Read
   - Chat.ReadWrite
   - ChatMessage.Send
4. Copy the access token and use it as `AUTH_TOKEN`

## Running with Docker Compose

1. Create a `docker-compose.yml` file:

   ```yaml
   version: "3.8"
   services:
     mcp-teams-chat:
       build: .
       ports:
         - "8787:8787"
       env_file:
         - .env
       restart: unless-stopped
   ```

2. Start the service:
   ```bash
   docker-compose up -d
   ```

## Accessing the Server

- MCP Endpoint: `http://localhost:8787/mcp`
- Server-Sent Events: `http://localhost:8787/sse`
- Health Check: `http://localhost:8787/health`

## Connecting Clients

### Claude Desktop Configuration

Add this to your Claude Desktop config:

```json
{
  "mcpServers": {
    "teams-chat": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8787/sse?token=your_auth_token"]
    }
  }
}
```

## Volumes for Persistent Data

To persist logs and other data, mount volumes:

```bash
docker run -p 8787:8787 \
  -v ./logs:/app/logs \
  -v ./data:/app/data \
  --env-file .env \
  mcp-teams-chat
```

## Security Considerations

- Never commit your `.env` file to version control
- Use a secure method to manage your Microsoft Graph tokens
- Consider using Docker secrets for production deployments
- The container runs as a non-root user for security

## Troubleshooting

### View Logs

```bash
# For Docker Compose
docker-compose logs -f

# For standalone container
docker logs <container_id>
```

### Common Issues

1. **Invalid Token**: Ensure your Microsoft Graph token is valid and has the correct permissions
2. **Port Conflicts**: Check if port 8787 is available or change the port mapping
3. **Container Fails to Start**: Check logs for specific error messages

## Development

For local development without Docker:

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Set environment variables:

   ```bash
   export AUTH_TOKEN=your_auth_token
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Notes

- The server runs in development mode by default when using `npm run dev`
- In production, ensure proper logging and monitoring are set up
- The container exposes port 8787 by default
