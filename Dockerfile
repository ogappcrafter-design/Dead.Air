FROM node:24-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package manifests for dependency caching
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy project files
COPY . .

# Expose Metro bundler port
EXPOSE 8081

# Start Expo dev server
CMD ["pnpm", "start", "--host", "0.0.0.0"]
