import express from 'express';
import updatecounts from "../controllers/countscontroller.js";

const router=express.Router();
router.post('/:customerID/increment',updatecounts);
export default router;
