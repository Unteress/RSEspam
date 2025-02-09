import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  deleteFriendRequest,
  getPendingRequests,
  checkStatusesForUsers,
  getAcceptedFriends,
  getFriendProfile,
} from '../controller/FriendsController.js';
const router = express.Router();

router.post('/send-request/:friendId', verifyToken, sendFriendRequest);
router.put('/accept-request/:friendId', verifyToken, acceptFriendRequest);
router.put('/reject-request/:friendId', verifyToken, rejectFriendRequest);
router.delete('/delete-friend/:friendId', verifyToken, deleteFriendRequest);
router.post('/check-statuses', verifyToken, checkStatusesForUsers);
router.get('/pending-requests', verifyToken, getPendingRequests);
router.get('/accepted-friends', verifyToken, getAcceptedFriends);
router.get('/friend-profile/:friendId', verifyToken, getFriendProfile);


export default router;
