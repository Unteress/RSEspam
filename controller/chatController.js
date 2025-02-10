import { ChatModel } from "../models/ChatModel.js";
import { FriendsModel } from "../models/FriendsModel.js";
import { MessageModel } from "../models/MessageModel.js";
import { Op } from "sequelize";
import { db } from "../config/firebaseConfig.js";
import { UserModel } from "../models/UserModel.js";
import { PersonsModel } from "../models/PersonsModel.js";

export const getChats = async (req, res) => {
  const { user_id } = req.user;

  try {
    console.log('Buscando chats para el usuario:', user_id);
    
    // 1. Consultar todas las amistades aceptadas del usuario
    const acceptedFriendships = await FriendsModel.findAll({
      where: {
        [Op.or]: [
          { user_id: user_id, status: 'accepted' },
          { friend_id: user_id, status: 'accepted' }
        ]
      }
    });

    // Construir un conjunto (set) con los IDs de los amigos
    const friendIdsSet = new Set();
    acceptedFriendships.forEach(friendship => {
      if (friendship.user_id === user_id) {
        friendIdsSet.add(friendship.friend_id);
      } else {
        friendIdsSet.add(friendship.user_id);
      }
    });

    // 2. Obtener todos los chats en los que el usuario participa, incluyendo:
    //    - El último mensaje (lastMessage)
    //    - Los datos de ambos usuarios (user1 y user2) con sus datos personales
    const chats = await ChatModel.findAll({
      where: {
        [Op.or]: [
          { user1_id: user_id },
          { user2_id: user_id }
        ]
      },
      include: [
        {
          model: MessageModel,
          as: "lastMessage",
          attributes: ["content", "created_at", "sender_id"],
        },
        {
          model: UserModel,
          as: "user1",
          attributes: ["id", "user"],
          include: {
            model: PersonsModel,
            attributes: ["photo", "name", "lastName"]
          }
        },
        {
          model: UserModel,
          as: "user2",
          attributes: ["id", "user"],
          include: {
            model: PersonsModel,
            attributes: ["photo", "name", "lastName"]
          }
        }
      ],
      order: [["last_message_date", "DESC"]],
    });

    // 3. Filtrar únicamente los chats donde el otro usuario es amigo
    const filteredChats = chats.filter(chat => {
      // Se asume que si user1_id es el actual, el amigo es user2_id, y viceversa
      const friendId = (chat.user1_id === user_id) ? chat.user2_id : chat.user1_id;
      return friendIdsSet.has(friendId);
    });

    // 4. Procesar cada chat para incluir la información del "amigo"
    const chatsWithFriend = filteredChats.map(chat => {
      // Usamos los IDs del registro (no la asociación incluida) para mayor consistencia
      const friendId = (chat.user1_id === user_id) ? chat.user2_id : chat.user1_id;
      // Si el usuario autenticado es user1, el amigo es user2; en caso contrario, el amigo es user1.
      const friendUser = (chat.user1_id === user_id) ? chat.user2 : chat.user1;
      
      // Convertimos a JSON para eliminar métodos u otros metadatos propios de Sequelize
      const chatData = chat.toJSON();
      return {
        ...chatData,
        friend: friendUser,      // Agregamos el objeto con la información del amigo
        friendId: friendId,      // Si se necesita explícitamente
      };
    });

    console.log('Chats encontrados:', chatsWithFriend);

    if (chatsWithFriend.length === 0) {
      return res.status(200).json({ message: "No tienes chats activos." });
    }

    res.status(200).json({ chats: chatsWithFriend });
  } catch (error) {
    console.error("Error al obtener los chats:", error);
    res.status(500).json({ error: error.message || "Ocurrió un error al obtener los chats." });
  }
};

export const deleteChat = async (req, res) => {
  const { user_id } = req.user;
  // Convertir chatId a número, ya que en Firestore se guarda como número
  let { chatId } = req.params;
  chatId = parseInt(chatId, 10);

  try {
    // Verificar que el usuario tenga permiso para eliminar el chat
    const chat = await ChatModel.findOne({
      where: {
        id: chatId,
        [Op.or]: [{ user1_id: user_id }, { user2_id: user_id }],
      },
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat no encontrado o no tienes permiso para eliminarlo." });
    }

    // Eliminar todos los mensajes asociados en Firestore (cada mensaje es un documento con el campo chatId)
    const messagesSnapshot = await db.collection("chats").where("chatId", "==", chatId).get();
    const deletePromises = [];
    messagesSnapshot.forEach(doc => {
      deletePromises.push(db.collection("chats").doc(doc.id).delete());
    });
    await Promise.all(deletePromises);

    // Opcional: Intentar eliminar el documento principal del chat si existe
    try {
      await db.collection("chats").doc(String(chatId)).delete();
    } catch (err) {
      console.warn("No se encontró documento de chat principal, continuando.");
    }

    // Eliminar el chat en MySQL
    await ChatModel.destroy({ where: { id: chatId } });

    res.status(200).json({ message: "Chat eliminado con éxito." });
  } catch (error) {
    console.error("Error al eliminar el chat:", error);
    res.status(500).json({ error: "Ocurrió un error al eliminar el chat." });
  }
};

