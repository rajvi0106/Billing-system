import express from "express";
import createInvoice from "../controllers/invoicescontroller.js";

const router=express.Router()
router.post('/',createInvoice);
export default router;