import pool from "../db.js";
const createInvoice=async(req,res)=>{
    const {customerID,period_start,period_end}=req.body;
    try {
        if(!customerID){
            return res.status(400).json({error:"customerID is required"})
        }
        if (new Date(period_end) > new Date()) {
            return res.status(422).json({ error: "cannot generate invoice for a period that hasn't ended yet" });
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
        // const response3= await pool.query("insert into invoices (customer_id,period_start,period_end,event_count,amount) values ($1,$2,$3,$4,$5) returning *",[customerID,period_start,period_end,event_count,total_amount]);
        // res.status(201).json({invoice: response3.rows[0]});
        //late event handling k liye
        const client =await pool.connect();
        try{
            await client.query('BEGIN');  // const response3= await pool.query("insert into invoices (customer_id,period_start,period_end,event_count,amount) values ($1,$2,$3,$4,$5) returning *",[customerID,period_start,period_end,event_count,total_amount]);
        // res.status(201).json({invoice: response3.rows[0]});
            const response3= await client.query("insert into invoices(customer_id,period_start,period_end,event_count,amount) values($1,$2,$3,$4,$5) returning *",[customerID,period_start,period_end,event_count,total_amount]);
            const invoice_id=response3.rows[0].id;
            const result= await client.query("update usage_events set invoice_id=$1 where customer_id=$2 and occurred_at<$3 and occurred_at>=$4 and invoice_id is null",[invoice_id,customerID,period_end,period_start]);
            await client.query('COMMIT');
            res.status(201).json({invoice: response3.rows[0], update_usage_events:result.rowCount});
        }catch(err){
            await client.query('ROLLBACK');
            throw err;
        }
        finally{
            client.release();
        }
    } catch (error) {
        // check for duplicate requests
            if (error.code === '23505') {
                const existing = await pool.query("select * from invoices where customer_id=$1 and period_start=$2 and period_end=$3",[customerID, period_start, period_end]
            );
                return res.status(409).json({ error: "invoice already exists for this period", existing_invoice: existing.rows[0] });
            }
        console.error(error.message);
        res.status(500).json({error:"internal server error"});
    }
}


const addLateEventstoInvoice= async(req,res)=>{
    const {customerID,period_start,period_end}=req.body;
    try {
        if(!customerID){
            return res.status(400).json({error:"customerID is required"});
        }
        const res1=await pool.query("select * from usage_events where customer_id=$1 and occurred_at<$2 and occurred_at>=$3 and invoice_id is null",[customerID,period_end,period_start]);
        if(res1.rows.length===0){
            return res.status(400).json({error:"no late events found for this customer in the given period"});
        }
        const event_count=res1.rows.length;
        const response=await pool.query("select price_per_event from customers where id=$1",[customerID]);
        if(response.rows.length===0) {
            return res.status(404).json({error:"customer not found"});
        }
        const price_per_event=response.rows[0].price_per_event;
        const price=parseFloat(price_per_event);
        const total_amt=event_count*price;
        //to get the max correction sequence for this invoice to increment it for the new late events
        const result=await pool.query("select coalesce(max(correction_sequence),0) as max_seq from invoices where customer_id=$1 and period_start = $2 AND period_end = $3",[customerID, period_start, period_end]);
        const next_seq=result.rows[0].max_seq+1;
        const client=await pool.connect();
        try{
            await client.query('BEGIN');
            const insertResult= await client.query("insert into invoices(customer_id,period_start,period_end,event_count,amount,invoice_type,correction_sequence) values($1,$2,$3,$4,$5,'correction',$6) returning *",[customerID,period_start,period_end,event_count,total_amt,next_seq]);
            const correction_invoice_id=insertResult.rows[0].id;
            const event_ids=res1.rows.map(row=>row.id);
            const updateresult=await client.query("update usage_events set invoice_id=$1 where id=ANY($2)",[correction_invoice_id,event_ids]);
            await client.query('COMMIT');
            res.status(201).json({correction_invoice:insertResult.rows[0],updated_usage_events:updateresult.rowCount});
        }catch(err){
            await client.query('ROLLBACK');
            throw err;
        }finally{
            client.release();
        }

    } catch (error) {
        console.error(error.message);
        res.status(500).json({error:"internal server error"});
    }
}
export {addLateEventstoInvoice,createInvoice};