import express from "express";
import {createInvoice,addLateEventstoInvoice} from "../controllers/invoicescontroller.js";

const router=express.Router()
router.post('/',createInvoice);
router.post('/corrections',addLateEventstoInvoice);
export default router;