# Telfersnake: one small Node process that serves the built game and runs the playgrounds.
# Nothing is installed in here: dist/ is static files and dist-server/index.js is one
# self-contained bundle (the WebSocket library is inside it). Build both first: npm run build
FROM node:22-alpine
WORKDIR /app
COPY dist ./dist
COPY dist-server ./dist-server
ENV NODE_ENV=production PORT=8787
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "dist-server/index.js"]
