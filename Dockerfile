FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY tsconfig.base.json ./

# Copy backend
COPY backend/ ./backend/

# Copy engine (imported by backend)
COPY src/ ./src/

# Install backend deps
RUN cd backend && npm install

# Build backend (tsc compiles backend/src + src/engine into backend/dist)
RUN cd backend && npm run build

EXPOSE 3001

CMD ["node", "backend/dist/backend/src/server.js"]
