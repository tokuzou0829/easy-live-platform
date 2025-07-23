# Use the official Node.js 20 image to match .node-version
FROM node:20-alpine

# Install libc6-compat for alpine
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Enable corepack and prepare pnpm
RUN corepack enable

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml* ./

# Install dependencies (recreate lockfile if needed)
RUN pnpm install --no-frozen-lockfile || pnpm install

# Copy source code
COPY . .

# Define build arguments for Next.js public environment variables
ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CHAT_URL
ARG NEXT_PUBLIC_HLS_URL
ARG NEXT_PUBLIC_RTMP_URL
ARG NEXT_PUBLIC_THUMBNAIL_URL
ARG NEXT_PUBLIC_WEBSOCKET_URL
ARG NEXT_PUBLIC_BASE_URL
ARG AUTH_GITHUB_SECRET
ARG AUTH_GITHUB_ID
# Set environment variables for the build process
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CHAT_URL=$NEXT_PUBLIC_CHAT_URL
ENV NEXT_PUBLIC_HLS_URL=$NEXT_PUBLIC_HLS_URL
ENV NEXT_PUBLIC_RTMP_URL=$NEXT_PUBLIC_RTMP_URL
ENV NEXT_PUBLIC_THUMBNAIL_URL=$NEXT_PUBLIC_THUMBNAIL_URL
ENV NEXT_PUBLIC_WEBSOCKET_URL=$NEXT_PUBLIC_WEBSOCKET_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV AUTH_GITHUB_ID=$AUTH_GITHUB_ID
ENV AUTH_GITHUB_SECRET=$AUTH_GITHUB_SECRET

# Build the application
RUN pnpm run build

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["pnpm", "start"]
