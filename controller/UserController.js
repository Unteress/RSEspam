import { UserModel } from "../models/UserModel.js";
import { TypeUsersModel } from "../models/TypeUsersModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { TOKEN_KEY } from "../config/config.js";
import { PersonsModel } from "../models/PersonsModel.js";
import { Op } from "sequelize"; // Importar Op de Sequelize
import multer from 'multer';
import path from 'path';

// Configurar Multer para almacenar las imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Carpeta donde se guardarán las imágenes
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = fileTypes.test(file.mimetype);
    if (mimeType && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes en formato JPEG, JPG o PNG'));
  },
}).single('photo'); // Nombre del campo en el formulario

// Ruta para actualizar la foto de perfil
export const updatePhoto = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    const { id } = req.params;

    try {
      // Validar si el usuario existe
      const user = await UserModel.findOne({ where: { id } });
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Actualizar la ruta de la foto en la tabla `PersonsModel`
      const person = await PersonsModel.findOne({ where: { id: user.person_id } });
      if (!person) {
        return res.status(404).json({ message: 'Persona asociada no encontrada' });
      }

      person.photo = `/uploads/${req.file.filename}`; // Guardar la ruta
      await person.save();

      res.status(200).json({ 
        message: 'Foto de perfil actualizada',
        photo: person.photo 
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};

// Obtener un usuario por ID (incluyendo previsualización de la foto de perfil)
export const getOneUser = async (req, res) => {
  try {
    const user = await UserModel.findOne({
      attributes: ['id', 'user', 'email', 'person_id'],
      where: { id: req.params.id },
      include: {
        model: PersonsModel,
        attributes: ['name', 'lastName', 'adress', 'photo'], // Incluye solo los campos necesarios
      }
    });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.status(200).json({
      user,
      photoPreview: user.Person?.photo // Incluye la URL de la foto de perfil para previsualización
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Función de búsqueda de usuarios

export const searchUsers = async (req, res) => {
  const { query } = req.query;
  const { user_id } = req.user; // Obtén el ID del usuario autenticado

  if (!query) {
    return res.status(400).json({ message: "Query is required" });
  }

  try {
    const queryTerms = query.trim().split(/\s+/); // Divide por espacio si hay más de una palabra
    const whereConditions = {
      state: true,
      id: { [Op.ne]: user_id }, // Excluye al usuario actual
    };

    if (queryTerms.length === 1) {
      whereConditions[Op.or] = [
        { user: { [Op.like]: `%${query}%` } },
        { '$Person.name$': { [Op.like]: `%${query}%` } },
        { '$Person.lastName$': { [Op.like]: `%${query}%` } },
      ];
    } else if (queryTerms.length > 1) {
      whereConditions[Op.or] = [
        {
          [Op.and]: [
            { '$Person.name$': { [Op.like]: `${queryTerms[0]}%` } },
            { '$Person.lastName$': { [Op.like]: `${queryTerms[1]}%` } },
          ],
        },
        {
          [Op.and]: [
            { '$Person.name$': { [Op.like]: `${queryTerms[1]}%` } },
            { '$Person.lastName$': { [Op.like]: `${queryTerms[0]}%` } },
          ],
        },
      ];
    }

    const users = await UserModel.findAll({
      where: whereConditions,
      attributes: ['id', 'user', 'person_id'],
      include: {
        model: PersonsModel,
        attributes: ['name', 'lastName', 'photo'], // Asegúrate de incluir el campo "photo"
      },
    });

    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener todos los usuarios
export const getUsers = async (req, res) => {
  try {
    const users = await UserModel.findAll({
      attributes: ['id', 'user', 'email','typeusers_id', 'state'],
      where: { state: true },
      include: {
        model: TypeUsersModel, // Incluir la relación con el modelo de tipo de usuario
        attributes: ['id', 'type'] // Aquí supongo que el modelo TypeUsers tiene un campo "type"
      }
    });

    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear un usuario
export const createUsers = async (req, res) => {
  try {
    const { user, email, password } = req.body;

    // Validar que todos los datos requeridos están presentes
    if (!(user && email && password)) {
      return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }

    // Validar el formato de la contraseña
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[A-Z])(?=.*[.,-_@$!%*?&])[A-Za-z\d.,-_@$!%*?&]{10,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: "La contraseña debe tener al menos 10 caracteres, incluir una letra mayúscula, una letra minúscula, un número y un carácter especial (.,-_@$!%*?&)."
      });
    }

    // Verificar si el nombre de usuario ya existe
    const existingUser = await UserModel.findOne({ where: { user } });
    if (existingUser) {
      return res.status(409).json({ message: "El nombre de usuario ya está en uso" });
    }

    // Verificar si el correo electrónico ya existe
    const oldUser = await UserModel.findOne({ where: { email } });
    if (oldUser) {
      return res.status(409).json({ message: "El correo ya está registrado" });
    }

    // Encriptar contraseña
    const encryptedPassword = await bcrypt.hash(password.toString(), 10);

    // Crear persona con foto por defecto
    const person = await PersonsModel.create({
      photo: '/uploads/default.jpg', // Aquí asignas la foto por defecto
    });

    // Crear el usuario con typeusers_id asignado automáticamente como 1
    const userCreated = await UserModel.create({
      user,
      email: email.toLowerCase(),
      password: encryptedPassword,
      typeusers_id: 1,
      person_id: person.id,
    });

    // Generar el token JWT
    const token = jwt.sign({ user_id: userCreated.id, email }, TOKEN_KEY, { expiresIn: "1h" });

    res.status(201).json({ user: userCreated, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar datos completos del usuario
export const updateFullUser = async (req, res) => {
  const { id } = req.params;
  const { user, person } = req.body;

  try {
    // Buscar el usuario por ID
    const userToUpdate = await UserModel.findOne({ where: { id } });
    if (!userToUpdate) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Verificar si el nombre de usuario está en uso por otro usuario
    if (user?.trim()) {
      const existingUser = await UserModel.findOne({ 
        where: { user, id: { [Op.ne]: id } } 
      });
      if (existingUser) {
        return res.status(409).json({ message: "Nombre de usuario ya está en uso" }); // Cambiamos aquí
      }
      userToUpdate.user = user; // Solo actualizamos si no está en uso
    }

    await userToUpdate.save();

    // Buscar y actualizar datos de la persona asociada
    const personToUpdate = await PersonsModel.findOne({ where: { id: userToUpdate.person_id } });
    if (!personToUpdate) {
      return res.status(404).json({ message: "Persona asociada no encontrada" });
    }

    if (person) {
      if (person.name?.trim()) {
        personToUpdate.name = person.name;
      }
      if (person.lastName?.trim()) {
        personToUpdate.lastName = person.lastName;
      }
      if (person.adress?.trim()) {
        personToUpdate.adress = person.adress;
      }
      await personToUpdate.save();
    }

    res.status(200).json({ message: "Usuario y datos asociados actualizados correctamente" });
  } catch (error) {
    console.error("Error en updateFullUser:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// Actualizar nombre de usuario
export const updateUsers = async (req, res) => {
  const { user } = req.body;

  if (!user) {
    return res.status(400).json({ message: "El nombre de usuario es obligatorio" });
  }

  try {
    // Verificar si el nombre de usuario ya está en uso por otro usuario
    const existingUser = await UserModel.findOne({ where: { user, id: { [Op.ne]: req.params.id } } });
    if (existingUser) {
      return res.status(409).json({ message: "El nombre de usuario ya está en uso por otro usuario" });
    }

    // Actualizar el usuario
    const userToUpdate = await UserModel.findOne({ where: { id: req.params.id } });
    if (userToUpdate) {
      userToUpdate.user = user;
      await userToUpdate.save();
      res.status(200).json({ message: "Nombre de usuario actualizado con éxito" });
    } else {
      res.status(404).json({ message: "Usuario no encontrado" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar email de usuario
export const updateUsersEmail = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  // Verificar si el email ya existe
  const existingUser = await UserModel.findOne({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ message: "Email already exists" });
  }

  const userToUpdate = await UserModel.findOne({ where: { id: req.params.id } });
  if (userToUpdate) {
    userToUpdate.email = email;
    await userToUpdate.save();
    res.status(200).json({ message: "Email updated successfully" });
  } else {
    res.status(404).json({ message: "User not found" });
  }
};

// Actualizar contraseña de usuario
export const updateUsersPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Ambas contraseñas son requeridas" });
  }

  // Validar el formato de la nueva contraseña
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[A-Z])(?=.*[.,-_@$!%*?&])[A-Za-z\d.,-_@$!%*?&]{10,}$/;

  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({
      message: "La nueva contraseña debe tener al menos 10 caracteres, incluir una letra mayúscula, una letra minúscula, un número y un carácter especial (.,-_@$!%*?&)."
    });
  }

  const userToUpdate = await UserModel.findOne({ where: { id: req.params.id } });

  if (!userToUpdate) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  // Verificar la contraseña actual
  const isPasswordValid = await bcrypt.compare(currentPassword, userToUpdate.password);

  if (!isPasswordValid) {
    return res.status(401).json({ message: "Contraseña actual incorrecta" });
  }

  // Encriptar la nueva contraseña
  const encryptedNewPassword = await bcrypt.hash(newPassword, 10);
  userToUpdate.password = encryptedNewPassword;
  await userToUpdate.save();

  res.status(200).json({ message: "Contraseña actualizada correctamente" });
};


// Desactivar usuario (en lugar de eliminarlo)
export const deleteUsers = async (req, res) => {
  const user = await UserModel.findOne({ where: { id: req.params.id } });
  if (user) {
    user.state = false; // Cambiar el estado a "false" en lugar de eliminarlo
    await user.save();
    res.status(200).json({ message: "User deactivated successfully" });
  } else {
    res.status(404).json({ message: "User not found" });
  }
};

// Login de usuario
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!(email && password)) {
      return res.status(400).json({ message: "All input is required" });
    }

    const user = await UserModel.findOne({
      where: { email: email.toLowerCase() },
      include: {
        model: TypeUsersModel, // Incluir la relación con el tipo de usuario
        attributes: ['id', 'type'] // Ajustar los atributos que necesites del modelo TypeUsers
      }
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ user_id: user.id, email }, TOKEN_KEY, { expiresIn: "1h" });

    let dataUser = {
      id: user.id,
      user: user.user,
      email: user.email,
      typeusers_id: user.typeusers_id,
      type: user.TypeUser ? user.TypeUser.type : "Unknown" // Obtener el tipo de usuario relacionado
    };

    res.status(200).json({ dataUser, token });
  } catch (err) {
    console.error("Login:", err.message);
    res.status(500).json({ error: err.message });
  }
};
// Refrescar el token (si lo necesitas, este es un ejemplo)
export const refresh = (req, res) => {
  const token = req.headers["authorization"].split(" ")[1];
  if (!token) {
    return res.status(401).end();
  }
  let payload;
  try {
    payload = jwt.verify(token, TOKEN_KEY);
  } catch (e) {
    return res.status(401).end();
  }
  const newToken = jwt.sign({ user_id: payload.user_id, email: payload.email }, TOKEN_KEY, { expiresIn: "1h" });
  res.status(200).json({ token: newToken });
};
