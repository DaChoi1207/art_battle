# 🎨 DrawCam – Multiplayer AI-Powered Art Battle

A full-stack, real-time multiplayer web game where players draw using webcam-tracked hand gestures. Compete in live art battles, vote for the best drawing, and experience a creative twist on online gaming.

---

## 🚀 Demo
🔗 [Play Now](https://app.dcbg.win)  

---

## 🛠️ Tech Stack

**Frontend**: React, Tailwind, Socket.io, Google MediaPipe  
**Backend**: Node.js, Express, WebSockets  
**Cloud & Infra**: Docker, AWS (ECS Fargate, RDS, S3, CloudFront, EC2), GitHub Actions  
**Auth**: Google / Discord OAuth  
**Database**: PostgreSQL (AWS RDS)  
**AI**: Groq API (for AI-powered color suggestions)

---

## 🎯 Features

- 🖐️ **Webcam Gesture Drawing** – Use your hand to draw on canvas via MediaPipe.
- 🔁 **Real-Time Multiplayer** – Sync live drawings between players with Socket.io.
- 🧠 **AI-Powered Creativity** – Get color palette suggestions via the Groq API.
- 🔐 **Secure Login** – Authenticate via Google or Discord OAuth.
- 📊 **Player Stats Tracking** – Track wins, submissions, and more with PostgreSQL.
- 🖼️ **Gallery & Voting** – Vote on art submissions at the end of each round.
- ⚙️ **Production-Ready Deployment** – Hosted on AWS with CI/CD pipelines, HTTPS, and secure infra.

---

## 📷 Screenshots

<img width="1710" alt="Screenshot 2025-05-04 at 7 33 02 PM" src="https://github.com/user-attachments/assets/fbd71227-4c02-441d-8c90-97d4bd2859a0" />

---

## 🧪 Local Development

```bash
# Install dependencies
npm install

# Run both client and server (suggest using concurrently)
npm run dev
