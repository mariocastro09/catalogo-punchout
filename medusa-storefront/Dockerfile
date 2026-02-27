FROM node:20-alpine

WORKDIR /app

# Install dependencies for Bun
RUN apk update && apk add --no-cache curl python3 make g++

# Install Bun globally
RUN npm install -g bun

COPY package.json ./
RUN bun install

COPY . .

# Run the Next.js dev server with Bun
CMD ["bun", "run", "dev"]
