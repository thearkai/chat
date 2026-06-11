# ==========================================================
#  THE ARK AI - Production Docker image
# ==========================================================
FROM node:20-alpine

WORKDIR /app

# Install production dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

# Ensure uploads dir exists
RUN mkdir -p server/uploads

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
