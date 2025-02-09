import express from 'express';
import { 
  login, 
  updateFullUser, 
  updateUsersPassword, 
  updateUsersEmail, 
  getUsers, 
  createUsers, 
  updateUsers, 
  deleteUsers, 
  getOneUser,
  searchUsers,
  updatePhoto
} from '../controller/UserController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/user', verifyToken, getUsers);
router.get('/user/:id', verifyToken, getOneUser);
router.post('/register', createUsers);
router.put('/user/:id', verifyToken, updateUsers);
router.delete('/user/:id', verifyToken, deleteUsers);
router.post('/login', login);
router.put('/user/email/:id', verifyToken, updateUsersEmail);
router.put('/user/password/:id', verifyToken, updateUsersPassword);
router.put('/full-user/:id', verifyToken, updateFullUser); // Cambia la ruta para evitar conflictos
router.get('/search', verifyToken, searchUsers);
router.put('/user/photo/:id', verifyToken, updatePhoto);

export const RouterUser = router;
