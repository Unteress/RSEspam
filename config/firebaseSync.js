// firebaseSync.js
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
        // Sincronizar mensaje agregado a MySQL
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

          // Convertir la fecha (si es Timestamp de Firestore, usar toDate())
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
        // Actualizar el estado del mensaje en MySQL
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
        // Cuando se elimina un mensaje, verificar si es el último en el chat y actualizar
        try {
          // Primero, buscamos en MySQL el mensaje que se va a eliminar
          const messageRecord = await MessageModel.findOne({ where: { firebase_id: firebaseMessageId } });
          
          if (messageRecord) {
            // Obtenemos el chat asociado (usando data.chatId)
            const chat = await ChatModel.findByPk(data.chatId);
            
            // Si el mensaje eliminado es el que figura como último mensaje del chat...
            if (chat && chat.last_message_id === messageRecord.id) {
              // Consultamos Firebase para obtener el "nuevo último mensaje" (ordenamos por createdAt descendente)
              const messagesSnapshot = await db.collection("chats")
                .where("chatId", "==", data.chatId)
                .orderBy("createdAt", "desc")
                .limit(1)
                .get();
              
              if (!messagesSnapshot.empty) {
                const lastDoc = messagesSnapshot.docs[0];
                const lastData = lastDoc.data();
                let newLastMessageDate;
                if (lastData.createdAt && typeof lastData.createdAt.toDate === "function") {
                  newLastMessageDate = lastData.createdAt.toDate();
                } else {
                  newLastMessageDate = new Date(lastData.createdAt);
                }
                // Se actualiza el chat con el nuevo último mensaje.
                // Nota: Si tienes en MySQL un campo para relacionar el chat con el mensaje (por ejemplo, chat_id en MessageModel),
                // podrías buscar en MySQL el registro correspondiente. En este ejemplo actualizamos usando el id de Firebase.
                await chat.update({
                  last_message_id: lastDoc.id, // Puedes cambiar esto para mapearlo al id de MySQL correspondiente
                  last_message_date: newLastMessageDate,
                });
              } else {
                // Si no quedan mensajes en el chat, se limpia la información del último mensaje.
                await chat.update({
                  last_message_id: null,
                  last_message_date: null,
                });
              }
            }
            // Finalmente, eliminamos el mensaje de MySQL
            await MessageModel.destroy({ where: { firebase_id: firebaseMessageId } });
          }
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
