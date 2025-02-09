import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { getChats, deleteChat } from "../controller/chatController.js";

const router = express.Router();


router.get("/", verifyToken, getChats);


router.delete("/:chatId", verifyToken, deleteChat);

export default router;
