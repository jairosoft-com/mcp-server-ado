import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Env } from "./interface/adoInterfaces";
import { listTicketsTool } from "./tools/adoTools";

// Define the Props type
type Props = {
	bearerToken: string;
};

// Extend your class with props support
export class MyMCP extends McpAgent<Env, null, Props> {
	server = new McpServer({
		name: "Microsoft Chat Fetcher",
		version: "1.0.0",
	});

	async init() {
		try {
			// Access token from this.props.bearerToken
			const token = this.props.bearerToken;

			const listTicketsToolInstance = listTicketsTool(token);

			this.server.tool(
				listTicketsToolInstance.name,
				listTicketsToolInstance.schema,
				listTicketsToolInstance.handler
			);

			console.log("Registered tools:", [
				listTicketsToolInstance.name,
			].join(", "));
		} catch (error) {
			console.error("Error initializing MCP tools:", error);
			throw error;
		}
	}
}

// Top-level fetch
export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);
		const authHeader = request.headers.get("authorization");
		const tokenFromUrl = url.searchParams.get("token");
		const authToken = (authHeader?.replace("Bearer ", "") || tokenFromUrl || env.AUTH_TOKEN || "").trim();

		console.log("Auth token received:", authToken ? `${authToken.substring(0, 10)}...` : "No token found");

		ctx.props = {
			bearerToken: authToken
		};

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};