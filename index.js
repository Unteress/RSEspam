import express from 'express';
import cors from "cors";
import path from 'path';
import { fileURLToPath } from 'url';
import { PORT } from './config/config.js';
import rotuerTypeUsers from './router/TypeUsersRouter.js';
import { RouterUser } from './router/UserRouter.js';
import { sequelize } from "./db/conexion.js";
import friendsRouter from './router/friendsRouter.js';
import { MessageModel } from './models/MessageModel.js'; 
import MessagesRouter from './router/MessagesRouter.js';
import chatRouter from "./router/chatRouter.js"; // Asegúrate de importar correctamente el chatRouter
import { Op } from "sequelize";


import "./config/firebaseSync.js";


const __filename = fileURLToPath(import.meta.url); 
const __dirname = path.dirname(__filename);

const _PORT = PORT || 3000;
const app = express();
app.use(express.json());
app.use(cors());

// Configura la carpeta de archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Asegúrate de que el router de los chats tenga el prefijo '/api'
app.use('/api/chats', chatRouter);

app.use('/api', rotuerTypeUsers);
app.use('/api', RouterUser);
app.use('/api/friends', friendsRouter);
app.use('/api/messages', MessagesRouter); 



const main = async () => {
    try {
        await sequelize.authenticate();
        console.log('Base de datos conectada.');
        await sequelize.sync({ alter: false })
        app.listen(_PORT, () => {
            console.log(`Servidor corriendo en el puerto => ${_PORT}`);
        });
    } catch (error) {
        console.log(`Error ${error}`);
    }
}
main();
