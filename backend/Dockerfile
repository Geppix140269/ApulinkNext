# Apulink Backend Production Dockerfile
FROM node:18-alpine AS base

# Security: Create non-root user
RUN addgroup --system --gid 1001 apulink && \
    adduser --system --uid 1001 --ingroup apulink apulink

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with security audit
RUN npm ci --only=production --no-fund --audit-level=high && \
    npm cache clean --force

# Production image
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Copy node_modules from deps stage
COPY --from=deps --chown=apulink:apulink /app/node_modules ./node_modules

# Copy application code
COPY --chown=apulink:apulink . .

# Security: Remove npm and unnecessary packages
RUN npm uninstall -g npm

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { \
    if (res.statusCode !== 200) process.exit(1); \
    console.log('Health check passed'); \
  }).on('error', () => process.exit(1))"

# Switch to non-root user
USER apulink

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "server.js"]