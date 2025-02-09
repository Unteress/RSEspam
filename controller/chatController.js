import { ChatModel } from "../models/ChatModel.js";
import { Op } from "sequelize";
import { db } from "../config/firebaseConfig.js"; 
import { MessageModel } from "../models/MessageModel.js"; // Asegúrate de que esta línea esté presente


export const getChats = async (req, res) => {
    const { user_id } = req.user;
  
    try {
      console.log('Buscando chats para el usuario:', user_id);  // Log de depuración
  
      // Buscar chats asociados al usuario
      const chats = await ChatModel.findAll({
        where: {
          [Op.or]: [{ user1_id: user_id }, { user2_id: user_id }],
        },
        include: [
          {
            model: MessageModel,
            as: "lastMessage",
            attributes: ["content", "created_at"],
          },
        ],
        order: [["last_message_date", "DESC"]],
      });
  
      console.log('Chats encontrados:', chats);  // Log de depuración
  
      // Si no hay chats, devuelve una respuesta adecuada
      if (chats.length === 0) {
        return res.status(200).json({ message: "No tienes chats activos." });
      }
  
      // Si se encuentran chats, los devuelve
      res.status(200).json({ chats });
    } catch (error) {
      console.error("Error al obtener los chats:", error);  // Log detallado del error
      res.status(500).json({ error: error.message || "Ocurrió un error al obtener los chats." });
    }
  };
  
  
  

export const deleteChat = async (req, res) => {
    const { user_id } = req.user;
    const { chatId } = req.params;
  
    try {
      const chat = await ChatModel.findOne({
        where: {
          id: chatId,
          [Op.or]: [{ user1_id: user_id }, { user2_id: user_id }],
        },
      });
  
      if (!chat) {
        return res.status(404).json({ message: "Chat no encontrado o no tienes permiso para eliminarlo." });
      }
  
      // Eliminar el chat de Firestore
      await db.collection("chats").doc(String(chatId)).delete();
  
      // Eliminar el chat de MySQL
      await ChatModel.destroy({ where: { id: chatId } });
  
      res.status(200).json({ message: "Chat eliminado con éxito." });
    } catch (error) {
      console.error("Error al eliminar el chat:", error);
      res.status(500).json({ error: "Ocurrió un error al eliminar el chat." });
    }
  };
