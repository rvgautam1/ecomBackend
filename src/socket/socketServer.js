import { Server } from "socket.io";
import jwt from "jsonwebtoken";
let io = null;
let connectedUsers = new Map(); // userId ->socketId

// initialize Socket.IO
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Authenticate user on connection
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("No token"));
    }

    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = user.id;
      socket.userRole = user.role;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;

    connectedUsers.set(userId, socket.id);
    console.log(`User ${userId} connected`);

    socket.join(`user_${userId}`);

    if (socket.userRole === "admin") {
      socket.join("admins");
    }

    socket.emit("connected", { message: "Connected to server" });

    socket.on("disconnect", () => {
      connectedUsers.delete(userId);
      console.log(`User ${userId} disconnected`);
    });
  });

  console.log(" WebSocket initialized");
  return io;
};
export const sendToUser = (userId, event, data) => {
  if (!io) return;
  io.to(`user_${userId}`).emit(event, data);
};

//  Send message to all admins
export const sendToAdmins = (event, data) => {
  if (!io) return;
  io.to("admins").emit(event, data);
};

//  Send to everyone
export const broadcast = (event, data) => {
  if (!io) return;
  io.emit(event, data);
};

export const getIO = () => io;
