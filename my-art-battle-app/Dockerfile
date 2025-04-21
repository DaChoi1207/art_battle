# Use official Node.js image for backend
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your code
COPY . .

# Expose backend port
EXPOSE 3001

# Start backend server
CMD ["node", "server.js"]
