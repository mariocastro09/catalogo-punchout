FROM node:20-alpine
WORKDIR /app

# Install system dependencies needed for Medusa build
RUN apk update && apk add --no-cache python3 make g++ curl

# Install Bun globally for drastically faster installs
RUN npm install -g bun

COPY package*.json ./
RUN bun install

COPY . .

# Run migrations first, then start the dev server
CMD ["sh", "-c", "bun run medusa db:migrate && bun run dev"]
