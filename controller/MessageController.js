import { ChatModel } from "../models/ChatModel.js";
import admin from "firebase-admin";
import { Op } from "sequelize";
import { UserModel } from "../models/UserModel.js";
import { PersonsModel } from "../models/PersonsModel.js";
import { db } from "../config/firebaseConfig.js";
import { MessageModel } from "../models/MessageModel.js";
// Obtener el token del dispositivo
async function getUserDeviceToken(userId) {
  try {
    const userRef = admin.firestore().collection("users").doc(String(userId));
    const userDoc = await userRef.get();
    return userDoc.exists ? userDoc.data().deviceToken || null : null;
  } catch (error) {
    console.error("Error obteniendo el token:", error);
    return null;
  }
}

// Enviar un mensaje
export const sendMessage = async (req, res) => {
  const { user_id } = req.user;
  const { receiverId, content, media_url } = req.body;

  try {
    console.log("📨 Iniciando envío de mensaje...");

    // Buscar o crear el chat en MySQL
    let chat = await ChatModel.findOne({
      where: {
        [Op.or]: [
          { user1_id: user_id, user2_id: receiverId },
          { user1_id: receiverId, user2_id: user_id },
        ],
      },
    });

    if (!chat) {
      console.log("🆕 Creando nuevo chat...");
      chat = await ChatModel.create({
        user1_id: user_id,
        user2_id: receiverId,
      });
    }

    // Guardar el mensaje en Firebase, incluyendo el chatId
    console.log("🔥 Guardando mensaje en Firebase...");
    const firestoreDoc = db.collection("chats").doc();
    const messageData = {
      chatId: chat.id, // Relaciona el mensaje con el chat de MySQL
      senderId: user_id,
      receiverId,
      content,
      mediaUrl: media_url,
      status: "sent",
      createdAt: new Date(),
    };
    await firestoreDoc.set(messageData);
    console.log("✅ Mensaje guardado en Firebase con ID:", firestoreDoc.id);

    // Enviar notificación push
    console.log("📢 Enviando notificación push...");
    await sendPushNotification(receiverId, messageData);

    // Responder con los datos del mensaje y del amigo
    const friend = await UserModel.findByPk(receiverId, {
      include: [{ model: PersonsModel, as: "person" }],
    });

    console.log("✅ Mensaje enviado correctamente!");
    res.status(201).json({
      message: { id: firestoreDoc.id, ...messageData },
      friend: {
        id: friend.id,
        fullName: friend.person
          ? `${friend.person.name} ${friend.person.lastName}`
          : "",
      },
    });
  } catch (error) {
    console.error("❌ Error al enviar mensaje:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getMessages = async (req, res) => {
  const { user_id } = req.user;
  // Convertir friendId a número, en caso de que sea necesario
  const friendId = parseInt(req.params.friendId, 10);
  const { page = 1, pageSize = 20 } = req.query;

  try {
    // Buscar el chat en MySQL para verificar que exista una conversación
    const chat = await ChatModel.findOne({
      where: {
        [Op.or]: [
          { user1_id: user_id, user2_id: friendId },
          { user1_id: friendId, user2_id: user_id },
        ],
      },
    });

    if (!chat) {
      return res
        .status(404)
        .json({ message: "No tienes un chat con este usuario." });
    }

    // Consultar los mensajes en Firestore filtrando por chatId
    const messagesQuery = db
    .collection("chats")
    .where("chatId", "==", chat.id)
    .orderBy("createdAt", "asc")
    .offset((page - 1) * pageSize)
    .limit(parseInt(pageSize));


    const messagesSnapshot = await messagesQuery.get();

    const messages = messagesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ messages, currentPage: page });
  } catch (error) {
    console.error("Error en getMessages:", error);
    res.status(500).json({ error: "Error al obtener los mensajes." });
  }
};

// Eliminar un mensaje
export const deleteMessage = async (req, res) => {
  const { user_id } = req.user;
  const { messageId } = req.params;

  try {
    const messageRef = db.collection("chats").doc(messageId);
    const messageDoc = await messageRef.get();

    if (!messageDoc.exists || messageDoc.data().senderId !== user_id) {
      return res.status(404).json({ message: "Mensaje no encontrado o sin permiso para eliminar." });
    }

    await messageRef.delete();
    res.status(200).json({ message: "Mensaje eliminado con éxito." });
  } catch (error) {
    console.error("Error en deleteMessage:", error);
    res.status(500).json({ error: "Error al eliminar el mensaje." });
  }
};

// Actualizar estado del mensaje
export const updateMessageStatus = async (req, res) => {
  const { messageId } = req.params;
  const { status } = req.body;

  if (!["sent", "delivered", "read"].includes(status)) {
    return res.status(400).json({ message: "Estado inválido" });
  }

  try {
    const messageRef = db.collection("chats").doc(messageId);
    const messageDoc = await messageRef.get();

    if (!messageDoc.exists) return res.status(404).json({ message: "Mensaje no encontrado" });

    await messageRef.update({ status });
    res.status(200).json({ message: "Estado del mensaje actualizado", status });
  } catch (error) {
    console.error("Error en updateMessageStatus:", error);
    res.status(500).json({ error: "Error al actualizar el estado del mensaje." });
  }
};

// Enviar notificación push
const sendPushNotification = async (receiverId, message) => {
  const userToken = await getUserDeviceToken(receiverId);
  if (!userToken) return;

  const payload = {
    notification: { title: "Nuevo mensaje", body: message.content || "¡Tienes un nuevo mensaje!" },
    data: { senderId: String(message.senderId) },
  };

  try {
    await admin.messaging().sendToDevice(userToken, payload);
  } catch (error) {
    console.error("Error enviando notificación push:", error);
  }
};
