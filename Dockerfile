# Multi-stage Dockerfile for backend 

# Builder stage: install all dependencies.
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Project dependencies + source code
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

EXPOSE 5000

CMD ["node", "server.js"]