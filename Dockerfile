# Use Node.js LTS (Debian-based)
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY wrangler.jsonc ./

# Install dependencies and required tools
RUN apt-get update && apt-get install -y python3 make g++
RUN npm ci

# Copy source code
COPY . .

RUN npm ci --only=production --legacy-peer-deps
# Build the project
RUN npm run build

# Expose the port the app runs on
EXPOSE 8787

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8787/ || exit 1

# Set environment variables
ENV NODE_ENV=production

# Command to run the application
CMD ["npm", "run", "dev"]
