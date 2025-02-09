import { db } from "./firebaseConfig.js"; // Asegúrate de la ruta correcta
import { MessageModel } from "../models/MessageModel.js";
import { UserModel } from "../models/UserModel.js";
import { ChatModel } from "../models/ChatModel.js";

console.log("Registrando listener en la colección 'chats' de Firebase...");

db.collection("chats").onSnapshot(
  (snapshot) => {
    console.log(`Snapshot recibido con ${snapshot.docChanges().length} cambio(s).`);

    snapshot.docChanges().forEach(async (change) => {
      console.log(`Tipo de cambio: ${change.type}`);
      const data = change.doc.data();
      const firebaseMessageId = change.doc.id;
      console.log(`Procesando mensaje con firebase_id: ${firebaseMessageId}`);

      if (change.type === "added") {
        try {
          // Verificar que existan emisor, receptor y chat en MySQL
          const sender = await UserModel.findByPk(data.senderId);
          const receiver = await UserModel.findByPk(data.receiverId);
          const chat = await ChatModel.findByPk(data.chatId);

          if (!sender) {
            console.error(`Error: sender_id ${data.senderId} no existe en MySQL`);
            return;
          }
          if (!receiver) {
            console.error(`Error: receiver_id ${data.receiverId} no existe en MySQL`);
            return;
          }
          if (!chat) {
            console.error(`Error: chat_id ${data.chatId} no existe en MySQL`);
            return;
          }

          // Convertir la fecha: si es Timestamp de Firestore, usar toDate()
          let createdAt;
          if (data.createdAt && typeof data.createdAt.toDate === "function") {
            createdAt = data.createdAt.toDate();
          } else {
            createdAt = new Date(data.createdAt);
          }

          // Crear el mensaje en MySQL (almacenando el firebase_id)
          const message = await MessageModel.create({
            firebase_id: firebaseMessageId,
            sender_id: data.senderId,
            receiver_id: data.receiverId,
            content: data.content,
            media_url: data.mediaUrl || null,
            message_status: "sent",
            created_at: createdAt,
          });

          // Actualizar el chat en MySQL con el último mensaje
          await chat.update({
            last_message_id: message.id,
            last_message_date: createdAt,
          });

          console.log(`✅ Mensaje sincronizado en MySQL: ${firebaseMessageId}`);
        } catch (error) {
          console.error("❌ Error al sincronizar mensaje con MySQL:", error);
        }
      } else if (change.type === "modified") {
        try {
          await MessageModel.update(
            { message_status: data.status },
            { where: { firebase_id: firebaseMessageId } }
          );
          console.log(`✅ Mensaje actualizado en MySQL: ${firebaseMessageId}`);
        } catch (error) {
          console.error("❌ Error al actualizar mensaje en MySQL:", error);
        }
      } else if (change.type === "removed") {
        try {
          await MessageModel.destroy({ where: { firebase_id: firebaseMessageId } });
          console.log(`✅ Mensaje eliminado de MySQL: ${firebaseMessageId}`);
        } catch (error) {
          console.error("❌ Error al eliminar mensaje en MySQL:", error);
        }
      }
    });
  },
  (error) => {
    console.error("Error en listener onSnapshot:", error);
  }
);
