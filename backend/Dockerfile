FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# node:20-alpine runs as root by default — an unnecessary privilege for a
# process that only needs to listen on a port and talk to Mongo/AWS/SMTP.
# Alpine images already ship an unprivileged "node" user; just use it.
RUN mkdir -p uploads && chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "index.js"]
