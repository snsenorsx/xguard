# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments
ARG VITE_API_URL
ARG VITE_WS_URL

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy built application from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx user already exists in the base image, just use it

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]