import pool from "../db.js";
const createInvoice=async(req,res)=>{
    const {customerID,period_start,period_end}=req.body;
    try {
        if(!customerID){
            return res.status(400).json({error:"customerID is required"})
        }
        const response=await pool.query("select price_per_event from customers where id=$1",[customerID]);
        if(response.rows.length===0) {
            return res.status(404).json({error:"customer not found"});
        }
        const price_per_event=response.rows[0].price_per_event;
        const response2=await pool.query("select count(*) from usage_events where customer_id=$1 and occurred_at<$2 and occurred_at>=$3",[customerID,period_end,period_start]);
        const event_count=parseInt(response2.rows[0].count);
        const price=parseFloat(price_per_event);
        const total_amount=price*event_count;
        const response3= await pool.query("insert into invoices (customer_id,period_start,period_end,event_count,amount) values ($1,$2,$3,$4,$5) returning *",[customerID,period_start,period_end,event_count,total_amount]);
        res.status(201).json({invoice: response3.rows[0]});
    } catch (error) {
        // check for duplicate requested
            if (error.code === '23505') {
                const existing = await pool.query("select * from invoices where customer_id=$1 and period_start=$2 and period_end=$3",[customerID, period_start, period_end]
            );
                return res.status(409).json({ error: "invoice already exists for this period", existing_invoice: existing.rows[0] });
            }
        console.error(error.message);
        res.status(500).json({error:"internal server error"});
    }
}
export default createInvoice;