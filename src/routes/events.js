import express from 'express';
import getparameters from '../controllers/eventscontroller.js';
const router=express.Router();
router.post('/',getparameters);
export default router;
