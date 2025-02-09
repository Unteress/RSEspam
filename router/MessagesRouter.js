// MessagesRouter.js
import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  sendMessage,
  getMessages,
  deleteMessage,
  updateMessageStatus,
} from "../controller/MessageController.js";

const router = express.Router();

// Rutas protegidas
router.post("/send", verifyToken, sendMessage);
router.get("/get/:friendId", verifyToken, getMessages);
router.delete("/delete/:messageId", verifyToken, deleteMessage);
router.patch("/status/:messageId", verifyToken, updateMessageStatus);

export default router;
