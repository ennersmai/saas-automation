# Use Node.js 20 LTS
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY nx.json ./
COPY tsconfig.base.json ./

# Copy workspace files
COPY backend/package.json ./backend/
COPY shared-types/package.json ./shared-types/

# Install all dependencies (needed for build)
RUN npm ci

# Copy source files
COPY backend ./backend
COPY shared-types ./shared-types

# Build the backend
RUN npm run build -- --project=backend

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 8080

# Run the application
CMD ["node", "dist/backend/main.js"]
