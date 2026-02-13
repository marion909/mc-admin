# Stage 1: Build Client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
# Build the React app (outputs to dist)
RUN npm run build

# Stage 2: Build Server
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
# Build the Express app (outputs to dist)
RUN npm run build

# Stage 3: Final Image
FROM node:20-alpine
WORKDIR /app

# Install production dependencies for the server
COPY server/package*.json ./
RUN npm install --production

# Copy server build from stage 2
COPY --from=server-builder /app/server/dist ./dist

# Copy client build from stage 1 to 'public' folder
# The server works with path.join(__dirname, '../public')
# __dirname is /app/dist, so ../public is /app/public
COPY --from=client-builder /app/client/dist ./public

# Expose the API and Frontend port
EXPOSE 3001

# Start the server
CMD ["node", "dist/index.js"]
