ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM $BUILD_FROM

# Install Node.js
RUN apk add --no-cache nodejs npm jq

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY server/ ./server/
COPY ui/ ./ui/
COPY run.sh ./

# Make run script executable
RUN chmod +x run.sh

# Expose Ingress port
EXPOSE 8099

# Start the application
CMD ["./run.sh"]
