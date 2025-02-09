import { FriendsModel } from '../models/FriendsModel.js';
import { Op } from "sequelize";
import { UserModel } from '../models/UserModel.js';
import { PersonsModel }  from '../models/PersonsModel.js'; 


export const sendFriendRequest = async (req, res) => {
  const { user_id } = req.user;  // Obtenemos el ID del usuario autenticado
  let { friendId } = req.params;  // Obtenemos el ID del amigo al que se le enviará la solicitud

  friendId = friendId.trim();  // Eliminar cualquier salto de línea o espacio innecesario

  try {
    if (user_id === parseInt(friendId)) {
      return res.status(400).json({ message: "No puedes enviarte una solicitud de amistad a ti mismo." });
    }

    // Verificar si ya existe una solicitud de amistad
    const existingRequest = await FriendsModel.findOne({
      where: {
        [Op.or]: [
          { user_id, friend_id: friendId },
          { user_id: friendId, friend_id: user_id }
        ],
      },
    });

    if (existingRequest) {
      return res.status(409).json({ message: "Ya existe una solicitud de amistad o amistad entre estos usuarios." });
    }

    // Crear nueva solicitud de amistad
    const newRequest = await FriendsModel.create({
      user_id,
      friend_id: friendId,
      status: 'pending',
    });

    res.status(201).json({ message: "Solicitud de amistad enviada", request: newRequest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectFriendRequest = async (req, res) => {
  const { user_id } = req.user;
  const { friendId } = req.params;

  try {
    // Buscar solicitud de amistad pendiente
    const friendRequest = await FriendsModel.findOne({
      where: {
        user_id: friendId,
        friend_id: user_id,
        status: 'pending',
      },
    });

    if (!friendRequest) {
      return res.status(404).json({ message: "No hay solicitud de amistad pendiente." });
    }

    // Rechazar la solicitud
    friendRequest.status = 'rejected';
    await friendRequest.save();

    res.status(200).json({ message: "Solicitud de amistad rechazada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteFriendRequest = async (req, res) => {
  const { user_id } = req.user; // Usuario autenticado
  const { friendId } = req.params; // ID del amigo proporcionado en los parámetros

  try {
    // Verificar si existe la relación entre los usuarios
    const relationship = await FriendsModel.findOne({
      where: {
        [Op.or]: [
          { user_id, friend_id: friendId },
          { user_id: friendId, friend_id: user_id },
        ],
      },
    });

    if (!relationship) {
      return res.status(404).json({
        message: "No se encontró ninguna amistad o solicitud entre estos usuarios.",
      });
    }

    // Eliminar la relación
    await relationship.destroy();

    res.status(200).json({
      message: "Amistad o solicitud eliminada exitosamente.",
    });
  } catch (error) {
    console.error("Error al eliminar la amistad:", error);
    res.status(500).json({
      error: "Ocurrió un error al intentar eliminar la amistad.",
    });
  }
};

export const checkStatusesForUsers = async (req, res) => {
  const { user_id } = req.user;
  const { userIds } = req.body;

  try {
    const statuses = await Promise.all(
      userIds.map(async (friendId) => {
        const friendship = await FriendsModel.findOne({
          where: {
            [Op.or]: [
              { user_id, friend_id: friendId },
              { user_id: friendId, friend_id: user_id },
            ],
          },
        });
        if (friendship) {
          return {
            id: friendId,
            isFriend: friendship.status === 'accepted',
            requestSent: friendship.status === 'pending',
          };
        }
        return { id: friendId, isFriend: false, requestSent: false };
      })
    );
    res.status(200).json(statuses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPendingRequests = async (req, res) => {
  const { user_id } = req.user; // ID del usuario autenticado (será el friend_id en las solicitudes pendientes)

  try {
    const pendingRequests = await FriendsModel.findAll({
      where: {
        friend_id: user_id, // Buscar solicitudes dirigidas al usuario autenticado
        status: 'pending',
      },
      include: {
        model: UserModel,
        as: 'sender', // Alias para el modelo de usuarios
        attributes: ['id', 'user', 'email'], // Atributos directos del usuario
        include: {
          model: PersonsModel, // Relación adicional para obtener la foto
          attributes: ['photo'], // Incluye el campo "photo"
        },
      },
    });

    res.status(200).json({ pendingRequests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const acceptFriendRequest = async (req, res) => {
  const { user_id } = req.user;  // ID del usuario autenticado
  const { friendId } = req.params;  // ID del amigo que envió la solicitud

  try {
    // Buscar solicitud de amistad pendiente
    const friendRequest = await FriendsModel.findOne({
      where: {
        user_id: friendId, // El amigo envió la solicitud
        friend_id: user_id, // El usuario autenticado es el destinatario
        status: 'pending',
      },
    });

    if (!friendRequest) {
      return res.status(404).json({ message: "No hay solicitud de amistad pendiente." });
    }

    // Actualizar el estado de la solicitud a "accepted"
    friendRequest.status = 'accepted';
    await friendRequest.save();

    res.status(200).json({ message: "Solicitud de amistad aceptada" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAcceptedFriends = async (req, res) => {
  const { user_id } = req.user;

  try {
    const acceptedFriends = await FriendsModel.findAll({
      where: {
        [Op.or]: [
          { user_id, status: "accepted" },
          { friend_id: user_id, status: "accepted" },
        ],
      },
      include: [
        {
          model: UserModel,
          as: "sender",
          attributes: ["id", "user", "email"],
          include: {
            model: PersonsModel,
            attributes: ["photo"],
          },
        },
        {
          model: UserModel,
          as: "receiver",
          attributes: ["id", "user", "email"],
          include: {
            model: PersonsModel,
            attributes: ["photo"],
          },
        },
      ],
    });

    const friendsWithPhoto = acceptedFriends.map((friend) => {
      const isSender = friend.user_id === user_id;

      return {
        id: friend.id,
        user: isSender ? friend.receiver : friend.sender,
        status: friend.status,
        created_at: friend.created_at,
      };
    });

    res.status(200).json(friendsWithPhoto);
  } catch (error) {
    console.error("Error al obtener amigos aceptados:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getFriendProfile = async (req, res) => {
  const { user_id } = req.user; // ID del usuario autenticado
  const { friendId } = req.params; // ID del amigo

  try {
    // Verificar si existe una relación de amistad aceptada
    const friendship = await FriendsModel.findOne({
      where: {
        [Op.or]: [
          { user_id, friend_id: friendId, status: "accepted" },
          { user_id: friendId, friend_id: user_id, status: "accepted" },
        ],
      },
      include: [
        {
          model: UserModel,
          as: "sender", // Datos del remitente
          attributes: ["id", "user", "email"],
          include: {
            model: PersonsModel,
            attributes: ["name", "lastName", "photo"],
          },
        },
        {
          model: UserModel,
          as: "receiver", // Datos del receptor
          attributes: ["id", "user", "email"],
          include: {
            model: PersonsModel,
            attributes: ["name", "lastName", "photo"],
          },
        },
      ],
    });

    if (!friendship) {
      return res.status(404).json({ message: "No se encontró ningún amigo con ese ID." });
    }

    // Determinar si el usuario autenticado es el remitente o el receptor
    const isSender = friendship.user_id === user_id;

    // Obtener los datos del amigo
    const friend = isSender ? friendship.receiver : friendship.sender;

    // Formatear los detalles del amigo
    const friendDetails = {
      id: friend.id,
      user: friend.user,
      email: friend.email,
      nombres: friend.person.name,
      apellidos: friend.person.lastName,
      photo: friend.person.photo,
    };

    res.status(200).json(friendDetails);
  } catch (error) {
    console.error("Error al obtener el perfil del amigo:", error);
    res.status(500).json({ error: "Ocurrió un error al obtener el perfil del amigo." });
  }
};
